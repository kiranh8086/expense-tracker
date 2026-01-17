/**
 * SplitTrip - Expense Tracker
 * A mobile-friendly app for splitting trip expenses equally
 * Data stored in CSV format
 */

// ===================================
// Data Management
// ===================================

const STORAGE_KEY = 'splittrip_data';

const defaultData = {
    trip: {
        name: '',
        currency: '₹',
        members: []
    },
    expenses: []
};

let appData = loadFromLocalStorage();
let csvFileHandle = null; // For File System Access API

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }
    return JSON.parse(JSON.stringify(defaultData));
}

function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.error('Error saving data:', e);
    }
}

// ===================================
// CSV Handling
// ===================================

/**
 * CSV Format:
 * Line 1: #TRIP,<name>,<currency>,<member1>|<member2>|...
 * Line 2: #HEADERS,id,description,amount,paidBy,splitBetween,timestamp
 * Line 3+: <expense data>
 */

function dataToCSV() {
    const { trip, expenses } = appData;
    const lines = [];
    
    // Trip info line
    const membersStr = trip.members.join('|');
    lines.push(`#TRIP,"${escapeCsvField(trip.name)}","${trip.currency}","${membersStr}"`);
    
    // Headers
    lines.push('#HEADERS,id,description,amount,paidBy,splitBetween,timestamp,date');
    
    // Expense lines
    expenses.forEach(exp => {
        const splitStr = exp.splitBetween.join('|');
        const date = new Date(exp.timestamp).toLocaleDateString('en-IN');
        lines.push([
            escapeCsvField(exp.id),
            escapeCsvField(exp.description),
            exp.amount,
            escapeCsvField(exp.paidBy),
            escapeCsvField(splitStr),
            exp.timestamp,
            date
        ].join(','));
    });
    
    return lines.join('\n');
}

function csvToData(csvText) {
    const lines = csvText.trim().split('\n');
    const newData = JSON.parse(JSON.stringify(defaultData));
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('#TRIP')) {
            // Parse trip info: #TRIP,"name","currency","member1|member2"
            const match = line.match(/#TRIP,(?:"([^"]*)"|([^,]*)),(?:"([^"]*)"|([^,]*)),(?:"([^"]*)"|([^,]*))/);
            if (match) {
                newData.trip.name = match[1] || match[2] || '';
                newData.trip.currency = match[3] || match[4] || '₹';
                const membersStr = match[5] || match[6] || '';
                newData.trip.members = membersStr ? membersStr.split('|').filter(m => m.trim()) : [];
            }
        } else if (line.startsWith('#HEADERS')) {
            // Skip headers line
            continue;
        } else {
            // Parse expense line
            const parts = parseCSVLine(line);
            if (parts.length >= 6) {
                newData.expenses.push({
                    id: parts[0] || generateId(),
                    description: parts[1] || '',
                    amount: parseFloat(parts[2]) || 0,
                    paidBy: parts[3] || '',
                    splitBetween: parts[4] ? parts[4].split('|').filter(m => m.trim()) : [],
                    timestamp: parseInt(parts[5]) || Date.now()
                });
            }
        }
    }
    
    return newData;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    
    return result;
}

function escapeCsvField(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

// Load CSV from file
async function loadCSVFile() {
    try {
        // Check if File System Access API is available
        if ('showOpenFilePicker' in window) {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'CSV Files',
                    accept: { 'text/csv': ['.csv'] }
                }],
                multiple: false
            });
            
            csvFileHandle = fileHandle;
            const file = await fileHandle.getFile();
            const text = await file.text();
            
            appData = csvToData(text);
            saveToLocalStorage();
            renderUI();
            updateCsvStatus(fileHandle.name);
            showToast('CSV loaded successfully!', 'success');
            
        } else {
            // Fallback: Use file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const text = await file.text();
                    appData = csvToData(text);
                    saveToLocalStorage();
                    renderUI();
                    updateCsvStatus(file.name + ' (read-only)');
                    showToast('CSV loaded! Export to save changes.', 'success');
                }
            };
            input.click();
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Error loading CSV:', e);
            showToast('Error loading CSV file', 'error');
        }
    }
}

// Save CSV to file
async function saveCSVFile() {
    try {
        const csvContent = dataToCSV();
        
        // Check if File System Access API is available
        if ('showSaveFilePicker' in window) {
            const options = {
                suggestedName: `${appData.trip.name || 'expenses'}.csv`,
                types: [{
                    description: 'CSV Files',
                    accept: { 'text/csv': ['.csv'] }
                }]
            };
            
            // If we have an existing file handle, try to write to it
            let fileHandle;
            if (csvFileHandle) {
                try {
                    // Verify we still have permission
                    const permission = await csvFileHandle.queryPermission({ mode: 'readwrite' });
                    if (permission === 'granted') {
                        fileHandle = csvFileHandle;
                    }
                } catch (e) {
                    // Permission lost, show picker
                }
            }
            
            if (!fileHandle) {
                fileHandle = await window.showSaveFilePicker(options);
                csvFileHandle = fileHandle;
            }
            
            const writable = await fileHandle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            
            updateCsvStatus(fileHandle.name);
            showToast('CSV saved!', 'success');
            
        } else {
            // Fallback: Download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${appData.trip.name || 'expenses'}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            showToast('CSV downloaded!', 'success');
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Error saving CSV:', e);
            showToast('Error saving CSV file', 'error');
        }
    }
}

// Auto-save to CSV if we have a file handle
async function autoSaveCSV() {
    if (csvFileHandle) {
        try {
            const permission = await csvFileHandle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                const csvContent = dataToCSV();
                const writable = await csvFileHandle.createWritable();
                await writable.write(csvContent);
                await writable.close();
            }
        } catch (e) {
            console.error('Auto-save failed:', e);
        }
    }
}

function updateCsvStatus(filename) {
    const statusEl = document.getElementById('csvStatus');
    if (filename) {
        statusEl.textContent = `📄 ${filename}`;
        statusEl.classList.add('active');
    } else {
        statusEl.textContent = 'No file loaded - using browser storage';
        statusEl.classList.remove('active');
    }
}

// Combined save function
function saveData() {
    saveToLocalStorage();
    autoSaveCSV();
}

// ===================================
// DOM Elements
// ===================================

const elements = {
    // Header
    settingsBtn: document.getElementById('settingsBtn'),
    
    // Trip Banner
    tripName: document.getElementById('tripName'),
    tripMembers: document.getElementById('tripMembers'),
    totalAmount: document.getElementById('totalAmount'),
    currencySymbol: document.getElementById('currencySymbol'),
    
    // Tabs
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Lists
    expensesList: document.getElementById('expensesList'),
    balancesList: document.getElementById('balancesList'),
    settleList: document.getElementById('settleList'),
    emptyExpenses: document.getElementById('emptyExpenses'),
    
    // FAB
    addExpenseBtn: document.getElementById('addExpenseBtn'),
    
    // Expense Modal
    expenseModal: document.getElementById('expenseModal'),
    closeExpenseModal: document.getElementById('closeExpenseModal'),
    expenseForm: document.getElementById('expenseForm'),
    expenseDesc: document.getElementById('expenseDesc'),
    expenseAmount: document.getElementById('expenseAmount'),
    paidBy: document.getElementById('paidBy'),
    splitOptions: document.getElementById('splitOptions'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    
    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    settingsForm: document.getElementById('settingsForm'),
    tripNameInput: document.getElementById('tripNameInput'),
    currencySelect: document.getElementById('currencySelect'),
    membersInput: document.getElementById('membersInput'),
    addMemberBtn: document.getElementById('addMemberBtn'),
    clearDataBtn: document.getElementById('clearDataBtn'),
    loadCsvBtn: document.getElementById('loadCsvBtn'),
    saveCsvBtn: document.getElementById('saveCsvBtn'),
    
    // Toast
    toast: document.getElementById('toast')
};

// ===================================
// Initialization
// ===================================

function init() {
    setupEventListeners();
    renderUI();
    
    // Show settings modal if no trip configured
    if (!appData.trip.name || appData.trip.members.length === 0) {
        setTimeout(() => openSettingsModal(), 500);
    }
}

function setupEventListeners() {
    // Tabs
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // FAB
    elements.addExpenseBtn.addEventListener('click', openExpenseModal);
    
    // Settings
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    
    // Expense Modal
    elements.closeExpenseModal.addEventListener('click', closeExpenseModal);
    elements.expenseModal.addEventListener('click', (e) => {
        if (e.target === elements.expenseModal) closeExpenseModal();
    });
    elements.expenseForm.addEventListener('submit', handleAddExpense);
    elements.selectAllBtn.addEventListener('click', toggleSelectAll);
    
    // Settings Modal
    elements.closeSettingsModal.addEventListener('click', closeSettingsModal);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettingsModal();
    });
    elements.settingsForm.addEventListener('submit', handleSaveSettings);
    elements.addMemberBtn.addEventListener('click', addMemberRow);
    elements.clearDataBtn.addEventListener('click', handleClearData);
    
    // CSV buttons
    elements.loadCsvBtn.addEventListener('click', loadCSVFile);
    elements.saveCsvBtn.addEventListener('click', saveCSVFile);
    
    // Prevent body scroll when modal is open
    document.addEventListener('touchmove', (e) => {
        if (document.querySelector('.modal-overlay.active')) {
            const modal = document.querySelector('.modal');
            if (!modal.contains(e.target)) {
                e.preventDefault();
            }
        }
    }, { passive: false });
}

// ===================================
// Tab Management
// ===================================

function switchTab(tabName) {
    elements.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // Refresh content when switching tabs
    if (tabName === 'balances') renderBalances();
    if (tabName === 'settle') renderSettlements();
}

// ===================================
// UI Rendering
// ===================================

function renderUI() {
    renderTripBanner();
    renderExpenses();
    renderBalances();
    renderSettlements();
    updateCurrencySymbols();
}

function renderTripBanner() {
    const { trip, expenses } = appData;
    
    elements.tripName.textContent = trip.name || 'No Trip Yet';
    elements.tripMembers.textContent = trip.members.length > 0 
        ? `${trip.members.length} members` 
        : 'Add members to start';
    
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    elements.totalAmount.textContent = `${trip.currency}${formatNumber(total)}`;
}

function renderExpenses() {
    const { expenses, trip } = appData;
    
    if (expenses.length === 0) {
        elements.expensesList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🧾</span>
                <p>No expenses yet</p>
                <p class="empty-hint">Tap + to add your first expense</p>
            </div>
        `;
        return;
    }
    
    // Sort by date, newest first
    const sorted = [...expenses].sort((a, b) => b.timestamp - a.timestamp);
    
    elements.expensesList.innerHTML = sorted.map(expense => `
        <div class="expense-card" data-id="${expense.id}">
            <div class="expense-info">
                <span class="expense-desc">${escapeHtml(expense.description)}</span>
                <div class="expense-meta">
                    <span class="expense-payer">Paid by ${escapeHtml(expense.paidBy)}</span>
                    <span>• Split ${expense.splitBetween.length} ways</span>
                </div>
            </div>
            <span class="expense-amount">${trip.currency}${formatNumber(expense.amount)}</span>
            <button class="expense-delete" onclick="deleteExpense('${expense.id}')" aria-label="Delete expense">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
            </button>
        </div>
    `).join('');
}

function renderBalances() {
    const balances = calculateBalances();
    const { trip } = appData;
    
    if (Object.keys(balances).length === 0) {
        elements.balancesList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚖️</span>
                <p>Add expenses to see balances</p>
            </div>
        `;
        return;
    }
    
    // Sort by balance amount
    const sorted = Object.entries(balances).sort((a, b) => b[1] - a[1]);
    
    elements.balancesList.innerHTML = sorted.map(([name, balance]) => {
        let balanceClass = 'neutral';
        let balanceText = `${trip.currency}0`;
        
        if (balance > 0.01) {
            balanceClass = 'positive';
            balanceText = `+${trip.currency}${formatNumber(balance)}`;
        } else if (balance < -0.01) {
            balanceClass = 'negative';
            balanceText = `-${trip.currency}${formatNumber(Math.abs(balance))}`;
        }
        
        return `
            <div class="balance-card">
                <span class="balance-name">${escapeHtml(name)}</span>
                <span class="balance-amount ${balanceClass}">${balanceText}</span>
            </div>
        `;
    }).join('');
}

function renderSettlements() {
    const settlements = calculateSettlements();
    const { trip } = appData;
    
    if (settlements.length === 0) {
        elements.settleList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🤝</span>
                <p>Nothing to settle yet</p>
                <p class="empty-hint">${appData.expenses.length === 0 ? 'Add some expenses first' : 'Everyone is settled up!'}</p>
            </div>
        `;
        return;
    }
    
    elements.settleList.innerHTML = settlements.map(s => `
        <div class="settle-card">
            <div class="settle-arrow">
                <span class="settle-from">${escapeHtml(s.from)}</span>
                <span class="settle-icon">→</span>
                <span class="settle-to">${escapeHtml(s.to)}</span>
            </div>
            <span class="settle-amount">${trip.currency}${formatNumber(s.amount)}</span>
        </div>
    `).join('');
}

function updateCurrencySymbols() {
    const symbol = appData.trip.currency || '₹';
    document.querySelectorAll('.currency-symbol').forEach(el => {
        el.textContent = symbol;
    });
}

// ===================================
// Balance Calculations
// ===================================

function calculateBalances() {
    const { expenses, trip } = appData;
    const balances = {};
    
    // Initialize all members with 0 balance
    trip.members.forEach(member => {
        balances[member] = 0;
    });
    
    // Calculate balances from expenses
    expenses.forEach(expense => {
        const splitAmount = expense.amount / expense.splitBetween.length;
        
        // Person who paid gets credit
        if (balances[expense.paidBy] !== undefined) {
            balances[expense.paidBy] += expense.amount;
        }
        
        // Each person in the split owes their share
        expense.splitBetween.forEach(person => {
            if (balances[person] !== undefined) {
                balances[person] -= splitAmount;
            }
        });
    });
    
    return balances;
}

function calculateSettlements() {
    const balances = calculateBalances();
    const settlements = [];
    
    // Create arrays of debtors (negative balance) and creditors (positive balance)
    const debtors = [];
    const creditors = [];
    
    Object.entries(balances).forEach(([name, balance]) => {
        if (balance < -0.01) {
            debtors.push({ name, amount: Math.abs(balance) });
        } else if (balance > 0.01) {
            creditors.push({ name, amount: balance });
        }
    });
    
    // Sort to optimize (largest debts first)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    
    // Match debtors with creditors
    let i = 0, j = 0;
    
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        
        const amount = Math.min(debtor.amount, creditor.amount);
        
        if (amount > 0.01) {
            settlements.push({
                from: debtor.name,
                to: creditor.name,
                amount: Math.round(amount * 100) / 100
            });
        }
        
        debtor.amount -= amount;
        creditor.amount -= amount;
        
        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }
    
    return settlements;
}

// ===================================
// Expense Modal
// ===================================

function openExpenseModal() {
    if (appData.trip.members.length === 0) {
        showToast('Please add members first', 'error');
        openSettingsModal();
        return;
    }
    
    populateExpenseForm();
    elements.expenseModal.classList.add('active');
    elements.expenseDesc.focus();
}

function closeExpenseModal() {
    elements.expenseModal.classList.remove('active');
    elements.expenseForm.reset();
}

function populateExpenseForm() {
    const { members } = appData.trip;
    
    // Populate "Paid by" select
    elements.paidBy.innerHTML = '<option value="">Select who paid</option>' +
        members.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    
    // Populate split options with all members checked by default
    elements.splitOptions.innerHTML = members.map(m => `
        <label class="split-option">
            <input type="checkbox" name="split" value="${escapeHtml(m)}" checked>
            <span>${escapeHtml(m)}</span>
        </label>
    `).join('');
}

function toggleSelectAll() {
    const checkboxes = elements.splitOptions.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    
    elements.selectAllBtn.textContent = allChecked ? 'Select All' : 'Deselect All';
}

function handleAddExpense(e) {
    e.preventDefault();
    
    const description = elements.expenseDesc.value.trim();
    const amount = parseFloat(elements.expenseAmount.value);
    const paidBy = elements.paidBy.value;
    
    const splitCheckboxes = elements.splitOptions.querySelectorAll('input[type="checkbox"]:checked');
    const splitBetween = Array.from(splitCheckboxes).map(cb => cb.value);
    
    // Validation
    if (!description) {
        showToast('Please enter a description', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    if (!paidBy) {
        showToast('Please select who paid', 'error');
        return;
    }
    
    if (splitBetween.length === 0) {
        showToast('Please select at least one person to split with', 'error');
        return;
    }
    
    // Create expense
    const expense = {
        id: generateId(),
        description,
        amount,
        paidBy,
        splitBetween,
        timestamp: Date.now()
    };
    
    appData.expenses.push(expense);
    saveData();
    renderUI();
    closeExpenseModal();
    
    showToast('Expense added!', 'success');
}

function deleteExpense(id) {
    if (confirm('Delete this expense?')) {
        appData.expenses = appData.expenses.filter(e => e.id !== id);
        saveData();
        renderUI();
        showToast('Expense deleted', 'success');
    }
}

// Make deleteExpense available globally
window.deleteExpense = deleteExpense;

// ===================================
// Settings Modal
// ===================================

function openSettingsModal() {
    populateSettingsForm();
    elements.settingsModal.classList.add('active');
}

function closeSettingsModal() {
    elements.settingsModal.classList.remove('active');
}

function populateSettingsForm() {
    const { trip } = appData;
    
    elements.tripNameInput.value = trip.name || '';
    elements.currencySelect.value = trip.currency || '₹';
    
    // Populate members
    elements.membersInput.innerHTML = '';
    
    if (trip.members.length > 0) {
        trip.members.forEach((member, index) => {
            addMemberRowWithValue(member, index === 0);
        });
    } else {
        // Add 4 empty rows for new trip (minimum members)
        for (let i = 0; i < 4; i++) {
            addMemberRow();
        }
    }
    
    updateRemoveButtons();
}

function addMemberRow() {
    addMemberRowWithValue('', false);
    updateRemoveButtons();
}

function addMemberRowWithValue(value, isFirst) {
    const memberRows = elements.membersInput.querySelectorAll('.member-row').length;
    
    if (memberRows >= 10) {
        showToast('Maximum 10 members allowed', 'error');
        return;
    }
    
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
        <input type="text" class="member-name" placeholder="Member ${memberRows + 1} name" value="${escapeHtml(value)}" required>
        <button type="button" class="btn-remove-member" ${isFirst ? 'disabled' : ''}>&times;</button>
    `;
    
    row.querySelector('.btn-remove-member').addEventListener('click', () => {
        row.remove();
        updateRemoveButtons();
        updatePlaceholders();
    });
    
    elements.membersInput.appendChild(row);
}

function updateRemoveButtons() {
    const rows = elements.membersInput.querySelectorAll('.member-row');
    const minMembers = 4;
    
    rows.forEach((row, index) => {
        const btn = row.querySelector('.btn-remove-member');
        btn.disabled = rows.length <= minMembers;
    });
    
    // Update add button state
    elements.addMemberBtn.disabled = rows.length >= 10;
    elements.addMemberBtn.textContent = rows.length >= 10 ? 'Max 10 members' : '+ Add Member';
}

function updatePlaceholders() {
    const inputs = elements.membersInput.querySelectorAll('.member-name');
    inputs.forEach((input, index) => {
        input.placeholder = `Member ${index + 1} name`;
    });
}

function handleSaveSettings(e) {
    e.preventDefault();
    
    const tripName = elements.tripNameInput.value.trim();
    const currency = elements.currencySelect.value;
    
    const memberInputs = elements.membersInput.querySelectorAll('.member-name');
    const members = Array.from(memberInputs)
        .map(input => input.value.trim())
        .filter(name => name.length > 0);
    
    // Validation
    if (!tripName) {
        showToast('Please enter a trip name', 'error');
        return;
    }
    
    if (members.length < 4) {
        showToast('Please add at least 4 members', 'error');
        return;
    }
    
    // Check for duplicate names
    const uniqueMembers = [...new Set(members)];
    if (uniqueMembers.length !== members.length) {
        showToast('Member names must be unique', 'error');
        return;
    }
    
    // Check if member names changed and there are expenses
    const oldMembers = appData.trip.members;
    const membersChanged = JSON.stringify(oldMembers.sort()) !== JSON.stringify(uniqueMembers.sort());
    
    if (membersChanged && appData.expenses.length > 0) {
        if (!confirm('Changing members will clear all expenses. Continue?')) {
            return;
        }
        appData.expenses = [];
    }
    
    // Save settings
    appData.trip.name = tripName;
    appData.trip.currency = currency;
    appData.trip.members = uniqueMembers;
    
    saveData();
    renderUI();
    closeSettingsModal();
    
    showToast('Settings saved!', 'success');
}

function handleClearData() {
    if (confirm('This will delete ALL data including expenses. Are you sure?')) {
        if (confirm('Really delete everything? This cannot be undone!')) {
            appData = JSON.parse(JSON.stringify(defaultData));
            csvFileHandle = null;
            saveToLocalStorage();
            updateCsvStatus(null);
            renderUI();
            closeSettingsModal();
            showToast('All data cleared', 'success');
            
            setTimeout(() => openSettingsModal(), 300);
        }
    }
}

// ===================================
// Utility Functions
// ===================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatNumber(num) {
    return num.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ===================================
// Start the app
// ===================================

document.addEventListener('DOMContentLoaded', init);
