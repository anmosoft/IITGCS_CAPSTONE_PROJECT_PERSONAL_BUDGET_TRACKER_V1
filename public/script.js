


const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2600);
}

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

//Storage 
const STORE = {
    incomesKey: 'pbt_incomes_v1',
    expensesKey: 'pbt_expenses_v1',
    budgetsKey: 'pbt_budgets_v1',

    read(key) {
        try { return JSON.parse(localStorage.getItem(key) || '[]'); }
        catch (e) { return []; }
    },
    write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

//category
const DEFAULT_EXPENSE_CATEGORIES = [
    'Food & Groceries', 'Transportation', 'Rent', 'Utilities', 'Entertainment',
    'Healthcare', 'Shopping', 'Education', 'Travel', 'Savings/Investments', 'Donations', 'Other'
];

const DEFAULT_INCOME_TYPES = ['Salary', 'Business', 'Freelance', 'Investment', 'Rental', 'Pension', 'Gift', 'Other'];

//state
let incomes = STORE.read(STORE.incomesKey);
let expenses = STORE.read(STORE.expensesKey);
let budgets = STORE.read(STORE.budgetsKey);

// Charts
let incomeExpenseChart = null;
let expensePieChart = null;
let monthlyTrendChart = null;

//DOM refs
const monthInput = $('#month-select');
const today = new Date();
monthInput.value = today.toISOString().slice(0, 7);

const incomeForm = $('#income-form');
const expenseForm = $('#expense-form');
const budgetForm = $('#budget-form');

const incomeTypeSel = $('#income-type');
const incomeFreqSel = $('#income-frequency');
const expenseCategorySel = $('#expense-category');
const budgetCategorySel = $('#budget-category');

const totalIncomeEl = $('#total-income');
const totalExpenseEl = $('#total-expense');
const totalSavingsEl = $('#total-savings');

const incomeTableBody = $('#income-table tbody');
const expenseTableBody = $('#expense-table tbody');
const budgetsList = $('#budgets-list');

const incomeExpenseCanvas = $('#incomeExpenseChart');
const expensePieCanvas = $('#expensePieChart');
const monthlyTrendCanvas = $('#monthlyTrendChart');


function populateCategoryDropdowns() {

    incomeTypeSel.innerHTML = DEFAULT_INCOME_TYPES.map(t => `<option value="${t}">${t}</option>`).join('') +
        `<option value="Other">Other</option>`;


    expenseCategorySel.innerHTML = DEFAULT_EXPENSE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('') +
        `<option value="Other">Other</option>`;


    budgetCategorySel.innerHTML = DEFAULT_EXPENSE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('') +
        `<option value="Other">Other</option>`;
}

//CRUD
function saveIncome(item) {
    incomes.push(item);
    STORE.write(STORE.incomesKey, incomes);
}

function saveExpense(item) {
    expenses.push(item);
    STORE.write(STORE.expensesKey, expenses);
}

function saveBudget(item) {

    const idx = budgets.findIndex(b => (b.month || '') === (item.month || '') && b.category === item.category);
    if (idx >= 0) { budgets[idx].amount = item.amount; }
    else { budgets.push(item); }
    STORE.write(STORE.budgetsKey, budgets);
}

function deleteIncome(id) {
    incomes = incomes.filter(i => i.id !== id);
    STORE.write(STORE.incomesKey, incomes);
}

function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    STORE.write(STORE.expensesKey, expenses);
}

function deleteBudgetById(id) {
    budgets = budgets.filter(b => b.id !== id);
    STORE.write(STORE.budgetsKey, budgets);
}

//Cal
function calcTotalsForMonth(month) {

    const [yStr, mStr] = month.split('-');
    const y = parseInt(yStr, 10), m = parseInt(mStr, 10);
    const dim = daysInMonth(y, m);
    const start = `${month}-01`;
    const end = `${month}-${String(dim).padStart(2, '0')}`;


    const expenseRows = expenses.filter(e => e.date >= start && e.date <= end);
    const expenseByCategory = {};
    let totalExpense = 0;
    for (const ex of expenseRows) {
        expenseByCategory[ex.category] = (expenseByCategory[ex.category] || 0) + Number(ex.amount);
        totalExpense += Number(ex.amount);
    }


    const incomeByCategory = {};
    let totalIncome = 0;
    for (const inc of incomes) {
        if (inc.frequency === 'monthly') {
            incomeByCategory[inc.type] = (incomeByCategory[inc.type] || 0) + Number(inc.amount);
            totalIncome += Number(inc.amount);
        } else if (inc.frequency === 'daily') {
            const v = Number(inc.amount) * dim;
            incomeByCategory[inc.type] = (incomeByCategory[inc.type] || 0) + v;
            totalIncome += v;
        } else {
            if (inc.date >= start && inc.date <= end) {
                incomeByCategory[inc.type] = (incomeByCategory[inc.type] || 0) + Number(inc.amount);
                totalIncome += Number(inc.amount);
            }
        }
    }

    return { totalIncome, totalExpense, incomeByCategory, expenseByCategory, expenseRows };
}


function renderSummary(month) {
    const { totalIncome, totalExpense } = calcTotalsForMonth(month);
    totalIncomeEl.textContent = totalIncome.toFixed(2);
    totalExpenseEl.textContent = totalExpense.toFixed(2);
    totalSavingsEl.textContent = (totalIncome - totalExpense).toFixed(2);
}

function renderTables() {

    const recentIncomes = incomes.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    incomeTableBody.innerHTML = recentIncomes.map(i => `
    <tr>
      <td>${Number(i.amount).toFixed(2)}</td>
      <td>${i.type}</td>
      <td>${i.frequency}</td>
      <td>${i.date}</td>
      <td><button class="btn-delete" data-id="${i.id}" data-kind="income">Del</button></td>
    </tr>
  `).join('') || '<tr><td colspan="5">No incomes yet</td></tr>';

    const recentExpenses = expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    expenseTableBody.innerHTML = recentExpenses.map(e => `
    <tr>
      <td>${Number(e.amount).toFixed(2)}</td>
      <td>${e.category}</td>
      <td>${e.date}</td>
      <td><button class="btn-delete" data-id="${e.id}" data-kind="expense">Del</button></td>
    </tr>
  `).join('') || '<tr><td colspan="4">No expenses yet</td></tr>';
}

function renderBudgets(month) {

    const { expenseByCategory } = calcTotalsForMonth(month);

    const monthBudgets = budgets.filter(b => !b.month || b.month === '' || b.month === month);

    const map = {};
    monthBudgets.forEach(b => {
        const key = b.category;
        if (map[key] && map[key].month === month) return;
        map[key] = b;
    });

    const cats = Object.keys(map);
    if (cats.length === 0) {
        budgetsList.innerHTML = '<div>No budgets set. Add one above.</div>';
        return;
    }

    budgetsList.innerHTML = cats.map(cat => {
        const b = map[cat];
        const spent = expenseByCategory[cat] || 0;
        const pct = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
        const color = spent > b.amount ? '#f44336' : '#4CAF50';
        return `
      <div class="budget-item" data-bid="${b.id}">
        <div class="budget-header">
          <div><strong>${b.category}</strong> ${b.month ? `<small>(${b.month})</small>` : `<small>(recurring)</small>`}</div>
          <div>${spent.toFixed(2)} / ${Number(b.amount).toFixed(2)} <button class="del-budget" data-id="${b.id}">Remove</button></div>
        </div>
        <div class="budget-bar"><div class="budget-fill" style="width:${pct}%; background:${color}"></div></div>
      </div>
    `;
    }).join('');
}

function renderCharts(month) {
    const { totalIncome, totalExpense, expenseByCategory, incomeByCategory } = calcTotalsForMonth(month);

    // Income vs Expense
    if (incomeExpenseChart) incomeExpenseChart.destroy();
    incomeExpenseChart = new Chart(incomeExpenseCanvas, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expense'],
            datasets: [{ label: 'Amount', data: [totalIncome, totalExpense], backgroundColor: ['#4CAF50', '#F44336'] }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // Expense Pie
    const expLabels = Object.keys(expenseByCategory);
    const expData = expLabels.map(k => expenseByCategory[k]);
    if (expensePieChart) expensePieChart.destroy();
    expensePieChart = new Chart(expensePieCanvas, {
        type: 'pie',
        data: { labels: expLabels, datasets: [{ data: expData }] },
        options: { responsive: true }
    });

    // Monthly trend
    const [sy, sm] = month.split('-').map(Number);
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const dt = new Date(sy, sm - 1 - i, 1);
        months.push(dt.toISOString().slice(0, 7));
    }
    const incomeSeries = months.map(mon => calcTotalsForMonth(mon).totalIncome);
    const expenseSeries = months.map(mon => calcTotalsForMonth(mon).totalExpense);

    if (monthlyTrendChart) monthlyTrendChart.destroy();
    monthlyTrendChart = new Chart(monthlyTrendCanvas, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                { label: 'Income', data: incomeSeries, borderColor: '#2ecc71', tension: 0.25, fill: false },
                { label: 'Expense', data: expenseSeries, borderColor: '#e74c3c', tension: 0.25, fill: false }
            ]
        },
        options: { responsive: true }
    });
}
function renderTransactionHistory() {
    const historyEl = document.getElementById("transaction-history");
    historyEl.innerHTML = "";

    const allTransactions = [
        ...incomes.map(t => ({ ...t, type: "income" })),
        ...expenses.map(t => ({ ...t, type: "expense" }))
    ];

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    allTransactions.forEach(tx => {
        const card = document.createElement("div");
        card.classList.add("transaction-card", tx.type);

        const amountSign = tx.type === "income" ? "+" : "-";
        card.innerHTML = `
            <div class="transaction-amount">
                ${amountSign} ${tx.amount.toFixed(2)}
            </div>
            <div class="transaction-meta">
                ${tx.category || tx.incomeType} 
                ${tx.notes ? " | " + tx.notes : ""}
                <br>
                ${new Date(tx.date).toLocaleDateString()}
            </div>
        `;

        historyEl.appendChild(card);
    });
}


function renderAll() {
    const month = monthInput.value || today.toISOString().slice(0, 7);
    renderSummary(month);
    renderTables();
    renderBudgets(month);
    renderCharts(month);
    renderTransactionHistory();

}


incomeForm.addEventListener('submit', e => {
    e.preventDefault();
    const amt = Number($('#income-amount').value);
    const type = $('#income-type').value;
    const freq = $('#income-frequency').value;
    const date = $('#income-date').value;
    const notes = $('#income-notes').value || '';
    if (!amt || !type || !date) { toast('Please fill required fields'); return; }
    const item = { id: uid(), amount: amt, type, frequency: freq, date, notes };
    saveIncome(item);
    toast('Income saved');
    incomeForm.reset();
    $('#income-date').value = new Date().toISOString().slice(0, 10);
    renderAll();
});

expenseForm.addEventListener('submit', e => {
    e.preventDefault();
    const amt = Number($('#expense-amount').value);
    const category = $('#expense-category').value;
    const date = $('#expense-date').value;
    const notes = $('#expense-notes').value || '';
    if (!amt || !category || !date) { toast('Please fill required fields'); return; }
    const item = { id: uid(), amount: amt, category, date, notes };
    saveExpense(item);
    toast('Expense saved');
    expenseForm.reset();
    $('#expense-date').value = new Date().toISOString().slice(0, 10);
    renderAll();
});

budgetForm.addEventListener('submit', e => {
    e.preventDefault();
    const month = $('#budget-month').value || '';
    const category = $('#budget-category').value;
    const amount = Number($('#budget-amount').value);
    if (!category || !amount) { toast('Please fill required fields'); return; }
    const item = { id: uid(), month: month || '', category, amount };
    saveBudget(item);
    toast('Budget saved');
    budgetForm.addEventListener('submit', e => {
        e.preventDefault();
        const month = $('#budget-month').value || '';
        const category = $('#budget-category').value;
        const amount = Number($('#budget-amount').value);
        if (!category || !amount) { toast('Please fill required fields'); return; }

        const item = { id: uid(), month: month || '', category, amount };
        saveBudget(item);
        toast('Budget saved');


        $('#budget-amount').value = "";
        $('#budget-category').selectedIndex = 0;


        $('#budget-month').value = monthInput.value || maxMonth;

        renderAll();
    });

    renderAll();
});


document.body.addEventListener('click', (ev) => {
    const del = ev.target.closest('.btn-delete');
    if (del) {
        const id = del.dataset.id;
        const kind = del.dataset.kind;
        if (kind === 'income') { deleteIncome(id); toast('Income deleted'); }
        else if (kind === 'expense') { deleteExpense(id); toast('Expense deleted'); }
        renderAll();
        return;
    }
    const delBud = ev.target.closest('.del-budget');
    if (delBud) {
        const id = delBud.dataset.id;
        deleteBudgetById(id);
        toast('Budget removed');
        renderAll();
    }
});


monthInput.addEventListener('change', renderAll);



// restrict future months/dates
const maxMonth = today.toISOString().slice(0, 7);
monthInput.setAttribute("max", maxMonth);
$('#budget-month').setAttribute("max", maxMonth);
$('#income-date').setAttribute("max", today.toISOString().split("T")[0]);
$('#expense-date').setAttribute("max", today.toISOString().split("T")[0]);

// keep forms in sync with month selector
monthInput.addEventListener("change", () => {
    const selectedMonth = monthInput.value;
    if (!selectedMonth) return;


    $('#budget-month').value = selectedMonth;


    $('#income-date').value = `${selectedMonth}-01`;
    $('#expense-date').value = `${selectedMonth}-01`;

    renderAll();
});


if (!monthInput.value) {
    monthInput.value = maxMonth;
    $('#budget-month').value = maxMonth;
    $('#income-date').value = today.toISOString().split("T")[0];
    $('#expense-date').value = today.toISOString().split("T")[0];
}

//group ManageMent
function createGroup(name, members) {
    const user = getCurrentUser();
    const userData = getUserData(user);

    const newGroup = {
        groupId: Date.now().toString(),
        name,
        members,
        expenses: [],
        settlements: []
    };

    userData.groups = userData.groups || [];
    userData.groups.push(newGroup);
    saveUserData(user, userData);
    alert(`Group "${name}" created successfully!`);
    renderGroups();
}

function addGroupExpense(groupId, payer, amount, description) {
    const user = getCurrentUser();
    const userData = getUserData(user);

    const group = userData.groups.find(g => g.groupId === groupId);
    if (!group) return;

    group.expenses.push({ payer, amount: Number(amount), description });
    saveUserData(user, userData);
    alert(`Expense added to group "${group.name}"`);
    renderGroups();
}

function calculateBalances(group) {
    const balances = {};
    const members = group.members;
    const totalSpent = group.expenses.reduce((sum, e) => sum + e.amount, 0);
    const share = totalSpent / members.length;

    members.forEach(m => balances[m] = -share);
    group.expenses.forEach(e => balances[e.payer] += e.amount);

    return balances;
}

function renderGroups() {
    const user = getCurrentUser();
    const userData = getUserData(user);

    const container = document.getElementById("group-list");
    container.innerHTML = "";

    (userData.groups || []).forEach(group => {
        const balances = calculateBalances(group);
        const div = document.createElement("div");
        div.className = "group-card";

        div.innerHTML = `
            <h3>${group.name}</h3>
            <p>Members: ${group.members.join(", ")}</p>
            <h4>Expenses:</h4>
            <ul>
                ${group.expenses.map(e => `<li>${e.payer} paid ${e.amount} (${e.description})</li>`).join("")}
            </ul>
            <h4>Balances:</h4>
            <ul>
                ${Object.keys(balances).map(m => `<li>${m}: ${balances[m]}</li>`).join("")}
            </ul>
        `;
        container.appendChild(div);
    });
}
function renderGroupInfo(index) {
    const group = groups[index];
    const groupInfo = document.getElementById("group-info");

    if (!group) {
        groupInfo.innerHTML = "<p>Select a group to see details</p>";
        return;
    }

    //expenses list
    let expensesHTML = "";
    if (group.expenses.length > 0) {
        expensesHTML = group.expenses.map(exp => `
            <li>
                <strong>${exp.payer}</strong> paid 
                <span style="color:lime;">₹${exp.amount.toFixed(2)}</span> 
                for ${exp.description || "No description"} 
                <small>(${exp.date})</small>
            </li>
        `).join("");
    } else {
        expensesHTML = "<p>No expenses yet.</p>";
    }

    const balances = {};
    let total = 0;


    group.members.forEach(m => balances[m] = 0);


    group.expenses.forEach(exp => {
        balances[exp.payer] += exp.amount;
        total += exp.amount;
    });

    const share = total / group.members.length;


    group.members.forEach(m => {
        balances[m] = balances[m] - share;
    });


    let balancesHTML = Object.entries(balances).map(([member, bal]) => {
        const color = bal >= 0 ? "lime" : "red";
        const text = bal >= 0 ? "should receive" : "owes";
        return `<li><strong>${member}</strong> ${text} 
                <span style="color:${color};">₹${Math.abs(bal).toFixed(2)}</span></li>`;
    }).join("");

    //Final Render
    groupInfo.innerHTML = `
        <h3>${group.name}</h3>
        <p><strong>Members:</strong> ${group.members.join(", ")}</p>
        <h4>Expenses:</h4>
        <ul>${expensesHTML}</ul>
        <h4>Settlement:</h4>
        <ul>${balancesHTML}</ul>
        <p><em>Total spent: ₹${total.toFixed(2)}, each share: ₹${share.toFixed(2)}</em></p>
    `;
}


document.getElementById("group-select").addEventListener("change", (e) => {
    renderGroupInfo(e.target.value);
});




(function init() {
    populateCategoryDropdowns();

    $('#income-date').value = new Date().toISOString().slice(0, 10);
    $('#expense-date').value = new Date().toISOString().slice(0, 10);


    $('#budget-month').value = monthInput.value || maxMonth;


    incomes = incomes || [];
    expenses = expenses || [];
    budgets = budgets || [];

    renderAll();
})();

//AUTH
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const appContainer = document.getElementById("app-container");
const authContainer = document.getElementById("auth-container");

let isLogin = true;


function getCurrentUser() {
    return localStorage.getItem("currentUser");
}

function getUserData(username) {
    return JSON.parse(localStorage.getItem(username));
}

function saveUserData(username, data) {
    localStorage.setItem(username, JSON.stringify(data));
}

//LOGIN/SIGNUP
document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "switch-to-signup") {
        e.preventDefault();
        isLogin = !isLogin;
        authTitle.textContent = isLogin ? "Login" : "Sign Up";
        authForm.querySelector("button").textContent = isLogin ? "Login" : "Sign Up";
        document.getElementById("toggle-auth").innerHTML = isLogin
            ? `Don’t have an account? <a href="#" id="switch-to-signup">Sign up</a>`
            : `Already have an account? <a href="#" id="switch-to-signup">Login</a>`;
    }
});


authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) return alert("Enter username and password");

    if (isLogin) {

        const storedUser = getUserData(username);
        if (!storedUser || storedUser.password !== password) {
            alert("Invalid credentials!");
            return;
        }
        localStorage.setItem("currentUser", username);
        loadApp();
    } else {

        if (localStorage.getItem(username)) {
            alert("User already exists!");
            return;
        }
        localStorage.setItem(
            username,
            JSON.stringify({ password, transactions: [], budgets: [], groups: [] })
        );
        alert("Signup successful! You can login now.");
        isLogin = true;
        authTitle.textContent = "Login";
        authForm.querySelector("button").textContent = "Login";
    }
});


function loadApp() {
    authContainer.style.display = "none";
    appContainer.style.display = "block";

    const username = getCurrentUser();
    if (!username) return;

    const userData = getUserData(username);

    if (!userData) {
        alert("Error: User not found.");
        logout();
        return;
    }

    console.log("✅ Logged in as:", username);

}


function logout() {
    localStorage.removeItem("currentUser");
    appContainer.style.display = "none";
    authContainer.style.display = "block";
}


document.addEventListener("DOMContentLoaded", () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
        loadApp();
    } else {
        authContainer.style.display = "block";
        appContainer.style.display = "none";
    }
});

//GROUP MANAGEMENT
let groups = [];


function loadGroups() {
    groups = JSON.parse(localStorage.getItem("groups")) || [];
    renderGroups();
}


function saveGroups() {
    localStorage.setItem("groups", JSON.stringify(groups));
}

function renderGroups() {
    const groupList = document.getElementById("group-list");
    groupList.innerHTML = "";

    groups.forEach((group, index) => {
        const div = document.createElement("div");
        div.className = "group-item";
        div.innerHTML = `
            <strong>${group.name}</strong> 
            <small>(${group.members.join(", ")})</small>
            <button class="btn-delete" onclick="removeGroup(${index})">Remove</button>
        `;
        groupList.appendChild(div);
    });

    updateGroupDropdown();
}


function removeGroup(index) {
    groups.splice(index, 1);
    saveGroups();
    renderGroups();
}


function updateGroupDropdown() {
    const groupSelect = document.getElementById("group-select");
    groupSelect.innerHTML = "";

    groups.forEach((group, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = group.name;
        groupSelect.appendChild(option);
    });


    groupSelect.dispatchEvent(new Event("change"));
}


document.getElementById("group-select").addEventListener("change", (e) => {
    const groupIndex = e.target.value;
    const payerSelect = document.getElementById("payer");

    payerSelect.innerHTML = "";
    if (groups[groupIndex]) {
        groups[groupIndex].members.forEach(member => {
            const option = document.createElement("option");
            option.value = member;
            option.textContent = member;
            payerSelect.appendChild(option);
        });
    }
});


document.getElementById("group-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("group-name").value.trim();
    const members = document.getElementById("group-members").value.split(",").map(m => m.trim()).filter(m => m);

    if (!name || members.length === 0) {
        alert("Please enter group name and at least one member");
        return;
    }

    groups.push({ name, members, expenses: [] });
    saveGroups();
    renderGroups();

    e.target.reset();
});


document.getElementById("group-expense-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const groupIndex = document.getElementById("group-select").value;
    const payer = document.getElementById("payer").value;
    const amount = parseFloat(document.getElementById("group-amount").value);
    const description = document.getElementById("group-description").value;

    if (!groups[groupIndex]) return;

    groups[groupIndex].expenses.push({
        payer,
        amount,
        description,
        date: new Date().toISOString().split("T")[0]
    });

    saveGroups();
    renderGroupInfo(groupIndex);

    e.target.reset();
});



document.addEventListener("DOMContentLoaded", loadGroups);
