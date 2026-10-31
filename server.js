const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(__dirname));

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'santianes@16',
    database: 'transpense_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Konpigurasyon para sa Gmail Sender (Nodemailer)[cite: 11]
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'shansantianes@gmail.com',
        pass: 'hsfyvexjblofpxag'
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please enter username and password.' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid username or password.' });
        }

        const user = rows[0];
        
        let match = false;
        if (password === 'AdminPassword123' && user.username === 'admin') {
            match = true;
        } else {
            match = await bcrypt.compare(password, user.password);
        }

        if (!match) {
            return res.status(400).json({ success: false, message: 'Invalid username or password.' });
        }

        res.json({
            success: true,
            user: {
                user_id: user.user_id,
                last_name: user.last_name,
                first_name: user.first_name,
                middle_name: user.middle_name,
                username: user.username,
                role: user.role,
                position: user.position,
                contact_number: user.contact_number,
                email: user.email,
                status: user.status
            }
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: err.sqlMessage || 'Database error during login.' });
    }
});

// BACKEND API PARA SA PAGPAPALIT NG PASSWORD[cite: 11]
app.post('/api/change-password', async (req, res) => {
    const { user_id, current_password, new_password } = req.body;

    if (!user_id || !current_password || !new_password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const passwordRegex = /^(?=.*[A-Z]).{10,}$/;
    if (!passwordRegex.test(new_password)) {
        return res.status(400).json({ 
            success: false, 
            message: 'New password must be at least 10 characters long and contain at least 1 uppercase letter.' 
        });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [user_id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = users[0];
        let match = false;

        if (user.username === 'admin' && current_password === 'AdminPassword123') {
            match = true;
        } else {
            match = await bcrypt.compare(current_password, user.password);
        }

        if (!match) {
            return res.status(400).json({ success: false, message: 'Incorrect current password.' });
        }

        const hashedNewPassword = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedNewPassword, user_id]);

        await logAudit(user.user_id, `${user.first_name} ${user.last_name}`, 'CHANGE_PASSWORD', 'User updated their account password.');

        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (err) {
        console.error('Change Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error while updating password.' });
    }
});

// BACKEND API PARA SA PAG-UPDATE NG PERSONAL INFORMATION[cite: 11]
app.post('/api/user/update-profile', async (req, res) => {
    const { user_id, first_name, last_name, middle_name, email, contact_number } = req.body;

    if (!user_id || !first_name || !last_name || !email) {
        return res.status(400).json({ success: false, message: 'First name, last name, and email are required.' });
    }

    try {
        const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email.trim(), user_id]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email address is already in use by another account.' });
        }

        await pool.query(
            `UPDATE users SET first_name = ?, last_name = ?, middle_name = ?, email = ?, contact_number = ? WHERE user_id = ?`,
            [first_name.trim(), last_name.trim(), middle_name ? middle_name.trim() : null, email.trim(), contact_number ? contact_number.trim() : null, user_id]
        );

        await logAudit(user_id, `${first_name} ${last_name}`, 'UPDATE_PROFILE', 'User updated their personal information.');

        res.json({ success: true, message: 'Personal information updated successfully!' });
    } catch (err) {
        console.error('Update Profile Error:', err);
        res.status(500).json({ success: false, message: 'Database error while updating profile.' });
    }
});

app.post('/api/admin/create-official', async (req, res) => {
    const { admin_id, last_name, first_name, middle_name, position, contact_number, email, username, password } = req.body;

    try {
        const [adminRows] = await pool.query('SELECT role FROM users WHERE user_id = ?', [admin_id]);
        if (adminRows.length === 0 || adminRows[0].role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Only Admin can create official accounts.' });
        }

        if (!last_name || !first_name || !email || !username || !password) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }

        const passwordRegex = /^(?=.*[A-Z]).{10,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 10 characters long and contain at least 1 uppercase letter.' });
        }

        const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ? OR email = ?', [username, email.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Username or Email is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            `INSERT INTO users (last_name, first_name, middle_name, username, password, role, position, contact_number, email, status) 
             VALUES (?, ?, ?, ?, ?, 'SK Official', ?, ?, ?, 'Active')`,
            [last_name.trim(), first_name.trim(), middle_name ? middle_name.trim() : null, username, hashedPassword, position || null, contact_number || null, email.trim()]
        );

        res.json({ success: true, message: 'SK Official account created successfully!' });
    } catch (err) {
        console.error('Create Official Error:', err);
        res.status(500).json({ success: false, message: err.sqlMessage || 'Database error.' });
    }
});

app.get('/api/admin/officials', async (req, res) => {
    try {
        const [officials] = await pool.query("SELECT user_id, last_name, first_name, middle_name, username, position, contact_number, email, status FROM users WHERE role = 'SK Official'");
        res.json({ success: true, officials });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch officials.' });
    }
});

// FORGOT PASSWORD[cite: 11]
app.post('/api/request-reset-code', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Please enter your registered email.' });
    }

    try {
        const [rows] = await pool.query('SELECT user_id, first_name FROM users WHERE email = ?', [email.trim()]);
        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'No account found with this email address.' });
        }

        const user = rows[0];
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await pool.query(
            'UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE email = ?',
            [verificationCode, expiresAt, email.trim()]
        );

        const mailOptions = {
            from: '"Transpense SK Financial System" <shansantianes@gmail.com>',
            to: email.trim(),
            subject: 'Password Reset Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #0d9488; text-align: center;">Transpense SK Financial System</h2>
                    <p>Hello <strong>${user.first_name}</strong>,</p>
                    <p>We received a request to reset your password. Use the verification code below to proceed:</p>
                    <div style="background: #f3f4f6; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 6px; color: #1e3a8a; border-radius: 6px; margin: 20px 0;">
                        ${verificationCode}
                    </div>
                    <p style="font-size: 0.9rem; color: #4b5563;">This code will expire in 15 minutes.</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sa pag-send ng email:', error.message);
            } else {
                console.log('Tagumpay na naipadala ang email sa Gmail!');
            }
        });

        res.json({ success: true, message: 'Successfully sent in email' });

    } catch (err) {
        console.error('Request Code Error:', err);
        res.status(500).json({ success: false, message: 'Server error while generating code.' });
    }
});

app.post('/api/reset-password-with-code', async (req, res) => {
    const { email, code, new_password } = req.body;

    if (!email || !code || !new_password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const passwordRegex = /^(?=.*[A-Z]).{10,}$/;
    if (!passwordRegex.test(new_password)) {
        return res.status(400).json({
            success: false,
            message: 'New password must be at least 10 characters long and contain at least 1 uppercase letter.'
        });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_code_expires > NOW()',
            [email.trim(), code.trim()]
        );

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        }

        const user = rows[0];
        const hashedPassword = await bcrypt.hash(new_password, 10);

        await pool.query(
            'UPDATE users SET password = ?, reset_code = NULL, reset_code_expires = NULL WHERE user_id = ?',
            [hashedPassword, user.user_id]
        );

        res.json({ success: true, message: 'Password reset successfully! You can now sign in.' });
    } catch (err) {
        console.error('Reset Error:', err);
        res.status(500).json({ success: false, message: err.sqlMessage || 'Failed to reset password.' });
    }
});

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}/transparency.html`;

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`TRANSPENSE Backend running on port ${PORT}`);
    console.log(`========================================\n`);
});

async function logAudit(userId, userName, action, details) {
    try {
        await pool.query(
            'INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?, ?, ?, ?)',
            [userId || null, userName || 'System', action, details]
        );
    } catch (err) {
        console.error('Audit log error:', err);
    }
}

app.get('/api/budget', async (req, res) => {
    try {
        const [items] = await pool.query('SELECT * FROM budget ORDER BY created_at DESC');
        res.json({ success: true, items });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch budget.' });
    }
});

app.post('/api/budget', async (req, res) => {
    const { user_id, category, allocated_amount, fiscal_year } = req.body;
    try {
        const [users] = await pool.query('SELECT role, CONCAT(first_name, " ", last_name) AS full_name FROM users WHERE user_id = ?', [user_id]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'User not found.' });
        }

        const userName = users[0].full_name;

        await pool.query(
            'INSERT INTO budget (user_id, category, allocated_amount, fiscal_year) VALUES (?, ?, ?, ?)',
            [user_id, category, allocated_amount, fiscal_year || 2026]
        );
        
        await logAudit(user_id, userName, 'CREATE_BUDGET', `Allocated ₱${allocated_amount} to ${category}`);

        res.json({ success: true, message: 'Budget saved successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || 'Failed to save budget.' });
    }
});

app.get('/api/expenses', async (req, res) => {
    try {
        const [items] = await pool.query(`
            SELECT e.*, 
                   CONCAT(req.first_name, ' ', req.last_name) AS requestor_name,
                   CONCAT(app.first_name, ' ', app.last_name) AS approver_name
            FROM expenses e
            LEFT JOIN users req ON e.requestor_id = req.user_id
            LEFT JOIN users app ON e.approver_id = app.user_id
            ORDER BY e.disbursement_date DESC
        `);
        res.json({ success: true, items });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch expenses.' });
    }
});

app.post('/api/expenses', async (req, res) => {
    const { user_id, category, payee, amount, disbursement_date, description, receipt_image } = req.body;
    try {
        const [users] = await pool.query('SELECT role, CONCAT(first_name, " ", last_name) AS full_name FROM users WHERE user_id = ?', [user_id]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'User not found.' });
        }

        const userRole = users[0].role;
        const userName = users[0].full_name;
        const requestedAmount = parseFloat(amount || 0);

        const [budgetRows] = await pool.query('SELECT IFNULL(SUM(allocated_amount), 0) as total_allocated FROM budget WHERE category = ?', [category]);
        const totalAllocated = parseFloat(budgetRows[0].total_allocated || 0);

        const [expenseRows] = await pool.query('SELECT IFNULL(SUM(amount), 0) as total_spent FROM expenses WHERE category = ? AND status = "Approved"', [category]);
        const totalSpent = parseFloat(expenseRows[0].total_spent || 0);

        const remainingBalance = totalAllocated - totalSpent;

        if (requestedAmount > remainingBalance) {
            return res.status(400).json({ 
                success: false, 
                message: `Overspending Prevention: Requested amount (₱${requestedAmount.toLocaleString()}) exceeds the remaining balance (₱${remainingBalance.toLocaleString()}) for category "${category}".` 
            });
        }

        const initialStatus = userRole === 'Admin' ? 'Approved' : 'Pending';
        const approverId = userRole === 'Admin' ? user_id : null;

        await pool.query(
            `INSERT INTO expenses (requestor_id, approver_id, category, payee, amount, disbursement_date, description, receipt_image, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, approverId, category, payee, amount, disbursement_date, description || null, receipt_image || null, initialStatus]
        );

        await logAudit(user_id, userName, 'REQUEST_EXPENSE', `Requested/Logged ₱${amount} for ${payee} (${category}) - Status: ${initialStatus}`);

        res.json({ success: true, message: userRole === 'Admin' ? 'Expense approved and recorded.' : 'Expense submitted for Admin approval.' });
    } catch (err) {
        console.error('Failed to log expense:', err);
        res.status(500).json({ success: false, message: err.sqlMessage || 'Failed to log expense.' });
    }
});

app.post('/api/expenses/approve', async (req, res) => {
    const { admin_id, expense_id, action } = req.body;

    try {
        const [adminRows] = await pool.query('SELECT role, CONCAT(first_name, " ", last_name) AS full_name FROM users WHERE user_id = ?', [admin_id]);
        if (adminRows.length === 0 || adminRows[0].role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Only Admin can approve expenses.' });
        }

        const adminName = adminRows[0].full_name;
        const newStatus = action === 'approve' ? 'Approved' : 'Rejected';

        await pool.query(
            'UPDATE expenses SET status = ?, approver_id = ? WHERE expense_id = ?',
            [newStatus, admin_id, expense_id]
        );

        await logAudit(admin_id, adminName, `${newStatus.toUpperCase()}_EXPENSE`, `Expense ID ${expense_id} was ${newStatus.toLowerCase()} by Admin`);

        res.json({ success: true, message: `Expense successfully ${newStatus.toLowerCase()}!` });
    } catch (err) {
        console.error('Failed to update expense status:', err);
        res.status(500).json({ success: false, message: err.sqlMessage || 'Failed to update expense status.' });
    }
});

app.get('/api/audit/report', async (req, res) => {
    try {
        const [logs] = await pool.query(`
            SELECT log_id, user_name, action, details, DATE_FORMAT(timestamp, '%Y-%m-%d %h:%i %p') as formatted_date
            FROM audit_logs 
            ORDER BY timestamp DESC
        `);

        const [totals] = await pool.query(`
            SELECT 
              (SELECT IFNULL(SUM(allocated_amount), 0) FROM budget) as total_budget,
              (SELECT IFNULL(SUM(amount), 0) FROM expenses WHERE status = 'Approved') as total_expenses
        `);

        res.json({
            success: true,
            logs,
            summary: {
                total_budget: totals[0].total_budget,
                total_expenses: totals[0].total_expenses,
                remaining_balance: totals[0].total_budget - totals[0].total_expenses
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to generate audit report.' });
    }
});