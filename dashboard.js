let currentUser = null;
let revenueExpenseChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
        } catch (e) {
            console.error('Error parsing stored user data:', e);
        }
    }

    if (!currentUser) {
        window.location.replace('login.html');
        return;
    }

    updateUserInfoUI();
    applyRoleAccessControl();
    loadDashboardData();
    loadAdminOfficials();
});

function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

function updateUserInfoUI() {
    if (!currentUser) return;

    const fullName = `${currentUser.first_name || ''} ${currentUser.middle_name ? currentUser.middle_name + ' ' : ''}${currentUser.last_name || ''}`.trim() || 'User';

    const nameDisplay = document.getElementById('userNameDisplay');
    const roleBadge = document.getElementById('userRoleBadge');
    const avatarInitial = document.getElementById('userAvatarInitial');
    const dropdownSub = document.getElementById('dropdownEmailOrRole');

    if (nameDisplay) nameDisplay.textContent = fullName;

    const roleLabel = currentUser.position ? `${currentUser.role} - ${currentUser.position}` : currentUser.role;
    if (roleBadge) roleBadge.textContent = currentUser.role;
    if (dropdownSub) dropdownSub.textContent = roleLabel;

    if (avatarInitial) avatarInitial.textContent = (currentUser.first_name || 'U').charAt(0).toUpperCase();

    const settingsFirst = document.getElementById('settingsFirstName');
    const settingsLast = document.getElementById('settingsLastName');
    const settingsMiddle = document.getElementById('settingsMiddleName');
    const settingsEmail = document.getElementById('settingsEmailInput');
    const settingsPhone = document.getElementById('settingsPhoneInput');
    const settingsRole = document.getElementById('settingsRoleDisplay');

    if (settingsFirst) settingsFirst.value = currentUser.first_name || '';
    if (settingsLast) settingsLast.value = currentUser.last_name || '';
    if (settingsMiddle) settingsMiddle.value = currentUser.middle_name || '';
    if (settingsEmail) settingsEmail.value = currentUser.email || '';
    if (settingsPhone) settingsPhone.value = currentUser.contact_number || '';
    if (settingsRole) settingsRole.value = roleLabel;
}

function toggleUserDropdown() {
    const menu = document.getElementById('userDropdownMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

window.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.user-dropdown-container');
    const menu = document.getElementById('userDropdownMenu');
    if (wrapper && menu && !wrapper.contains(e.target)) {
        menu.style.display = 'none';
    }
});

function applyRoleAccessControl() {
    const role = currentUser ? currentUser.role : 'SK Official';

    if (role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

async function saveProfileInfo(e) {
    e.preventDefault();
    
    const first_name = document.getElementById('settingsFirstName').value.trim();
    const last_name = document.getElementById('settingsLastName').value.trim();
    const middle_name = document.getElementById('settingsMiddleName').value.trim();
    const email = document.getElementById('settingsEmailInput').value.trim();
    const contact_number = document.getElementById('settingsPhoneInput').value.trim();

    try {
        const res = await fetch('/api/user/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.user_id,
                first_name,
                last_name,
                middle_name,
                email,
                contact_number
            })
        });

        const data = await res.json();
        alert(data.message);

        if (data.success) {
            currentUser.first_name = first_name;
            currentUser.last_name = last_name;
            currentUser.middle_name = middle_name;
            currentUser.email = email;
            currentUser.contact_number = contact_number;

            localStorage.setItem('user', JSON.stringify(currentUser));
            updateUserInfoUI();
        }
    } catch (err) {
        console.error('Profile update error:', err);
        alert('Server connection failed.');
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
        alert('New passwords do not match. Please check and try again.');
        return;
    }

    const passwordRegex = /^(?=.*[A-Z]).{10,}$/;
    if (!passwordRegex.test(newPassword)) {
        alert('Password must be at least 10 characters long and contain at least 1 uppercase letter.');
        return;
    }

    if (!currentUser || !currentUser.user_id) {
        alert('Session error. Please log in again.');
        return;
    }

    try {
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.user_id,
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const data = await res.json();
        alert(data.message);

        if (res.ok && data.success) {
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
            document.getElementById('reqLength').textContent = '❌ At least 10 characters long';
            document.getElementById('reqLength').style.color = '#dc2626';
            document.getElementById('reqUppercase').textContent = '❌ At least 1 uppercase letter (A-Z)';
            document.getElementById('reqUppercase').style.color = '#dc2626';
        }
    } catch (err) {
        console.error('Change password error:', err);
        alert('Server connection failed.');
    }
}

function checkPasswordStrength(password) {
    const reqLength = document.getElementById('reqLength');
    const reqUppercase = document.getElementById('reqUppercase');

    if (!reqLength || !reqUppercase) return;

    if (password.length >= 10) {
        reqLength.textContent = '✔️ At least 10 characters long';
        reqLength.style.color = '#15803d';
    } else {
        reqLength.textContent = '❌ At least 10 characters long';
        reqLength.style.color = '#dc2626';
    }

    const hasUppercase = /[A-Z]/.test(password);
    if (hasUppercase) {
        reqUppercase.textContent = '✔️ At least 1 uppercase letter (A-Z)';
        reqUppercase.style.color = '#15803d';
    } else {
        reqUppercase.textContent = '❌ At least 1 uppercase letter (A-Z)';
        reqUppercase.style.color = '#dc2626';
    }
}

function showTab(tabName) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active-view'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    const targetSection = document.getElementById(`${tabName}-section`);
    const targetNav = document.getElementById(`nav-${tabName}`);

    if (targetSection) targetSection.classList.add('active-view');
    if (targetNav) targetNav.classList.add('active');

    if (tabName === 'reports') {
        loadReportData();
    }
}

async function loadDashboardData() {
    try {
        const [budgetRes, expenseRes] = await Promise.all([
            fetch('/api/budget').then(res => res.json()).catch(() => ({ success: false, items: [] })),
            fetch('/api/expenses').then(res => res.json()).catch(() => ({ success: false, items: [] }))
        ]);

        const budgets = budgetRes.success ? budgetRes.items : [];
        const expenses = expenseRes.success ? expenseRes.items : [];

        renderOverviewStats(budgets, expenses);
        renderRevenueExpenseChart(budgets, expenses);
        renderBudgetProgressWidget(budgets, expenses);
        renderRecentTransactionsWidget(expenses);
        renderBudgetTable(budgets);
        renderExpenseTable(expenses);
        renderLedgerTable(budgets, expenses);
        
        populateExpenseCategoryDropdown(budgets);

    } catch (err) {
        console.error('Error loading dashboard data:', err);
    }
}

function populateExpenseCategoryDropdown(budgets) {
    const select = document.getElementById('expCategory');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select Budget Category --</option>';

    budgets.forEach(b => {
        const option = document.createElement('option');
        option.value = b.category;
        option.textContent = b.category;
        select.appendChild(option);
    });
}

function renderOverviewStats(budgets, expenses) {
    const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.allocated_amount || 0), 0);
    const approvedExpenses = expenses.filter(e => e.status === 'Approved');
    const totalExpenses = approvedExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const remaining = totalBudget - totalExpenses;
    const pendingCount = expenses.filter(e => e.status === 'Pending').length;

    document.getElementById('ovTotalRevenue').textContent = `₱${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('ovTotalExpenses').textContent = `₱${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('ovRemaining').textContent = `₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('ovPendingCount').textContent = pendingCount;

    const sidebarBadge = document.getElementById('sidebarExpenseBadge');
    if (sidebarBadge) {
        if (pendingCount > 0) {
            sidebarBadge.textContent = pendingCount;
            sidebarBadge.style.display = 'inline-block';
        } else {
            sidebarBadge.style.display = 'none';
        }
    }
}

function renderRevenueExpenseChart(budgets, expenses) {
    const ctx = document.getElementById('revenueExpenseChart');
    if (!ctx) return;

    if (revenueExpenseChartInstance) revenueExpenseChartInstance.destroy();

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const labels = [];
    const revenueMap = {};
    const expenseMap = {};

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        labels.push(monthKey);
        revenueMap[monthKey] = 0;
        expenseMap[monthKey] = 0;
    }

    budgets.forEach(b => {
        const dateObj = new Date(b.created_at || Date.now());
        const monthKey = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        if (revenueMap[monthKey] !== undefined) {
            revenueMap[monthKey] += parseFloat(b.allocated_amount || 0);
        }
    });

    expenses.filter(e => e.status === 'Approved').forEach(e => {
        const dateObj = new Date(e.disbursement_date || e.created_at || Date.now());
        const monthKey = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        if (expenseMap[monthKey] !== undefined) {
            expenseMap[monthKey] += parseFloat(e.amount || 0);
        }
    });

    const revenueData = labels.map(m => revenueMap[m]);
    const expenseData = labels.map(m => expenseMap[m]);

    revenueExpenseChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Revenue', data: revenueData, backgroundColor: '#0d9488', borderRadius: 4 },
                { label: 'Expenses', data: expenseData, backgroundColor: '#1e3a8a', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', align: 'end' } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: function(value) { return '₱' + value.toLocaleString(); } }
                }
            }
        }
    });
}

function renderBudgetProgressWidget(budgets, expenses) {
    const container = document.getElementById('budgetProgressWidget');
    if (!container) return;

    if (budgets.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No budget allocations found.</p>';
        return;
    }

    const categoryMap = {};
    budgets.forEach(b => {
        categoryMap[b.category] = { allocated: parseFloat(b.allocated_amount || 0), spent: 0 };
    });
    expenses.filter(e => e.status === 'Approved').forEach(e => {
        if (categoryMap[e.category]) {
            categoryMap[e.category].spent += parseFloat(e.amount || 0);
        }
    });

    let html = '';
    for (const [cat, data] of Object.entries(categoryMap)) {
        const percent = data.allocated > 0 ? Math.min(Math.round((data.spent / data.allocated) * 100), 100) : 0;
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                    <span style="font-weight: 600; color: #0f172a;">${cat}</span>
                    <span style="font-weight: 700; color: #0d9488;">${percent}%</span>
                </div>
                <div style="width: 100%; background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percent}%; background: #0d9488; height: 100%; border-radius: 4px;"></div>
                </div>
                <div style="font-size: 0.75rem; color: #64748b; text-align: right; margin-top: 2px;">
                    ₱${data.spent.toLocaleString()} of ₱${data.allocated.toLocaleString()}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderRecentTransactionsWidget(expenses) {
    const tbody = document.getElementById('recentTransactionsTableBody');
    if (!tbody) return;

    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent transactions recorded.</td></tr>';
        return;
    }

    const recent = expenses.slice(0, 5);
    tbody.innerHTML = recent.map(item => {
        const rawStatus = item.status || 'Approved';
        const statusClass = rawStatus.toLowerCase();
        const formattedDate = new Date(item.disbursement_date || item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        return `
            <tr>
                <td>${formattedDate}</td>
                <td><strong>${item.description || item.payee || 'Expense Item'}</strong></td>
                <td style="font-weight: bold;">₱${parseFloat(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td><span class="status-badge ${statusClass}">${rawStatus}</span></td>
            </tr>
        `;
    }).join('');
}

function renderBudgetTable(budgets) {
    const tbody = document.getElementById('budgetTableBody');
    const totalCell = document.getElementById('budgetTableTotal');
    if (!tbody) return;

    if (budgets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No budget allocations found.</td></tr>';
        if (totalCell) totalCell.textContent = '₱0.00';
        return;
    }

    let totalBudget = 0;
    tbody.innerHTML = budgets.map(b => {
        const amount = parseFloat(b.allocated_amount || 0);
        totalBudget += amount;
        return `
            <tr>
                <td><strong>${b.category}</strong></td>
                <td>${b.fiscal_year}</td>
                <td style="text-align: right; color: #0d9488; font-weight: bold;">₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');

    if (totalCell) totalCell.textContent = `₱${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function renderExpenseTable(expenses) {
    const tbody = document.getElementById('expenseTableBody');
    const totalCell = document.getElementById('expenseTableTotal');
    if (!tbody) return;

    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No expenses recorded.</td></tr>';
        if (totalCell) totalCell.textContent = '₱0.00';
        return;
    }

    let totalApproved = 0;
    const isAdmin = currentUser && currentUser.role === 'Admin';

    tbody.innerHTML = expenses.map(e => {
        const amount = parseFloat(e.amount || 0);
        if (e.status === 'Approved') totalApproved += amount;
        
        const receiptLink = e.receipt_image ? `<a href="#" onclick="viewReceipt('${e.receipt_image}'); return false;" style="color:#0284c7; font-weight:600;">View</a>` : 'None';
        const actionButtons = isAdmin && e.status === 'Pending' ? `
            <button onclick="approveExpense(${e.expense_id}, 'approve')" style="background:#10b981; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">Approve</button>
            <button onclick="approveExpense(${e.expense_id}, 'reject')" style="background:#dc2626; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">Reject</button>
        ` : '-';

        return `
            <tr>
                <td>${new Date(e.disbursement_date).toLocaleDateString()}</td>
                <td>${e.category}</td>
                <td><strong>${e.payee}</strong></td>
                <td>${e.description || '-'}</td>
                <td>${e.requestor_name || 'Official'}</td>
                <td>${e.approver_name || '-'}</td>
                <td>${receiptLink}</td>
                <td><span style="padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem; background:${e.status==='Approved'?'#dcfce7':e.status==='Pending'?'#fef9c3':'#fee2e2'}; color:${e.status==='Approved'?'#15803d':e.status==='Pending'?'#a16207':'#b91c1c'}">${e.status}</span></td>
                <td style="text-align: right; color: #dc2626; font-weight: bold;">₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td class="admin-only" style="display: ${isAdmin ? 'table-cell' : 'none'}; text-align: center;">${actionButtons}</td>
            </tr>
        `;
    }).join('');

    if (totalCell) totalCell.textContent = `₱${totalApproved.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function viewReceipt(imageSrc) {
    const modal = document.getElementById('receiptModal');
    const img = document.getElementById('modalReceiptImg');
    if (modal && img) {
        img.src = imageSrc;
        modal.style.display = 'flex';
    }
}

function closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function approveExpense(expenseId, action) {
    try {
        const res = await fetch('/api/expenses/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_id: currentUser.user_id, expense_id: expenseId, action })
        });
        const data = await res.json();
        alert(data.message);
        if (data.success) {
            loadDashboardData();
        }
    } catch (err) {
        console.error('Approval error:', err);
        alert('Server connection failed.');
    }
}

function renderLedgerTable(budgets, expenses) {
    const tbody = document.getElementById('ledgerTableBody');
    if (!tbody) return;

    const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.allocated_amount || 0), 0);
    const approvedExpenses = expenses.filter(e => e.status === 'Approved');
    const totalExpenses = approvedExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const remaining = totalBudget - totalExpenses;

    document.getElementById('cardTotalBudget').textContent = `₱${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('cardTotalDisbursed').textContent = `₱${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('cardRemaining').textContent = `₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const combined = [
        ...budgets.map(b => ({
            date: b.created_at || new Date().toISOString(),
            type: 'BUDGET ALLOCATION',
            category: b.category,
            details: `Fiscal Year ${b.fiscal_year}`,
            amount: parseFloat(b.allocated_amount),
            isCredit: true
        })),
        ...approvedExpenses.map(e => ({
            date: e.disbursement_date || e.created_at,
            type: 'EXPENSE DISBURSEMENT',
            category: e.category,
            details: `Payee: ${e.payee} (${e.description || 'N/A'})`,
            amount: parseFloat(e.amount),
            isCredit: false
        }))
    ];

    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (combined.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No ledger transactions found.</td></tr>';
        return;
    }

    tbody.innerHTML = combined.map(item => `
        <tr>
            <td>${new Date(item.date).toLocaleDateString()}</td>
            <td><span style="font-size:0.75rem; padding:3px 8px; border-radius:4px; font-weight:bold; background:${item.isCredit ? '#dcfce7' : '#fee2e2'}; color:${item.isCredit ? '#15803d' : '#b91c1c'}">${item.type}</span></td>
            <td>${item.category}</td>
            <td>${item.details}</td>
            <td style="text-align:right; font-weight:bold; color:${item.isCredit ? '#0d9488' : '#dc2626'}">₱${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
    `).join('');
}

async function loadReportData() {
    try {
        const res = await fetch('/api/audit/report');
        const data = await res.json();

        if (data.success) {
            document.getElementById('reportPrintDate').textContent = new Date().toLocaleString();
            const fullName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}` : 'System User';
            document.getElementById('reportGeneratedBy').textContent = `${fullName} (${currentUser?.role || 'User'})`;
            document.getElementById('reportPreparedName').textContent = fullName;
            document.getElementById('reportPreparedPosition').textContent = currentUser?.role || 'SK Official';

            document.getElementById('repTotalBudget').textContent = `₱${data.summary.total_budget.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            document.getElementById('repTotalDisbursed').textContent = `₱${data.summary.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            document.getElementById('repNetRemaining').textContent = `₱${data.summary.remaining_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

            const tbody = document.getElementById('reportTableBody');
            if (data.logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No audit logs recorded yet.</td></tr>';
            } else {
                tbody.innerHTML = data.logs.map(log => `
                    <tr>
                        <td>${log.formatted_date}</td>
                        <td>${log.user_name}</td>
                        <td><strong>${log.action}</strong></td>
                        <td>${log.details}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load report data:', err);
    }
}

async function loadAdminOfficials() {
    if (!currentUser || currentUser.role !== 'Admin') return;
    try {
        const res = await fetch('/api/admin/officials');
        const data = await res.json();
        const tbody = document.getElementById('adminOfficialsTableBody');
        if (!tbody) return;

        if (!data.success || data.officials.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No SK Officials created yet.</td></tr>';
            return;
        }

        tbody.innerHTML = data.officials.map(off => `
            <tr>
                <td><strong>${off.last_name}, ${off.first_name}</strong></td>
                <td>${off.position || 'SK Official'}</td>
                <td>${off.username}</td>
                <td>${off.email}</td>
                <td>${off.contact_number || '-'}</td>
                <td><span style="color:#10b981; font-weight:bold;">${off.status}</span></td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load officials:', err);
    }
}

function openBudgetModal() { document.getElementById('budgetModal').style.display = 'flex'; }
function closeBudgetModal() { document.getElementById('budgetModal').style.display = 'none'; }
function openExpenseModal() { document.getElementById('expenseModal').style.display = 'flex'; }
function closeExpenseModal() { document.getElementById('expenseModal').style.display = 'none'; }
function openCreateOfficialModal() { document.getElementById('createOfficialModal').style.display = 'flex'; }
function closeCreateOfficialModal() { document.getElementById('createOfficialModal').style.display = 'none'; }

async function saveBudget(e) {
    e.preventDefault();
    const category = document.getElementById('budgetCategory').value;
    const allocated_amount = document.getElementById('budgetAmount').value;
    const fiscal_year = document.getElementById('budgetYear').value;

    try {
        const res = await fetch('/api/budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.user_id, category, allocated_amount, fiscal_year })
        });
        const result = await res.json();
        if (result.success) {
            closeBudgetModal();
            document.getElementById('budgetForm').reset();
            loadDashboardData();
        } else { alert('Error: ' + result.message); }
    } catch (err) { console.error('Failed to save budget:', err); }
}

async function handleAddExpense(e) {
    e.preventDefault();
    const category = document.getElementById('expCategory').value;
    const payee = document.getElementById('expPayee').value;
    const amount = document.getElementById('expAmount').value;
    const disbursement_date = document.getElementById('expDate').value;
    const description = document.getElementById('expDesc').value;
    const fileInput = document.getElementById('expReceiptFile');

    let receipt_image = '';

    const processFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    };

    try {
        if (fileInput.files && fileInput.files[0]) {
            receipt_image = await processFile(fileInput.files[0]);
        }

        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: currentUser.user_id, 
                category, 
                payee, 
                amount, 
                disbursement_date, 
                description, 
                receipt_image 
            })
        });

        const result = await res.json();
        alert(result.message);
        
        if (result.success) {
            closeExpenseModal();
            document.getElementById('expenseForm').reset();
            loadDashboardData();
        }
    } catch (err) { 
        console.error('Failed to record expense:', err);
        alert('Server connection failed during file processing.');
    }
}

async function handleCreateOfficial(e) {
    e.preventDefault();
    const last_name = document.getElementById('offLastName').value;
    const first_name = document.getElementById('offFirstName').value;
    const middle_name = document.getElementById('offMiddleName').value;
    const position = document.getElementById('offPosition').value;
    const contact_number = document.getElementById('offContact').value;
    const email = document.getElementById('offEmail').value;
    const username = document.getElementById('offUsername').value;
    const password = document.getElementById('offPassword').value;

    const passwordRegex = /^(?=.*[A-Z]).{10,}$/;
    if (!passwordRegex.test(password)) {
        alert('Password must be at least 10 characters long and contain at least 1 uppercase letter.');
        return;
    }

    try {
        const res = await fetch('/api/admin/create-official', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: currentUser.user_id,
                last_name,
                first_name,
                middle_name,
                position,
                contact_number,
                email,
                username,
                password
            })
        });
        const data = await res.json();
        alert(data.message);
        if (res.ok && data.success) {
            closeCreateOfficialModal();
            document.getElementById('createOfficialForm').reset();
            loadAdminOfficials();
        }
    } catch (err) {
        console.error('Create official error:', err);
        alert('Server connection failed.');
    }
}

function logout() {
    localStorage.removeItem('user');
    window.location.replace('login.html');
}

function exportReportPDF() {
    window.print();
}