document.addEventListener('DOMContentLoaded', () => {
    loadPublicData();
});

let allPublicExpenses = [];
let allPublicBudgets = [];

async function loadPublicData() {
    try {
        const [budgetRes, expenseRes] = await Promise.all([
            fetch('/api/budget').then(res => res.json()).catch(() => ({ success: false, items: [] })),
            fetch('/api/expenses').then(res => res.json()).catch(() => ({ success: false, items: [] }))
        ]);

        allPublicBudgets = budgetRes.success ? budgetRes.items : [];
        allPublicExpenses = expenseRes.success ? expenseRes.items.filter(e => e.status === 'Approved') : [];

        const totalBudget = allPublicBudgets.reduce((sum, b) => sum + parseFloat(b.allocated_amount || 0), 0);
        const totalExpenses = allPublicExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const remaining = totalBudget - totalExpenses;

        document.getElementById('pubTotalBudget').textContent = `₱${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('pubTotalExpenses').textContent = `₱${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('pubRemaining').textContent = `₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

        renderPublicBudgetWidget(allPublicBudgets, allPublicExpenses);
        renderPublicTable(allPublicExpenses);
    } catch (err) {
        console.error('Failed to load public data:', err);
    }
}

function renderPublicBudgetWidget(budgets, expenses) {
    const container = document.getElementById('publicBudgetProgressWidget');
    if (!container) return;

    if (budgets.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; text-align: center;">No project budget allocations found.</p>';
        return;
    }

    const categoryMap = {};
    budgets.forEach(b => {
        categoryMap[b.category] = { allocated: parseFloat(b.allocated_amount || 0), spent: 0 };
    });

    expenses.forEach(e => {
        if (categoryMap[e.category]) {
            categoryMap[e.category].spent += parseFloat(e.amount || 0);
        }
    });

    let html = '';
    for (const [cat, data] of Object.entries(categoryMap)) {
        const percent = data.allocated > 0 ? Math.min(Math.round((data.spent / data.allocated) * 100), 100) : 0;
        const catRemaining = data.allocated - data.spent;
        
        html += `
            <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px;">
                    <span style="font-weight: 700; color: #0f172a;">${cat}</span>
                    <span style="font-weight: 700; color: #0d9488;">Allocated Budget: ₱${data.allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style="width: 100%; background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
                    <div style="width: ${percent}%; background: ${percent > 90 ? '#dc2626' : '#0d9488'}; height: 100%; border-radius: 4px;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b;">
                    <span>Spent: ₱${data.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${percent}%)</span>
                    <span style="font-weight: 600; color: #15803d;">Remaining Balance: ₱${catRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderPublicTable(expenses) {
    const tbody = document.getElementById('publicExpenseTableBody');
    if (!tbody) return;

    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No approved expenses found.</td></tr>';
        return;
    }

    tbody.innerHTML = expenses.map(item => {
        const formattedDate = new Date(item.disbursement_date || item.created_at).toLocaleDateString();
        const receiptHtml = item.receipt_image ? `<a href="#" onclick="viewReceipt('${item.receipt_image}'); return false;" style="color: #0284c7; font-weight: 600;">View Receipt</a>` : '<span style="color: #94a3b8;">No Receipt</span>';

        return `
            <tr>
                <td>${formattedDate}</td>
                <td><strong>${item.category}</strong></td>
                <td>${item.payee}</td>
                <td>${item.description || '-'}</td>
                <td>${item.requestor_name || 'SK Official'}</td>
                <td>${item.approver_name || 'Admin'}</td>
                <td>${receiptHtml}</td>
                <td style="text-align: right; color: #dc2626; font-weight: bold;">₱${parseFloat(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');
}

function filterPublicExpenses() {
    const query = document.getElementById('publicSearchInput').value.toLowerCase();
    const filtered = allPublicExpenses.filter(item => {
        const cat = (item.category || '').toLowerCase();
        const payee = (item.payee || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return cat.includes(query) || payee.includes(query) || desc.includes(query);
    });
    renderPublicTable(filtered);
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