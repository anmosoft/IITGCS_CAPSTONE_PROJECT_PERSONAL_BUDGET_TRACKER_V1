
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const INCOME_CATEGORIES = [
    'Salary', 'Business', 'Freelance', 'Investment', 'Rental', 'Pension', 'Gift', 'Other'
];
const EXPENSE_CATEGORIES = [
    'Food & Groceries', 'Transportation', 'Rent', 'Utilities', 'Entertainment',
    'Healthcare', 'Shopping', 'Education', 'Travel', 'Savings', 'Donations', 'Other'
];

app.get('/api/categories', (req, res) => {
    res.json({ income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES });
});

app.get('/api/income', (req, res) => {
    const rows = db.prepare('SELECT * FROM income ORDER BY date DESC').all();
    res.json(rows);
});

app.post('/api/income', (req, res) => {
    const { amount, category, frequency, date, notes } = req.body;
    if (!amount || !category || !date || !frequency) return res.status(400).json({ error: 'missing fields' });
    db.prepare('INSERT INTO income (amount, category, frequency, date, notes) VALUES (?, ?, ?, ?, ?)')
        .run(amount, category, frequency, date, notes || '');
    res.json({ ok: true });
});

app.delete('/api/income/:id', (req, res) => {
    db.prepare('DELETE FROM income WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

app.get('/api/expense', (req, res) => {
    const rows = db.prepare('SELECT * FROM expense ORDER BY date DESC').all();
    res.json(rows);
});

app.post('/api/expense', (req, res) => {
    const { amount, category, date, notes } = req.body;
    if (!amount || !category || !date) return res.status(400).json({ error: 'missing fields' });
    db.prepare('INSERT INTO expense (amount, category, date, notes) VALUES (?, ?, ?, ?)')
        .run(amount, category, date, notes || '');
    res.json({ ok: true });
});

app.delete('/api/expense/:id', (req, res) => {
    db.prepare('DELETE FROM expense WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});
app.get('/api/budgets', (req, res) => {
    const { month } = req.query;
    let rows;
    if (month) rows = db.prepare('SELECT * FROM budget WHERE month = ? ORDER BY category').all(month);
    else rows = db.prepare('SELECT * FROM budget ORDER BY month DESC').all();
    res.json(rows);
});

app.post('/api/budgets', (req, res) => {
    const { month, category, amount } = req.body;
    if (!category || amount == null) return res.status(400).json({ error: 'missing' });
    db.prepare(`
    INSERT INTO budget (month, category, amount)
    VALUES (?, ?, ?)
    ON CONFLICT(month, category) DO UPDATE SET amount=excluded.amount
  `).run(month || null, category, amount);
    res.json({ ok: true });
});

app.delete('/api/budgets/:id', (req, res) => {
    db.prepare('DELETE FROM budget WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

app.get('/api/summary/:month', (req, res) => {
    const month = req.params.month;
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return res.status(400).json({ error: 'invalid month' });

    const daysInMonth = new Date(y, m, 0).getDate();
    const start = `${month}-01`;
    const end = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    const expenseRows = db.prepare('SELECT category, SUM(amount) as total FROM expense WHERE date BETWEEN ? AND ? GROUP BY category')
        .all(start, end);
    const totalExpenseObj = db.prepare('SELECT SUM(amount) as total FROM expense WHERE date BETWEEN ? AND ?').get(start, end);
    const totalExpense = totalExpenseObj.total || 0;

    const incomeRowsRaw = db.prepare('SELECT * FROM income').all();
    let incomeByCategory = {};
    let totalIncome = 0;
    for (const inc of incomeRowsRaw) {
        if (inc.frequency === 'monthly') {
            incomeByCategory[inc.category] = (incomeByCategory[inc.category] || 0) + Number(inc.amount);
            totalIncome += Number(inc.amount);
        } else if (inc.frequency === 'daily') {
            const v = Number(inc.amount) * daysInMonth;
            incomeByCategory[inc.category] = (incomeByCategory[inc.category] || 0) + v;
            totalIncome += v;
        } else {
            if (inc.date >= start && inc.date <= end) {
                incomeByCategory[inc.category] = (incomeByCategory[inc.category] || 0) + Number(inc.amount);
                totalIncome += Number(inc.amount);
            }
        }
    }

    const budgetsMonth = db.prepare('SELECT * FROM budget WHERE month = ?').all(month);
    const budgetsDefault = db.prepare('SELECT * FROM budget WHERE month IS NULL').all();
    const budgets = [...budgetsMonth, ...budgetsDefault];

    res.json({
        month,
        daysInMonth,
        totalIncome,
        totalExpense,
        incomeByCategory,
        expenseByCategory: expenseRows,
        budgets
    });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
