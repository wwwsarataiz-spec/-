// ===== app.js - عميل Nexora =====

// ===== عناصر DOM الأساسية مع فحص الوجود =====
const loginOverlay = document.getElementById('loginOverlay');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarBalance = document.getElementById('sidebarBalance');
const sidebarCasinoBalance = document.getElementById('sidebarCasinoBalance');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// عناصر التعدين والمحفظة
const miningEarningsDisplay = document.getElementById('miningEarningsDisplay');
const mineBtn = document.getElementById('mineBtn');
const harvestBtn = document.getElementById('harvestBtn');
const miningMessage = document.getElementById('miningMessage');
const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
const pointsBalanceDisplay = document.getElementById('pointsBalanceDisplay');
const casinoBalanceDisplay = document.getElementById('casinoBalanceDisplay');
const transferAmount = document.getElementById('transferAmount');
const transferBtn = document.getElementById('transferBtn');
const withdrawAddress = document.getElementById('withdrawAddress');
const withdrawAmount = document.getElementById('withdrawAmount');
const withdrawBtn = document.getElementById('withdrawBtn');
const walletStatus = document.getElementById('walletStatus');
const depositTxId = document.getElementById('depositTxId');
const depositBtn = document.getElementById('depositBtn');
const depositStatus = document.getElementById('depositStatus');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const transactionsList = document.getElementById('transactionsList');

// عناصر التحويل الداخلي
const internalTransferAmount = document.getElementById('internalTransferAmount');
const transferPointsToCasinoBtn = document.getElementById('transferPointsToCasinoBtn');
const transferCasinoToPointsBtn = document.getElementById('transferCasinoToPointsBtn');
const internalTransferStatus = document.getElementById('internalTransferStatus');

// عناصر سوق الاستبدال
const marketAmount = document.getElementById('marketAmount');
const buyPointsBtn = document.getElementById('buyPointsBtn');
const sellPointsBtn = document.getElementById('sellPointsBtn');
const marketStatus = document.getElementById('marketStatus');

// عناصر الألعاب
const gameSelectors = document.querySelectorAll('.game-selector');
const riskSlider = document.getElementById('riskSlider');
const riskValue = document.getElementById('riskValue');
const betAmountInput = document.getElementById('betAmount');
const playGameBtn = document.getElementById('playGameBtn');
const gameResult = document.getElementById('gameResult');
const gameDetails = document.getElementById('gameDetails');

let selectedGame = 'chicken';
let cooldownInterval = null;

const DEPOSIT_ADDRESS = '0x2975dc1f8188c30b2a4be0ec27e33494da66cb46';

// ===== دوال تحديث الواجهة مع فحص وجود العناصر =====

function updateSidebar(user) {
    if (user && user.name) {
        if (sidebarUsername) sidebarUsername.textContent = user.name;
        if (sidebarBalance) sidebarBalance.textContent = (user.balance || 0).toFixed(4);
        if (sidebarCasinoBalance) sidebarCasinoBalance.textContent = (user.casino_balance || 0).toFixed(4);
    } else {
        if (sidebarUsername) sidebarUsername.textContent = 'زائر';
        if (sidebarBalance) sidebarBalance.textContent = '٠';
        if (sidebarCasinoBalance) sidebarCasinoBalance.textContent = '٠';
    }
}

function updateWalletUI(user) {
    if (!user) {
        if (walletBalanceDisplay) walletBalanceDisplay.textContent = '0.0000';
        if (pointsBalanceDisplay) pointsBalanceDisplay.textContent = '0.0000';
        if (casinoBalanceDisplay) casinoBalanceDisplay.textContent = '0.0000';
        return;
    }
    if (walletBalanceDisplay) walletBalanceDisplay.textContent = (user.balance || 0).toFixed(4);
    if (pointsBalanceDisplay) pointsBalanceDisplay.textContent = (user.points_balance || 0).toFixed(4);
    if (casinoBalanceDisplay) casinoBalanceDisplay.textContent = (user.casino_balance || 0).toFixed(4);
}

function updateMiningUI(user) {
    if (!user) {
        if (miningEarningsDisplay) miningEarningsDisplay.textContent = '0.0000';
        return;
    }
    if (miningEarningsDisplay) miningEarningsDisplay.textContent = (user.miningEarnings || 0).toFixed(4);
}

function showLoginOverlay() {
    if (loginOverlay) loginOverlay.style.display = 'flex';
}

function hideLoginOverlay() {
    if (loginOverlay) loginOverlay.style.display = 'none';
}

// ===== إدارة الجلسة =====

function setSession(token, user) {
    localStorage.setItem('nexora_token', token);
    localStorage.setItem('nexora_user', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('nexora_token');
    localStorage.removeItem('nexora_user');
    showLoginOverlay();
    updateSidebar(null);
    updateWalletUI(null);
    updateMiningUI(null);
    if (transactionsList) {
        transactionsList.innerHTML = `<li style="color:#6a5f4e; text-align:center; justify-content:center;">لا توجد معاملات</li>`;
    }
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
    }
    if (mineBtn) {
        mineBtn.disabled = false;
        mineBtn.textContent = '⛏️ تعدين (يدوي)';
    }
}

// ===== جلب البيانات =====

async function fetchUserData() {
    const token = localStorage.getItem('nexora_token');
    if (!token) return null;
    try {
        const response = await fetch('/api/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                clearSession();
                return null;
            }
            throw new Error('فشل جلب البيانات');
        }
        const user = await response.json();
        localStorage.setItem('nexora_user', JSON.stringify(user));
        return user;
    } catch (error) {
        console.error('خطأ في جلب البيانات:', error);
        return null;
    }
}

async function fetchMiningStatus() {
    const token = localStorage.getItem('nexora_token');
    if (!token) return null;
    try {
        const response = await fetch('/api/mining-status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('فشل جلب حالة التعدين');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('خطأ في جلب حالة التعدين:', error);
        return null;
    }
}

// ===== دوال التعدين =====

function updateCooldownButton(seconds) {
    if (!mineBtn) return;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    mineBtn.textContent = `⏳ متبقي ${timeStr}`;
}

async function updateMiningUIFromStatus(status) {
    if (!status) return;
    if (miningEarningsDisplay) {
        miningEarningsDisplay.textContent = (status.miningEarnings || 0).toFixed(4);
    }
    if (status.canMine) {
        if (mineBtn) {
            mineBtn.disabled = false;
            mineBtn.textContent = '⛏️ تعدين (يدوي)';
        }
        if (cooldownInterval) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
        }
        if (miningMessage) miningMessage.textContent = '';
    } else {
        if (mineBtn) {
            mineBtn.disabled = true;
            const remaining = status.cooldownRemaining || 0;
            updateCooldownButton(remaining);
        }
        if (cooldownInterval) clearInterval(cooldownInterval);
        let remainingSeconds = status.cooldownRemaining || 0;
        cooldownInterval = setInterval(async () => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
                const newStatus = await fetchMiningStatus();
                if (newStatus) updateMiningUIFromStatus(newStatus);
                return;
            }
            updateCooldownButton(remainingSeconds);
        }, 1000);
    }
}

async function handleMine() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    try {
        const response = await fetch('/api/mine', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 403 && data.cooldownRemaining) {
                if (miningMessage) {
                    miningMessage.textContent = data.message || 'في مهلة الانتظار';
                    miningMessage.style.color = '#f1c40f';
                }
                const status = await fetchMiningStatus();
                if (status) updateMiningUIFromStatus(status);
                return;
            }
            if (miningMessage) {
                miningMessage.textContent = data.message || 'فشل التعدين';
                miningMessage.style.color = '#e74c3c';
            }
            return;
        }
        const user = {
            balance: data.balance,
            points_balance: data.points_balance,
            casino_balance: data.casino_balance,
            miningEarnings: data.miningEarnings
        };
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        if (miningMessage) {
            miningMessage.textContent = '✅ ' + data.message;
            miningMessage.style.color = '#2ecc71';
        }
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        localStorage.setItem('nexora_user', JSON.stringify(stored));
        const status = await fetchMiningStatus();
        if (status) updateMiningUIFromStatus(status);
    } catch (error) {
        if (miningMessage) {
            miningMessage.textContent = 'خطأ في الاتصال';
            miningMessage.style.color = '#e74c3c';
        }
    }
}

async function handleHarvest() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    try {
        const response = await fetch('/api/harvest', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) {
            if (miningMessage) {
                miningMessage.textContent = data.message || 'فشل الحصاد';
                miningMessage.style.color = '#e74c3c';
            }
            return;
        }
        const user = {
            balance: data.balance,
            points_balance: data.points_balance,
            casino_balance: data.casino_balance,
            miningEarnings: data.miningEarnings
        };
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        if (miningMessage) {
            miningMessage.textContent = '✅ ' + data.message;
            miningMessage.style.color = '#2ecc71';
        }
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        stored.lastHarvestTime = data.lastHarvestTime;
        localStorage.setItem('nexora_user', JSON.stringify(stored));
        const status = await fetchMiningStatus();
        if (status) updateMiningUIFromStatus(status);
    } catch (error) {
        if (miningMessage) {
            miningMessage.textContent = 'خطأ في الاتصال';
            miningMessage.style.color = '#e74c3c';
        }
    }
}

// ===== دوال المحفظة (الإيداع، السحب، التحويلات) مع فحص العناصر =====

async function transferToCasino() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const amount = parseFloat(transferAmount ? transferAmount.value : '0');
    if (!amount || amount <= 0) {
        if (walletStatus) {
            walletStatus.textContent = 'أدخل مبلغاً صحيحاً';
            walletStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/wallet/transfer-to-casino', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (!response.ok) {
            if (walletStatus) {
                walletStatus.textContent = data.message || 'فشل التحويل';
                walletStatus.style.color = '#e74c3c';
            }
            return;
        }
        const user = { balance: data.balance, points_balance: data.points_balance, casino_balance: data.casino_balance };
        updateSidebar(user);
        updateWalletUI(user);
        if (walletStatus) {
            walletStatus.textContent = '✅ ' + data.message;
            walletStatus.style.color = '#2ecc71';
        }
        if (transferAmount) transferAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        if (walletStatus) {
            walletStatus.textContent = 'خطأ في الاتصال';
            walletStatus.style.color = '#e74c3c';
        }
    }
}

async function requestWithdraw() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const address = withdrawAddress ? withdrawAddress.value.trim() : '';
    const amount = parseFloat(withdrawAmount ? withdrawAmount.value : '0');
    if (!address) {
        if (walletStatus) {
            walletStatus.textContent = 'أدخل عنوان المحفظة';
            walletStatus.style.color = '#e74c3c';
        }
        return;
    }
    if (!amount || amount < 4) {
        if (walletStatus) {
            walletStatus.textContent = 'الحد الأدنى للسحب 4 USDT';
            walletStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/wallet/withdraw', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: address, amount })
        });
        const data = await response.json();
        if (!response.ok) {
            if (walletStatus) {
                walletStatus.textContent = data.message || 'فشل السحب';
                walletStatus.style.color = '#e74c3c';
            }
            return;
        }
        const user = { balance: data.balance, points_balance: data.points_balance, casino_balance: data.casino_balance };
        updateSidebar(user);
        updateWalletUI(user);
        if (walletStatus) {
            walletStatus.textContent = '✅ ' + data.message;
            walletStatus.style.color = '#2ecc71';
        }
        if (withdrawAddress) withdrawAddress.value = '';
        if (withdrawAmount) withdrawAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        if (walletStatus) {
            walletStatus.textContent = 'خطأ في الاتصال';
            walletStatus.style.color = '#e74c3c';
        }
    }
}

async function submitDeposit() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const txid = depositTxId ? depositTxId.value.trim() : '';
    if (!txid) {
        if (depositStatus) {
            depositStatus.textContent = 'الرجاء إدخال رقم العملية';
            depositStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/wallet/deposit', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ txid })
        });
        const data = await response.json();
        if (!response.ok) {
            if (depositStatus) {
                depositStatus.textContent = data.message || 'فشل تسجيل الإيداع';
                depositStatus.style.color = '#e74c3c';
            }
            return;
        }
        if (depositStatus) {
            depositStatus.textContent = '✅ ' + data.message;
            depositStatus.style.color = '#2ecc71';
        }
        if (depositTxId) depositTxId.value = '';
        loadTransactions();
    } catch (error) {
        if (depositStatus) {
            depositStatus.textContent = 'خطأ في الاتصال';
            depositStatus.style.color = '#e74c3c';
        }
    }
}

function copyAddress() {
    navigator.clipboard.writeText(DEPOSIT_ADDRESS).then(() => {
        if (depositStatus) {
            depositStatus.textContent = '✅ تم نسخ العنوان';
            depositStatus.style.color = '#2ecc71';
            setTimeout(() => { if (depositStatus) depositStatus.textContent = ''; }, 3000);
        }
    }).catch(() => {
        if (depositStatus) {
            depositStatus.textContent = '⚠️ فشل النسخ، حاول يدوياً';
            depositStatus.style.color = '#e67e22';
        }
    });
}

async function loadTransactions() {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    try {
        const response = await fetch('/api/wallet/transactions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        renderTransactions(data.transactions || []);
    } catch (error) {
        console.error('خطأ في تحميل المعاملات');
    }
}

function renderTransactions(transactions) {
    if (!transactionsList) return;
    if (!transactions || transactions.length === 0) {
        transactionsList.innerHTML = `<li style="color:#6a5f4e; text-align:center; justify-content:center;">لا توجد معاملات</li>`;
        return;
    }
    let html = '';
    transactions.slice(0, 10).forEach(tx => {
        let statusClass = '';
        let statusText = '';
        if (tx.status === 'pending') { statusClass = 'tx-status-pending'; statusText = 'قيد الانتظار'; }
        else if (tx.status === 'completed') { statusClass = 'tx-status-completed'; statusText = 'مكتمل'; }
        else { statusClass = 'tx-status-failed'; statusText = 'فشل'; }
        const typeMap = {
            'transfer_to_casino': 'تحويل للكازينو',
            'withdraw': 'سحب',
            'harvest': 'حصاد',
            'deposit': 'إيداع',
            'transfer_sent': 'تحويل مرسل',
            'transfer_received': 'تحويل مستقبل',
            'transfer_points_to_casino': 'نقاط ← كازينو',
            'transfer_casino_to_points': 'كازينو ← نقاط',
            'buy_points': 'شراء نقاط',
            'sell_points': 'بيع نقاط',
            'market_buy': 'شراء (سوق)',
            'market_sell': 'بيع (سوق)',
            'game_chicken': 'لعبة الدجاجة',
            'game_dice': 'لعبة النرد',
            'game_wall': 'لعبة كسر الحائط'
        };
        const typeText = typeMap[tx.type] || tx.type;
        const amountDisplay = tx.amount >= 0 ? `+${tx.amount.toFixed(4)}` : `${tx.amount.toFixed(4)}`;
        html += `
            <li>
                <span>${typeText}</span>
                <span style="color:${tx.amount >= 0 ? '#2ecc71' : '#e74c3c'};">${amountDisplay} USDT</span>
                <span class="${statusClass}">${statusText}</span>
                <span style="color:#6a5f4e; font-size:0.7rem;">${new Date(tx.timestamp).toLocaleString()}</span>
            </li>
        `;
    });
    transactionsList.innerHTML = html;
}

// ===== دوال التحويل الداخلي =====

async function transferPointsToCasino() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const amount = parseFloat(internalTransferAmount ? internalTransferAmount.value : '0');
    if (!amount || amount <= 0) {
        if (internalTransferStatus) {
            internalTransferStatus.textContent = 'أدخل مبلغاً صحيحاً';
            internalTransferStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/wallet/transfer-points-to-casino', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (!response.ok) {
            if (internalTransferStatus) {
                internalTransferStatus.textContent = data.message || 'فشل التحويل';
                internalTransferStatus.style.color = '#e74c3c';
            }
            return;
        }
        const user = { balance: data.balance, points_balance: data.points_balance, casino_balance: data.casino_balance };
        updateSidebar(user);
        updateWalletUI(user);
        if (internalTransferStatus) {
            internalTransferStatus.textContent = '✅ ' + data.message;
            internalTransferStatus.style.color = '#2ecc71';
        }
        if (internalTransferAmount) internalTransferAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        if (internalTransferStatus) {
            internalTransferStatus.textContent = 'خطأ في الاتصال';
            internalTransferStatus.style.color = '#e74c3c';
        }
    }
}

async function transferCasinoToPoints() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const amount = parseFloat(internalTransferAmount ? internalTransferAmount.value : '0');
    if (!amount || amount <= 0) {
        if (internalTransferStatus) {
            internalTransferStatus.textContent = 'أدخل مبلغاً صحيحاً';
            internalTransferStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/wallet/transfer-casino-to-points', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (!response.ok) {
            if (internalTransferStatus) {
                internalTransferStatus.textContent = data.message || 'فشل التحويل';
                internalTransferStatus.style.color = '#e74c3c';
            }
            return;
        }
        const user = { balance: data.balance, points_balance: data.points_balance, casino_balance: data.casino_balance };
        updateSidebar(user);
        updateWalletUI(user);
        if (internalTransferStatus) {
            internalTransferStatus.textContent = '✅ ' + data.message;
            internalTransferStatus.style.color = '#2ecc71';
        }
        if (internalTransferAmount) internalTransferAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        if (internalTransferStatus) {
            internalTransferStatus.textContent = 'خطأ في الاتصال';
            internalTransferStatus.style.color = '#e74c3c';
        }
    }
}

// ===== دوال سوق الاستبدال =====

async function buyPoints() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const usdtAmount = parseFloat(marketAmount ? marketAmount.value : '0');
    if (!usdtAmount || usdtAmount <= 0) {
        if (marketStatus) {
            marketStatus.textContent = 'أدخل مبلغ USDT صحيح';
            marketStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/market/buy-points', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ usdtAmount })
        });
        const data = await response.json();
        if (!response.ok) {
            if (marketStatus) {
                marketStatus.textContent = data.message || 'فشل الشراء';
                marketStatus.style.color = '#e74c3c';
            }
            return;
        }
        const user = { balance: data.balance, points_balance: data.points_balance, casino_balance: data.casino_balance };
        updateSidebar(user);
        updateWalletUI(user);
        if (marketStatus) {
            marketStatus.textContent = '✅ ' + data.message;
            marketStatus.style.color = '#2ecc71';
        }
        if (marketAmount) marketAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        if (marketStatus) {
            marketStatus.textContent = 'خطأ في الاتصال';
            marketStatus.style.color = '#e74c3c';
        }
    }
}

async function sellPoints() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const pointsAmount = parseFloat(marketAmount ? marketAmount.value : '0');
    if (!pointsAmount || pointsAmount <= 0) {
        if (marketStatus) {
            marketStatus.textContent = 'أدخل عدد النقاط الصحيح';
            marketStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/market/sell-points', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ pointsAmount })
        });
        const data = await response.json();
        if (!response.ok) {
            if (marketStatus) {
                marketStatus.textContent = data.message || 'فشل البيع';
                marketStatus.style.color = '#e74c3c';
            }
            return;
        }
        const user = { balance: data.balance, points_balance: data.points_balance, casino_balance: data.casino_balance };
        updateSidebar(user);
        updateWalletUI(user);
        if (marketStatus) {
            marketStatus.textContent = '✅ ' + data.message;
            marketStatus.style.color = '#2ecc71';
        }
        if (marketAmount) marketAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        if (marketStatus) {
            marketStatus.textContent = 'خطأ في الاتصال';
            marketStatus.style.color = '#e74c3c';
        }
    }
}

// ===== دوال ألعاب الكازينو =====

if (gameSelectors) {
    gameSelectors.forEach(btn => {
        btn.addEventListener('click', function() {
            gameSelectors.forEach(b => b.classList.remove('active-game'));
            this.classList.add('active-game');
            selectedGame = this.dataset.game;
        });
    });
}

if (riskSlider) {
    riskSlider.addEventListener('input', function() {
        if (riskValue) riskValue.textContent = this.value;
    });
}

if (playGameBtn) {
    playGameBtn.addEventListener('click', async function() {
        const token = localStorage.getItem('nexora_token');
        if (!token) { showLoginOverlay(); return; }
        const betAmount = parseFloat(betAmountInput ? betAmountInput.value : '0');
        const risk = parseInt(riskSlider ? riskSlider.value : '50');
        if (!betAmount || betAmount <= 0) {
            if (gameResult) {
                gameResult.textContent = '⚠️ أدخل مبلغ رهان صحيح';
                gameResult.style.color = '#e74c3c';
            }
            return;
        }
        this.disabled = true;
        this.textContent = '⏳ جارٍ التشغيل...';

        try {
            const response = await fetch('/api/games/play', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameType: selectedGame, betAmount, risk })
            });
            const data = await response.json();
            if (!response.ok) {
                if (gameResult) {
                    gameResult.textContent = '❌ ' + (data.message || 'فشل اللعب');
                    gameResult.style.color = '#e74c3c';
                }
                if (gameDetails) gameDetails.textContent = '';
                return;
            }
            if (gameResult) {
                gameResult.textContent = data.resultMessage;
                gameResult.style.color = data.win ? '#2ecc71' : '#e74c3c';
            }
            if (gameDetails) {
                gameDetails.textContent = `المضاعف: ${data.multiplier}x | فرصة الفوز: ${data.winProbability}% | الرقم: ${data.randomNumber}`;
            }
            const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
            stored.casino_balance = data.newCasinoBalance;
            localStorage.setItem('nexora_user', JSON.stringify(stored));
            updateSidebar(stored);
            updateWalletUI(stored);
            loadTransactions();
        } catch (error) {
            if (gameResult) {
                gameResult.textContent = '⚠️ خطأ في الاتصال بالسيرفر';
                gameResult.style.color = '#e74c3c';
            }
            if (gameDetails) gameDetails.textContent = '';
        } finally {
            this.disabled = false;
            this.textContent = '▶ تشغيل';
        }
    });
}

// ===== دوال تسجيل الدخول والتسجيل =====

async function loginUser(email, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'فشل تسجيل الدخول');
        }
        // حفظ التوكن وبيانات المستخدم
        setSession(data.token, data.user);
        const user = data.user;
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        hideLoginOverlay();
        if (loginError) loginError.textContent = '';
        loadTransactions();
        const status = await fetchMiningStatus();
        if (status) updateMiningUIFromStatus(status);
        return true;
    } catch (error) {
        if (loginError) {
            loginError.textContent = error.message;
            loginError.style.color = '#e74c3c';
        }
        return false;
    }
}

async function registerUser(name, phone, email, password) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'فشل إنشاء الحساب');
        }
        // عرض رسالة نجاح وتوجيه المستخدم لتسجيل الدخول
        if (signupError) {
            signupError.textContent = '✅ ' + data.message + '، يرجى تسجيل الدخول الآن';
            signupError.style.color = '#2ecc71';
        }
        // التبديل إلى تبويب تسجيل الدخول
        const tabLogin = document.getElementById('tabLogin');
        if (tabLogin) tabLogin.checked = true;
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail) loginEmail.value = email;
        const loginPassword = document.getElementById('loginPassword');
        if (loginPassword) loginPassword.value = '';
        return true;
    } catch (error) {
        if (signupError) {
            signupError.textContent = error.message;
            signupError.style.color = '#e74c3c';
        }
        return false;
    }
}

// ===== التحقق التلقائي من الجلسة =====

async function checkAutoLogin() {
    const token = localStorage.getItem('nexora_token');
    const storedUser = localStorage.getItem('nexora_user');
    if (!token || !storedUser) {
        showLoginOverlay();
        return false;
    }
    try {
        const response = await fetch('/api/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            clearSession();
            showLoginOverlay();
            return false;
        }
        const user = await response.json();
        localStorage.setItem('nexora_user', JSON.stringify(user));
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        hideLoginOverlay();
        loadTransactions();
        const status = await fetchMiningStatus();
        if (status) updateMiningUIFromStatus(status);
        return true;
    } catch (error) {
        console.error('خطأ في التحقق من الجلسة:', error);
        clearSession();
        showLoginOverlay();
        return false;
    }
}

// ===== تهيئة التطبيق =====

async function initApp() {
    await checkAutoLogin();
}

// ===== ربط الأحداث مع فحص وجود العناصر =====

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail')?.value?.trim() || '';
        const password = document.getElementById('loginPassword')?.value?.trim() || '';
        if (!email || !password) {
            if (loginError) {
                loginError.textContent = 'يرجى ملء جميع الحقول';
                loginError.style.color = '#e74c3c';
            }
            return;
        }
        await loginUser(email, password);
    });
}

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName')?.value?.trim() || '';
        const phone = document.getElementById('signupPhone')?.value?.trim() || '';
        const email = document.getElementById('signupEmail')?.value?.trim() || '';
        const password = document.getElementById('signupPassword')?.value?.trim() || '';
        if (!name || !phone || !email || !password) {
            if (signupError) {
                signupError.textContent = 'يرجى ملء جميع الحقول';
                signupError.style.color = '#e74c3c';
            }
            return;
        }
        await registerUser(name, phone, email, password);
    });
}

if (mineBtn) mineBtn.addEventListener('click', handleMine);
if (harvestBtn) harvestBtn.addEventListener('click', handleHarvest);
if (transferBtn) transferBtn.addEventListener('click', transferToCasino);
if (withdrawBtn) withdrawBtn.addEventListener('click', requestWithdraw);
if (depositBtn) depositBtn.addEventListener('click', submitDeposit);
if (copyAddressBtn) copyAddressBtn.addEventListener('click', copyAddress);

if (transferPointsToCasinoBtn) transferPointsToCasinoBtn.addEventListener('click', transferPointsToCasino);
if (transferCasinoToPointsBtn) transferCasinoToPointsBtn.addEventListener('click', transferCasinoToPoints);
if (buyPointsBtn) buyPointsBtn.addEventListener('click', buyPoints);
if (sellPointsBtn) sellPointsBtn.addEventListener('click', sellPoints);

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', clearSession);

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', initApp);
