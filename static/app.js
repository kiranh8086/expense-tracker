/**
 * SplitTrip - Expense Tracker
 * Frontend JavaScript using Flask API
 */

const PHONE_STORAGE_KEY = 'splittrip_phone';
let loggedInPhone = null;
let currentTrip = null;
let currentTripId = null;
let currentUserIsAdmin = false;
let pendingTripId = null;

async function api(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const response = await fetch(endpoint, { ...defaultOptions, ...options });
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
        const error = new Error(data.error || data.warning || 'Request failed');
        error.status = response.status;
        error.data = data;
        throw error;
    }
    
    return data;
}

const elements = {
    tripSelectorScreen: document.getElementById('tripSelectorScreen'),
    appContainer: document.getElementById('appContainer'),
    loginSection: document.getElementById('loginSection'),
    loginPhone: document.getElementById('loginPhone'),
    loginBtn: document.getElementById('loginBtn'),
    loginStatus: document.getElementById('loginStatus'),
    loginPhoneDisplay: document.getElementById('loginPhoneDisplay'),
    logoutBtn: document.getElementById('logoutBtn'),
    tripActions: document.getElementById('tripActions'),
    createNewTripBtn: document.getElementById('createNewTripBtn'),
    tripsList: document.getElementById('tripsList'),
    newTripModal: document.getElementById('newTripModal'),
    closeNewTripModal: document.getElementById('closeNewTripModal'),
    newTripForm: document.getElementById('newTripForm'),
    newTripName: document.getElementById('newTripName'),
    newTripCurrency: document.getElementById('newTripCurrency'),
    newTripMembersInput: document.getElementById('newTripMembersInput'),
    newTripAddMemberBtn: document.getElementById('newTripAddMemberBtn'),
    pinModal: document.getElementById('pinModal'),
    closePinModal: document.getElementById('closePinModal'),
    pinForm: document.getElementById('pinForm'),
    tripPinInput: document.getElementById('tripPinInput'),
    backToTripsBtn: document.getElementById('backToTripsBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    tripName: document.getElementById('tripName'),
    tripMembers: document.getElementById('tripMembers'),
    totalAmount: document.getElementById('totalAmount'),
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    expensesList: document.getElementById('expensesList'),
    balancesList: document.getElementById('balancesList'),
    settleList: document.getElementById('settleList'),
    addExpenseBtn: document.getElementById('addExpenseBtn'),
    expenseModal: document.getElementById('expenseModal'),
    closeExpenseModal: document.getElementById('closeExpenseModal'),
    expenseForm: document.getElementById('expenseForm'),
    expenseDesc: document.getElementById('expenseDesc'),
    expenseAmount: document.getElementById('expenseAmount'),
    expenseCategory: document.getElementById('expenseCategory'),
    paidBy: document.getElementById('paidBy'),
    splitOptions: document.getElementById('splitOptions'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    currencySymbol: document.getElementById('currencySymbol'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    settingsForm: document.getElementById('settingsForm'),
    tripNameInput: document.getElementById('tripNameInput'),
    currencySelect: document.getElementById('currencySelect'),
    membersInput: document.getElementById('membersInput'),
    addMemberBtn: document.getElementById('addMemberBtn'),
    deleteTripBtn: document.getElementById('deleteTripBtn'),
    toast: document.getElementById('toast')
};

async function init() {
    setupEventListeners();
    const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);
    if (savedPhone) {
        await loginWithPhone(savedPhone, true);
    } else {
        showLogin();
    }
}

function setupEventListeners() {
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.createNewTripBtn.addEventListener('click', openNewTripModal);
    elements.closeNewTripModal.addEventListener('click', closeNewTripModal);
    elements.newTripModal.addEventListener('click', (e) => {
        if (e.target === elements.newTripModal) closeNewTripModal();
    });
    elements.newTripForm.addEventListener('submit', handleCreateNewTrip);
    elements.newTripAddMemberBtn.addEventListener('click', () => addMemberRowTo(elements.newTripMembersInput));
    elements.closePinModal.addEventListener('click', closePinModal);
    elements.pinModal.addEventListener('click', (e) => {
        if (e.target === elements.pinModal) closePinModal();
    });
    elements.pinForm.addEventListener('submit', handleVerifyTrip);
    elements.backToTripsBtn.addEventListener('click', backToTripSelector);
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    elements.addExpenseBtn.addEventListener('click', openExpenseModal);
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.closeExpenseModal.addEventListener('click', closeExpenseModal);
    elements.expenseModal.addEventListener('click', (e) => {
        if (e.target === elements.expenseModal) closeExpenseModal();
    });
    elements.expenseForm.addEventListener('submit', handleAddExpense);
    elements.selectAllBtn.addEventListener('click', toggleSelectAll);
    elements.closeSettingsModal.addEventListener('click', closeSettingsModal);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettingsModal();
    });
    elements.settingsForm.addEventListener('submit', handleSaveSettings);
    elements.addMemberBtn.addEventListener('click', () => addMemberRowTo(elements.membersInput, true));
    elements.deleteTripBtn.addEventListener('click', handleDeleteTrip);
}

function showLogin() {
    elements.loginSection.style.display = 'block';
    elements.loginStatus.style.display = 'none';
    elements.tripActions.style.display = 'none';
}

function showTripSelection() {
    elements.loginSection.style.display = 'none';
    elements.loginStatus.style.display = 'flex';
    elements.tripActions.style.display = 'block';
    elements.loginPhoneDisplay.textContent = loggedInPhone ? `Logged in: ${loggedInPhone}` : '';
}

async function handleLogin() {
    const phone = (elements.loginPhone.value || '').trim();
    if (!phone) {
        showToast('Please enter your phone number', 'error');
        return;
    }
    await loginWithPhone(phone, false);
}

async function loginWithPhone(phone, silent) {
    try {
        const trips = await api('/api/login', {
            method: 'POST',
            body: JSON.stringify({ phone })
        });
        loggedInPhone = phone;
        localStorage.setItem(PHONE_STORAGE_KEY, phone);
        showTripSelection();
        renderTripsList(trips);
    } catch (error) {
        if (!silent) {
            showToast(error.message, 'error');
        }
        showLogin();
    }
}

async function handleLogout() {
    try {
        await api('/api/logout', { method: 'POST' });
    } catch (error) {
        // ignore
    }
    loggedInPhone = null;
    localStorage.removeItem(PHONE_STORAGE_KEY);
    showLogin();
}

async function loadTrips() {
    try {
        const trips = await api('/api/trips');
        renderTripsList(trips);
    } catch (error) {
        showLogin();
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
    
    elements.tripsList.querySelectorAll('.trip-card').forEach(card => {
        card.addEventListener('click', () => openTripPin(card.dataset.id));
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
    currentTrip = null;
    currentTripId = null;
    currentUserIsAdmin = false;
    loadTrips();
}

function openNewTripModal() {
    if (!loggedInPhone) {
        showToast('Please login with your phone first', 'error');
        return;
    }
    elements.newTripForm.reset();
    elements.newTripMembersInput.innerHTML = '';
    
    for (let i = 0; i < 2; i++) {
        const isAdminRow = i === 0;
        addMemberRowTo(elements.newTripMembersInput, false, isAdminRow, {
            phone: isAdminRow ? loggedInPhone : ''
        });
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
    
    const memberRows = elements.newTripMembersInput.querySelectorAll('.member-row');
    const members = Array.from(memberRows).map(row => ({
        name: row.querySelector('.member-name').value.trim(),
        phone: row.querySelector('.member-phone').value.trim(),
        pin: row.querySelector('.member-pin').value.trim()
    })).filter(m => m.name && m.phone && m.pin);
    
    if (!tripName) {
        showToast('Please enter a trip name', 'error');
        return;
    }
    
    if (members.length < 2) {
        showToast('Please add at least 2 members', 'error');
        return;
    }
    
    const uniqueNames = new Set(members.map(m => m.name));
    const uniquePhones = new Set(members.map(m => m.phone));
    if (uniqueNames.size !== members.length) {
        showToast('Member names must be unique', 'error');
        return;
    }
    if (uniquePhones.size !== members.length) {
        showToast('Phone numbers must be unique', 'error');
        return;
    }
    
    try {
        const trip = await api('/api/trips', {
            method: 'POST',
            body: JSON.stringify({
                name: tripName,
                currency: currency,
                members: members,
                admin_phone: loggedInPhone
            })
        });
        
        closeNewTripModal();
        currentTrip = trip;
        currentTripId = trip.id;
        currentUserIsAdmin = trip.current_user_is_admin || false;
        showMainApp();
        showToast('Trip created!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function openTripPin(tripId) {
    pendingTripId = tripId;
    elements.tripPinInput.value = '';
    elements.pinModal.classList.add('active');
    elements.tripPinInput.focus();
}

function closePinModal() {
    elements.pinModal.classList.remove('active');
    pendingTripId = null;
}

async function handleVerifyTrip(e) {
    e.preventDefault();
    if (!pendingTripId) return;
    
    const pin = elements.tripPinInput.value.trim();
    if (!pin) {
        showToast('Please enter your PIN', 'error');
        return;
    }
    
    try {
        const trip = await api(`/api/trips/${pendingTripId}/verify`, {
            method: 'POST',
            body: JSON.stringify({ phone: loggedInPhone, pin })
        });
        
        currentTrip = trip;
        currentTripId = trip.id;
        currentUserIsAdmin = trip.current_user_is_admin || false;
        closePinModal();
        showMainApp();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

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
                    <span>• ${escapeHtml(expense.category || 'Miscellaneous')}</span>
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
        members.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
    
    elements.splitOptions.innerHTML = members.map(m => `
        <label class="split-option">
            <input type="checkbox" name="split" value="${escapeHtml(m.name)}" checked>
            <span>${escapeHtml(m.name)}</span>
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
    const category = elements.expenseCategory.value;
    
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
                category,
                paid_by: paidBy,
                split_between: splitBetween
            })
        });
        
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
        
        currentTrip.expenses = currentTrip.expenses.filter(e => e.id !== expenseId);
        
        renderUI();
        showToast('Expense deleted', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

window.deleteExpense = deleteExpense;

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
            addMemberRowTo(elements.membersInput, true, index === 0, {
                name: member.name,
                phone: member.phone,
                pin: ''
            });
        });
    } else {
        for (let i = 0; i < 2; i++) {
            addMemberRowTo(elements.membersInput, true, i === 0);
        }
    }
    
    const isAdmin = currentUserIsAdmin;
    elements.addMemberBtn.style.display = isAdmin ? 'block' : 'none';
    elements.deleteTripBtn.style.display = isAdmin ? 'block' : 'none';
    elements.settingsForm.querySelector('.btn-primary').style.display = isAdmin ? 'block' : 'none';
    
    elements.membersInput.querySelectorAll('input').forEach(input => {
        input.disabled = !isAdmin;
    });
}

function addMemberRowTo(container, isSettings = false, isAdminRow = false, preset = {}) {
    const memberRows = container.querySelectorAll('.member-row').length;
    
    if (memberRows >= 10) {
        showToast('Maximum 10 members allowed', 'error');
        return;
    }
    
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
        <input type="text" class="member-name" placeholder="Name" value="${escapeHtml(preset.name || '')}" required>
        <input type="tel" class="member-phone" placeholder="Phone" value="${escapeHtml(preset.phone || '')}" required>
        <input type="password" class="member-pin pin-input" placeholder="PIN" value="${escapeHtml(preset.pin || '')}" ${isSettings ? '' : 'required'}>
        <button type="button" class="btn-remove-member">&times;</button>
    `;
    
    const phoneInput = row.querySelector('.member-phone');
    if (isAdminRow && preset.phone) {
        phoneInput.readOnly = true;
    }
    
    row.querySelector('.btn-remove-member').addEventListener('click', () => {
        const rows = container.querySelectorAll('.member-row');
        if (rows.length > 2) {
            row.remove();
            updateMemberRowsState(container);
        } else {
            showToast('Minimum 2 members required', 'error');
        }
    });
    
    container.appendChild(row);
    updateMemberRowsState(container);
}

function updateMemberRowsState(container) {
    const rows = container.querySelectorAll('.member-row');
    rows.forEach((row) => {
        const btn = row.querySelector('.btn-remove-member');
        btn.disabled = rows.length <= 2;
    });
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    if (!currentUserIsAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    const tripName = elements.tripNameInput.value.trim();
    const currency = elements.currencySelect.value;
    
    const memberRows = elements.membersInput.querySelectorAll('.member-row');
    const members = Array.from(memberRows).map(row => ({
        name: row.querySelector('.member-name').value.trim(),
        phone: row.querySelector('.member-phone').value.trim(),
        pin: row.querySelector('.member-pin').value.trim()
    })).filter(m => m.name && m.phone);
    
    if (!tripName) {
        showToast('Please enter a trip name', 'error');
        return;
    }
    
    if (members.length < 2) {
        showToast('Please add at least 2 members', 'error');
        return;
    }
    
    const uniqueNames = new Set(members.map(m => m.name));
    const uniquePhones = new Set(members.map(m => m.phone));
    if (uniqueNames.size !== members.length) {
        showToast('Member names must be unique', 'error');
        return;
    }
    if (uniquePhones.size !== members.length) {
        showToast('Phone numbers must be unique', 'error');
        return;
    }
    
    try {
        const oldPhones = new Set((currentTrip.members || []).map(m => m.phone));
        const newPhones = new Set(members.map(m => m.phone));
        const membersChanged = oldPhones.size !== newPhones.size ||
            [...oldPhones].some(phone => !newPhones.has(phone));
        
        let confirmClear = false;
        if (membersChanged && currentTrip.expenses && currentTrip.expenses.length > 0) {
            if (!confirm('Changing members will clear all expenses. Continue?')) {
                return;
            }
            confirmClear = true;
        }
        
        await api(`/api/trips/${currentTripId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: tripName,
                currency: currency,
                members: members,
                admin_phone: loggedInPhone,
                confirm_clear_expenses: confirmClear
            })
        });
        
        currentTrip = await api(`/api/trips/${currentTripId}`);
        currentUserIsAdmin = currentTrip.current_user_is_admin || false;
        closeSettingsModal();
        renderUI();
        showToast('Settings saved!', 'success');
    } catch (error) {
        if (error.status === 409 && error.data && error.data.needs_confirmation) {
            showToast('Please confirm member changes', 'error');
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

document.addEventListener('DOMContentLoaded', init);
