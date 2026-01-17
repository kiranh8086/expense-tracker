/**
 * SplitTrip - Expense Tracker
 * A mobile-friendly app for splitting trip expenses equally
 * Supports multiple trips with automatic CSV file management
 */

// ===================================
// Constants & State
// ===================================

const DB_NAME = 'SplitTripDB';
const DB_VERSION = 1;
const STORE_NAME = 'folderHandle';

let db = null;
let directoryHandle = null;
let currentTripFileHandle = null;
let currentTripFileName = null;

let appData = {
    trip: { name: '', currency: '₹', members: [] },
    expenses: []
};

// ===================================
// IndexedDB for storing folder handle
// ===================================

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function saveFolderHandle(handle) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(handle, 'directoryHandle');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function loadFolderHandle() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('directoryHandle');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ===================================
// CSV Handling
// ===================================

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
    const newData = {
        trip: { name: '', currency: '₹', members: [] },
        expenses: []
    };
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('#TRIP')) {
            const match = line.match(/#TRIP,(?:"([^"]*)"|([^,]*)),(?:"([^"]*)"|([^,]*)),(?:"([^"]*)"|([^,]*))/);
            if (match) {
                newData.trip.name = match[1] || match[2] || '';
                newData.trip.currency = match[3] || match[4] || '₹';
                const membersStr = match[5] || match[6] || '';
                newData.trip.members = membersStr ? membersStr.split('|').filter(m => m.trim()) : [];
            }
        } else if (line.startsWith('#HEADERS')) {
            continue;
        } else {
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

function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
}

// ===================================
// File System Operations
// ===================================

async function requestFolderAccess() {
    try {
        directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        await saveFolderHandle(directoryHandle);
        return true;
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Error accessing folder:', e);
            showToast('Error accessing folder', 'error');
        }
        return false;
    }
}

async function verifyFolderPermission() {
    if (!directoryHandle) return false;
    
    try {
        const permission = await directoryHandle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') return true;
        
        const requestResult = await directoryHandle.requestPermission({ mode: 'readwrite' });
        return requestResult === 'granted';
    } catch (e) {
        return false;
    }
}

async function listTripFiles() {
    if (!directoryHandle) return [];
    
    const trips = [];
    try {
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                const file = await entry.getFile();
                const text = await file.text();
                
                // Parse trip name from CSV
                const match = text.match(/#TRIP,(?:"([^"]*)"|([^,]*))/);
                const tripName = match ? (match[1] || match[2] || entry.name) : entry.name.replace('.csv', '');
                
                trips.push({
                    fileName: entry.name,
                    tripName: tripName,
                    lastModified: file.lastModified
                });
            }
        }
    } catch (e) {
        console.error('Error listing files:', e);
    }
    
    // Sort by last modified, newest first
    trips.sort((a, b) => b.lastModified - a.lastModified);
    return trips;
}

async function createTripFile(tripName, currency, members) {
    if (!directoryHandle) {
        showToast('No folder access', 'error');
        return false;
    }
    
    const fileName = sanitizeFileName(tripName) + '.csv';
    
    try {
        // Check if file already exists
        try {
            await directoryHandle.getFileHandle(fileName);
            showToast('A trip with this name already exists', 'error');
            return false;
        } catch (e) {
            // File doesn't exist, good to create
        }
        
        // Create new file
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        
        // Set up app data
        appData = {
            trip: { name: tripName, currency, members },
            expenses: []
        };
        
        // Write to file
        const csvContent = dataToCSV();
        const writable = await fileHandle.createWritable();
        await writable.write(csvContent);
        await writable.close();
        
        currentTripFileHandle = fileHandle;
        currentTripFileName = fileName;
        
        return true;
    } catch (e) {
        console.error('Error creating trip file:', e);
        showToast('Error creating trip file', 'error');
        return false;
    }
}

async function loadTripFile(fileName) {
    if (!directoryHandle) return false;
    
    try {
        const fileHandle = await directoryHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const text = await file.text();
        
        appData = csvToData(text);
        currentTripFileHandle = fileHandle;
        currentTripFileName = fileName;
        
        return true;
    } catch (e) {
        console.error('Error loading trip file:', e);
        showToast('Error loading trip', 'error');
        return false;
    }
}

async function saveCurrentTrip() {
    if (!currentTripFileHandle) return;
    
    try {
        const csvContent = dataToCSV();
        const writable = await currentTripFileHandle.createWritable();
        await writable.write(csvContent);
        await writable.close();
    } catch (e) {
        console.error('Error saving trip:', e);
        showToast('Error saving changes', 'error');
    }
}

async function deleteCurrentTrip() {
    if (!directoryHandle || !currentTripFileName) return false;
    
    try {
        await directoryHandle.removeEntry(currentTripFileName);
        currentTripFileHandle = null;
        currentTripFileName = null;
        appData = { trip: { name: '', currency: '₹', members: [] }, expenses: [] };
        return true;
    } catch (e) {
        console.error('Error deleting trip:', e);
        showToast('Error deleting trip', 'error');
        return false;
    }
}

// ===================================
// DOM Elements
// ===================================

const elements = {
    // Screens
    tripSelectorScreen: document.getElementById('tripSelectorScreen'),
    appContainer: document.getElementById('appContainer'),
    
    // Folder Access
    folderAccessSection: document.getElementById('folderAccessSection'),
    tripSelectionSection: document.getElementById('tripSelectionSection'),
    grantFolderAccessBtn: document.getElementById('grantFolderAccessBtn'),
    changeFolderBtn: document.getElementById('changeFolderBtn'),
    folderPath: document.getElementById('folderPath'),
    
    // Trip Selection
    createNewTripBtn: document.getElementById('createNewTripBtn'),
    tripsList: document.getElementById('tripsList'),
    
    // New Trip Modal
    newTripModal: document.getElementById('newTripModal'),
    closeNewTripModal: document.getElementById('closeNewTripModal'),
    newTripForm: document.getElementById('newTripForm'),
    newTripName: document.getElementById('newTripName'),
    newTripCurrency: document.getElementById('newTripCurrency'),
    newTripMembersInput: document.getElementById('newTripMembersInput'),
    newTripAddMemberBtn: document.getElementById('newTripAddMemberBtn'),
    
    // Header
    backToTripsBtn: document.getElementById('backToTripsBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    
    // Trip Banner
    tripName: document.getElementById('tripName'),
    tripMembers: document.getElementById('tripMembers'),
    totalAmount: document.getElementById('totalAmount'),
    
    // Tabs
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Lists
    expensesList: document.getElementById('expensesList'),
    balancesList: document.getElementById('balancesList'),
    settleList: document.getElementById('settleList'),
    
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
    currencySymbol: document.getElementById('currencySymbol'),
    
    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    settingsForm: document.getElementById('settingsForm'),
    tripNameInput: document.getElementById('tripNameInput'),
    currencySelect: document.getElementById('currencySelect'),
    membersInput: document.getElementById('membersInput'),
    addMemberBtn: document.getElementById('addMemberBtn'),
    deleteTripBtn: document.getElementById('deleteTripBtn'),
    
    // Toast
    toast: document.getElementById('toast')
};

// ===================================
// Initialization
// ===================================

async function init() {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
        showToast('Your browser does not support folder access. Please use Chrome or Edge.', 'error');
        return;
    }
    
    await initDB();
    
    // Try to load saved folder handle
    try {
        directoryHandle = await loadFolderHandle();
        if (directoryHandle && await verifyFolderPermission()) {
            showTripSelection();
        } else {
            directoryHandle = null;
            showFolderAccess();
        }
    } catch (e) {
        showFolderAccess();
    }
    
    setupEventListeners();
}

function setupEventListeners() {
    // Folder Access
    elements.grantFolderAccessBtn.addEventListener('click', handleGrantFolderAccess);
    elements.changeFolderBtn.addEventListener('click', handleGrantFolderAccess);
    
    // Trip Selection
    elements.createNewTripBtn.addEventListener('click', openNewTripModal);
    
    // New Trip Modal
    elements.closeNewTripModal.addEventListener('click', closeNewTripModal);
    elements.newTripModal.addEventListener('click', (e) => {
        if (e.target === elements.newTripModal) closeNewTripModal();
    });
    elements.newTripForm.addEventListener('submit', handleCreateNewTrip);
    elements.newTripAddMemberBtn.addEventListener('click', () => addMemberRowTo(elements.newTripMembersInput));
    
    // Back to trips
    elements.backToTripsBtn.addEventListener('click', backToTripSelector);
    
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
    elements.addMemberBtn.addEventListener('click', () => addMemberRowTo(elements.membersInput, true));
    elements.deleteTripBtn.addEventListener('click', handleDeleteTrip);
}

// ===================================
// Screen Navigation
// ===================================

function showFolderAccess() {
    elements.folderAccessSection.style.display = 'block';
    elements.tripSelectionSection.style.display = 'none';
}

async function showTripSelection() {
    elements.folderAccessSection.style.display = 'none';
    elements.tripSelectionSection.style.display = 'block';
    elements.folderPath.textContent = directoryHandle.name;
    
    await refreshTripsList();
}

async function refreshTripsList() {
    const trips = await listTripFiles();
    
    if (trips.length === 0) {
        elements.tripsList.innerHTML = `
            <div class="empty-trips">
                <p>No trips yet. Create your first trip!</p>
            </div>
        `;
        return;
    }
    
    elements.tripsList.innerHTML = trips.map(trip => `
        <div class="trip-card" data-filename="${trip.fileName}">
            <div class="trip-card-info">
                <span class="trip-card-name">${escapeHtml(trip.tripName)}</span>
                <span class="trip-card-meta">${new Date(trip.lastModified).toLocaleDateString()}</span>
            </div>
            <span class="trip-card-arrow">→</span>
        </div>
    `).join('');
    
    // Add click handlers
    elements.tripsList.querySelectorAll('.trip-card').forEach(card => {
        card.addEventListener('click', () => openTrip(card.dataset.filename));
    });
}

function showMainApp() {
    elements.tripSelectorScreen.style.display = 'none';
    elements.appContainer.style.display = 'flex';
    renderUI();
}

function backToTripSelector() {
    elements.appContainer.style.display = 'none';
    elements.tripSelectorScreen.style.display = 'block';
    currentTripFileHandle = null;
    currentTripFileName = null;
    refreshTripsList();
}

// ===================================
// Folder Access Handlers
// ===================================

async function handleGrantFolderAccess() {
    const success = await requestFolderAccess();
    if (success) {
        showTripSelection();
    }
}

// ===================================
// New Trip Modal
// ===================================

function openNewTripModal() {
    // Reset form
    elements.newTripForm.reset();
    elements.newTripMembersInput.innerHTML = '';
    
    // Add 4 default member rows
    for (let i = 0; i < 4; i++) {
        addMemberRowTo(elements.newTripMembersInput, false, i === 0);
    }
    
    elements.newTripModal.classList.add('active');
    elements.newTripName.focus();
}

function closeNewTripModal() {
    elements.newTripModal.classList.remove('active');
}

async function handleCreateNewTrip(e) {
    e.preventDefault();
    
    const tripName = elements.newTripName.value.trim();
    const currency = elements.newTripCurrency.value;
    
    const memberInputs = elements.newTripMembersInput.querySelectorAll('.member-name');
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
    
    const uniqueMembers = [...new Set(members)];
    if (uniqueMembers.length !== members.length) {
        showToast('Member names must be unique', 'error');
        return;
    }
    
    // Create trip file
    const success = await createTripFile(tripName, currency, uniqueMembers);
    if (success) {
        closeNewTripModal();
        showMainApp();
        showToast('Trip created!', 'success');
    }
}

// ===================================
// Open Existing Trip
// ===================================

async function openTrip(fileName) {
    const success = await loadTripFile(fileName);
    if (success) {
        showMainApp();
    }
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
    
    trip.members.forEach(member => {
        balances[member] = 0;
    });
    
    expenses.forEach(expense => {
        const splitAmount = expense.amount / expense.splitBetween.length;
        
        if (balances[expense.paidBy] !== undefined) {
            balances[expense.paidBy] += expense.amount;
        }
        
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
    
    const debtors = [];
    const creditors = [];
    
    Object.entries(balances).forEach(([name, balance]) => {
        if (balance < -0.01) {
            debtors.push({ name, amount: Math.abs(balance) });
        } else if (balance > 0.01) {
            creditors.push({ name, amount: balance });
        }
    });
    
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    
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
    
    elements.paidBy.innerHTML = '<option value="">Select who paid</option>' +
        members.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    
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
    
    checkboxes.forEach(cb => { cb.checked = !allChecked; });
    elements.selectAllBtn.textContent = allChecked ? 'Select All' : 'Deselect All';
}

async function handleAddExpense(e) {
    e.preventDefault();
    
    const description = elements.expenseDesc.value.trim();
    const amount = parseFloat(elements.expenseAmount.value);
    const paidBy = elements.paidBy.value;
    
    const splitCheckboxes = elements.splitOptions.querySelectorAll('input[type="checkbox"]:checked');
    const splitBetween = Array.from(splitCheckboxes).map(cb => cb.value);
    
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
    
    const expense = {
        id: generateId(),
        description,
        amount,
        paidBy,
        splitBetween,
        timestamp: Date.now()
    };
    
    appData.expenses.push(expense);
    await saveCurrentTrip();
    renderUI();
    closeExpenseModal();
    
    showToast('Expense added!', 'success');
}

async function deleteExpense(id) {
    if (confirm('Delete this expense?')) {
        appData.expenses = appData.expenses.filter(e => e.id !== id);
        await saveCurrentTrip();
        renderUI();
        showToast('Expense deleted', 'success');
    }
}

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
    
    elements.membersInput.innerHTML = '';
    
    if (trip.members.length > 0) {
        trip.members.forEach((member, index) => {
            addMemberRowTo(elements.membersInput, true, index === 0, member);
        });
    } else {
        for (let i = 0; i < 4; i++) {
            addMemberRowTo(elements.membersInput, true, i === 0);
        }
    }
}

function addMemberRowTo(container, isSettings = false, isFirst = false, value = '') {
    const memberRows = container.querySelectorAll('.member-row').length;
    
    if (memberRows >= 10) {
        showToast('Maximum 10 members allowed', 'error');
        return;
    }
    
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
        <input type="text" class="member-name" placeholder="Member ${memberRows + 1} name" value="${escapeHtml(value)}" required>
        <button type="button" class="btn-remove-member">&times;</button>
    `;
    
    row.querySelector('.btn-remove-member').addEventListener('click', () => {
        const rows = container.querySelectorAll('.member-row');
        if (rows.length > 4) {
            row.remove();
            updateMemberRowsState(container);
        } else {
            showToast('Minimum 4 members required', 'error');
        }
    });
    
    container.appendChild(row);
    updateMemberRowsState(container);
}

function updateMemberRowsState(container) {
    const rows = container.querySelectorAll('.member-row');
    rows.forEach((row, index) => {
        const input = row.querySelector('.member-name');
        const btn = row.querySelector('.btn-remove-member');
        input.placeholder = `Member ${index + 1} name`;
        btn.disabled = rows.length <= 4;
    });
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    const tripName = elements.tripNameInput.value.trim();
    const currency = elements.currencySelect.value;
    
    const memberInputs = elements.membersInput.querySelectorAll('.member-name');
    const members = Array.from(memberInputs)
        .map(input => input.value.trim())
        .filter(name => name.length > 0);
    
    if (!tripName) {
        showToast('Please enter a trip name', 'error');
        return;
    }
    
    if (members.length < 4) {
        showToast('Please add at least 4 members', 'error');
        return;
    }
    
    const uniqueMembers = [...new Set(members)];
    if (uniqueMembers.length !== members.length) {
        showToast('Member names must be unique', 'error');
        return;
    }
    
    // Check if members changed with existing expenses
    const oldMembers = appData.trip.members;
    const membersChanged = JSON.stringify([...oldMembers].sort()) !== JSON.stringify([...uniqueMembers].sort());
    
    if (membersChanged && appData.expenses.length > 0) {
        if (!confirm('Changing members will clear all expenses. Continue?')) {
            return;
        }
        appData.expenses = [];
    }
    
    appData.trip.name = tripName;
    appData.trip.currency = currency;
    appData.trip.members = uniqueMembers;
    
    await saveCurrentTrip();
    renderUI();
    closeSettingsModal();
    
    showToast('Settings saved!', 'success');
}

async function handleDeleteTrip() {
    if (confirm('Delete this trip and all its expenses?')) {
        if (confirm('This cannot be undone. Are you sure?')) {
            const success = await deleteCurrentTrip();
            if (success) {
                showToast('Trip deleted', 'success');
                backToTripSelector();
            }
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

