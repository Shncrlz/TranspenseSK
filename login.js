const API_BASE = 'http://localhost:3000/api';

function switchAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const forgotForm = document.getElementById('forgotForm');

    loginForm.style.display = mode === 'login' ? 'block' : 'none';
    forgotForm.style.display = mode === 'forgot' ? 'block' : 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.replace('dashboard.html');
        } else {
            alert(data.message || 'Invalid login details.');
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('Server connection failed.');
    }
}

// 👉 ITO ANG FUNCTION PARA HUMILING NG RESET CODE
async function requestResetCode() {
    const emailInput = document.getElementById('forgotEmail');
    if (!emailInput) {
        alert('Email input field not found.');
        return;
    }
    
    const email = emailInput.value.trim();
    if (!email) {
        alert('Please enter your registered email address first.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/request-reset-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            // 👉 Naka-update na sa hiniling mong mensahe:
            alert('Successfully sent in email');
        } else {
            alert(data.message || 'Failed to request verification code.');
        }
    } catch (err) {
        console.error('Fetch error:', err);
        alert('Server connection failed. Make sure server.js is running.');
    }
}

async function handleResetWithCode(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const code = document.getElementById('forgotCode').value.trim();
    const new_password = document.getElementById('newPassword').value;

    const passwordRegex = /^(?=.*[A-Z]).{10,}$/;
    if (!passwordRegex.test(new_password)) {
        alert('New password must be at least 10 characters long and contain at least 1 uppercase letter.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/reset-password-with-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, new_password })
        });

        const data = await res.json();
        alert(data.message);
        if (res.ok && data.success) {
            switchAuthMode('login');
        }
    } catch (err) {
        console.error('Reset error:', err);
        alert('Server connection failed.');
    }
}