/**
 * SplitTrip - Expense Tracker
 * Frontend JavaScript using Flask API
 */

// ===================================
// State
// ===================================

let currentTrip = null;
let currentTripId = null;

// ===================================
// API Helpers
// ===================================

async function api(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const response = await fetch(endpoint, { ...defaultOptions, ...options });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
}

// ===================================
// DOM Elements
// ===================================

const elements = {
    // Screens
    tripSelectorScreen: document.getElementById('tripSelectorScreen'),
    appContainer: document.getElementById('appContainer'),
    
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
    setupEventListeners();
    await loadTrips();
}

function setupEventListeners() {
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
// Trip List
// ===================================

async function loadTrips() {
    try {
        const trips = await api('/api/trips');
        renderTripsList(trips);
    } catch (error) {
        showToast('Error loading trips', 'error');
        console.error(error);
    }
}

function renderTripsList(trips) {
    if (trips.length === 0) {
        elements.tripsList.innerHTML = `
            <div class="empty-trips">
                <p>No trips yet. Create your first trip!</p>
            </div>
        `;
        return;
    }
    
    elements.tripsList.innerHTML = trips.map(trip => `
        <div class="trip-card" data-id="${trip.id}">
            <div class="trip-card-info">
                <span class="trip-card-name">${escapeHtml(trip.name)}</span>
                <span class="trip-card-meta">${trip.expense_count} expenses • ${trip.currency}${formatNumber(trip.total_amount)}</span>
            </div>
            <span class="trip-card-arrow">→</span>
        </div>
    `).join('');
    
    // Add click handlers
    elements.tripsList.querySelectorAll('.trip-card').forEach(card => {
        card.addEventListener('click', () => openTrip(parseInt(card.dataset.id)));
    });
}

// ===================================
// Screen Navigation
// ===================================

function showMainApp() {
    elements.tripSelectorScreen.style.display = 'none';
    elements.appContainer.style.display = 'flex';
    renderUI();
}

function backToTripSelector() {
    elements.appContainer.style.display = 'none';
    elements.tripSelectorScreen.style.display = 'block';
    currentTrip = null;
    currentTripId = null;
    loadTrips();
}

// ===================================
// New Trip Modal
// ===================================

function openNewTripModal() {
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
    
    try {
        const trip = await api('/api/trips', {
            method: 'POST',
            body: JSON.stringify({
                name: tripName,
                currency: currency,
                members: uniqueMembers
            })
        });
        
        closeNewTripModal();
        await openTrip(trip.id);
        showToast('Trip created!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================================
// Open Trip
// ===================================

async function openTrip(tripId) {
    try {
        currentTrip = await api(`/api/trips/${tripId}`);
        currentTripId = tripId;
        showMainApp();
    } catch (error) {
        showToast('Error loading trip', 'error');
        console.error(error);
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
    if (!currentTrip) return;
    
    elements.tripName.textContent = currentTrip.name || 'No Trip Yet';
    elements.tripMembers.textContent = currentTrip.members.length > 0 
        ? `${currentTrip.members.length} members` 
        : 'Add members to start';
    
    const total = (currentTrip.expenses || []).reduce((sum, exp) => sum + exp.amount, 0);
    elements.totalAmount.textContent = `${currentTrip.currency}${formatNumber(total)}`;
}

function renderExpenses() {
    if (!currentTrip) return;
    
    const expenses = currentTrip.expenses || [];
    
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
                    <span class="expense-payer">Paid by ${escapeHtml(expense.paid_by)}</span>
                    <span>• Split ${expense.split_between.length} ways</span>
                </div>
            </div>
            <span class="expense-amount">${currentTrip.currency}${formatNumber(expense.amount)}</span>
            <button class="expense-delete" onclick="deleteExpense(${expense.id})" aria-label="Delete expense">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
            </button>
        </div>
    `).join('');
}

async function renderBalances() {
    if (!currentTripId) return;
    
    try {
        const balances = await api(`/api/trips/${currentTripId}/balances`);
        
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
            let balanceText = `${currentTrip.currency}0`;
            
            if (balance > 0.01) {
                balanceClass = 'positive';
                balanceText = `+${currentTrip.currency}${formatNumber(balance)}`;
            } else if (balance < -0.01) {
                balanceClass = 'negative';
                balanceText = `-${currentTrip.currency}${formatNumber(Math.abs(balance))}`;
            }
            
            return `
                <div class="balance-card">
                    <span class="balance-name">${escapeHtml(name)}</span>
                    <span class="balance-amount ${balanceClass}">${balanceText}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading balances:', error);
    }
}

async function renderSettlements() {
    if (!currentTripId) return;
    
    try {
        const settlements = await api(`/api/trips/${currentTripId}/settlements`);
        
        if (settlements.length === 0) {
            const hasExpenses = (currentTrip.expenses || []).length > 0;
            elements.settleList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🤝</span>
                    <p>Nothing to settle yet</p>
                    <p class="empty-hint">${hasExpenses ? 'Everyone is settled up!' : 'Add some expenses first'}</p>
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
                <span class="settle-amount">${currentTrip.currency}${formatNumber(s.amount)}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading settlements:', error);
    }
}

function updateCurrencySymbols() {
    if (!currentTrip) return;
    const symbol = currentTrip.currency || '₹';
    document.querySelectorAll('.currency-symbol').forEach(el => {
        el.textContent = symbol;
    });
}

// ===================================
// Expense Modal
// ===================================

function openExpenseModal() {
    if (!currentTrip || currentTrip.members.length === 0) {
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
    const members = currentTrip.members || [];
    
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
    
    try {
        const expense = await api(`/api/trips/${currentTripId}/expenses`, {
            method: 'POST',
            body: JSON.stringify({
                description,
                amount,
                paid_by: paidBy,
                split_between: splitBetween
            })
        });
        
        // Add to local state
        if (!currentTrip.expenses) currentTrip.expenses = [];
        currentTrip.expenses.push(expense);
        
        renderUI();
        closeExpenseModal();
        showToast('Expense added!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteExpense(expenseId) {
    if (!confirm('Delete this expense?')) return;
    
    try {
        await api(`/api/trips/${currentTripId}/expenses/${expenseId}`, {
            method: 'DELETE'
        });
        
        // Remove from local state
        currentTrip.expenses = currentTrip.expenses.filter(e => e.id !== expenseId);
        
        renderUI();
        showToast('Expense deleted', 'success');
    } catch (error) {
        showToast(error.message, 'error');
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
    if (!currentTrip) return;
    
    elements.tripNameInput.value = currentTrip.name || '';
    elements.currencySelect.value = currentTrip.currency || '₹';
    
    elements.membersInput.innerHTML = '';
    
    if (currentTrip.members && currentTrip.members.length > 0) {
        currentTrip.members.forEach((member, index) => {
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
    
    try {
        // Check if members changed
        const oldMembers = new Set(currentTrip.members);
        const newMembers = new Set(uniqueMembers);
        const membersChanged = oldMembers.size !== newMembers.size || 
            [...oldMembers].some(m => !newMembers.has(m));
        
        let confirmClear = false;
        if (membersChanged && currentTrip.expenses && currentTrip.expenses.length > 0) {
            if (!confirm('Changing members will clear all expenses. Continue?')) {
                return;
            }
            confirmClear = true;
        }
        
        const updatedTrip = await api(`/api/trips/${currentTripId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: tripName,
                currency: currency,
                members: uniqueMembers,
                confirm_clear_expenses: confirmClear
            })
        });
        
        // Reload trip data
        await openTrip(currentTripId);
        closeSettingsModal();
        showToast('Settings saved!', 'success');
    } catch (error) {
        if (error.message.includes('needs_confirmation')) {
            // Handle confirmation needed
        } else {
            showToast(error.message, 'error');
        }
    }
}

async function handleDeleteTrip() {
    if (!confirm('Delete this trip and all its expenses?')) return;
    if (!confirm('This cannot be undone. Are you sure?')) return;
    
    try {
        await api(`/api/trips/${currentTripId}`, {
            method: 'DELETE'
        });
        
        showToast('Trip deleted', 'success');
        closeSettingsModal();
        backToTripSelector();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================================
// Utility Functions
// ===================================

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

