// ===== app.js - عميل Nexora (محدث للتبويبات وتأثيرات التعدين) =====

// ===== عناصر DOM الأساسية =====
const loginOverlay = document.getElementById('loginOverlay');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarBalance = document.getElementById('sidebarBalance');
const sidebarCasinoBalance = document.getElementById('sidebarCasinoBalance');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// عناصر التعدين
const miningEarningsDisplay = document.getElementById('miningEarningsDisplay');
const mineBtn = document.getElementById('mineBtn');
const harvestBtn = document.getElementById('harvestBtn');
const miningMessage = document.getElementById('miningMessage');
const miningCoin = document.getElementById('miningCoin');
const cooldownTimer = document.getElementById('cooldownTimer');

// عناصر المحفظة
const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
const pointsBalanceDisplay = document.getElementById('pointsBalanceDisplay');
const casinoBalanceDisplay = document.getElementById('casinoBalanceDisplay');
const internalTransferAmount = document.getElementById('internalTransferAmount');
const transferPointsToCasinoBtn = document.getElementById('transferPointsToCasinoBtn');
const transferCasinoToPointsBtn = document.getElementById('transferCasinoToPointsBtn');
const internalTransferStatus = document.getElementById('internalTransferStatus');
const marketAmount = document.getElementById('marketAmount');
const buyPointsBtn = document.getElementById('buyPointsBtn');
const sellPointsBtn = document.getElementById('sellPointsBtn');
const marketStatus = document.getElementById('marketStatus');
const withdrawAddress = document.getElementById('withdrawAddress');
const withdrawAmount = document.getElementById('withdrawAmount');
const withdrawBtn = document.getElementById('withdrawBtn');
const walletStatus = document.getElementById('walletStatus');
const depositTxId = document.getElementById('depositTxId');
const depositBtn = document.getElementById('depositBtn');
const depositStatus = document.getElementById('depositStatus');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const transactionsList = document.getElementById('transactionsList');

// عناصر الألعاب
const gameSelectors = document.querySelectorAll('.game-selector-group .btn-secondary');
const riskSlider = document.getElementById('riskSlider');
const riskValue = document.getElementById('riskValue');
const betAmountInput = document.getElementById('betAmount');
const playGameBtn = document.getElementById('playGameBtn');
const gameResult = document.getElementById('gameResult');
const gameDetails = document.getElementById('gameDetails');

// عناصر التبويبات
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = {
    mining: document.getElementById('tab-mining'),
    wallet: document.getElementById('tab-wallet'),
    games: document.getElementById('tab-games')
};

let selectedGame = 'chicken';
let cooldownInterval = null;

const DEPOSIT_ADDRESS = '0x2975dc1f8188c30b2a4be0ec27e33494da66cb46';

// ===== إعدادات التعدين الحي =====
const MAX_DAILY_EARNINGS = 0.0080;
const MINING_DURATION = 86400; // 24 ساعة بالثواني

// ===== دوال تحديث الواجهة =====

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
    // إعادة تعيين العملة
    updateCoinState(false, 0);
}

// ===== دوال التعدين وتأثير العملة =====

function updateCoinState(isSpinning, remainingSeconds) {
    if (!miningCoin) return;
    if (isSpinning) {
        miningCoin.classList.add('spinning');
        miningCoin.classList.remove('cooldown');
        if (cooldownTimer) cooldownTimer.style.display = 'none';
    } else {
        miningCoin.classList.remove('spinning');
        miningCoin.classList.add('cooldown');
        if (cooldownTimer) {
            cooldownTimer.style.display = 'flex';
            const hours = Math.floor(remainingSeconds / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            const secs = remainingSeconds % 60;
            cooldownTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }
}

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
        updateCoinState(true, 0);
    } else {
        if (mineBtn) {
            mineBtn.disabled = true;
            const remaining = status.cooldownRemaining || 0;
            updateCooldownButton(remaining);
            updateCoinState(false, remaining);
        }
        if (cooldownInterval) clearInterval(cooldownInterval);
        let remainingSeconds = status.cooldownRemaining || 0;

        // دالة تحديث الأرباح الحية
        const updateLiveEarnings = () => {
            const elapsedSeconds = MINING_DURATION - remainingSeconds;
            const currentEarnings = Math.min((elapsedSeconds / MINING_DURATION) * MAX_DAILY_EARNINGS, MAX_DAILY_EARNINGS);
            if (miningEarningsDisplay) {
                miningEarningsDisplay.textContent = currentEarnings.toFixed(4);
            }
        };
        updateLiveEarnings(); // تحديث فوري

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
            if (cooldownTimer) {
                const hours = Math.floor(remainingSeconds / 3600);
                const minutes = Math.floor((remainingSeconds % 3600) / 60);
                const secs = remainingSeconds % 60;
                cooldownTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            updateLiveEarnings(); // تحديث الأرباح كل ثانية
        }, 1000);
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

// ===== دوال المحفظة =====

async function loadTransactions() {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    try {
        const response = await fetch('/api/transactions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('فشل تحميل المعاملات');
        const data = await response.json();
        renderTransactions(data.transactions || []);
    } catch (error) {
        console.error('خطأ في تحميل المعاملات:', error);
    }
}

function renderTransactions(transactions) {
    if (!transactionsList) return;
    if (!transactions || transactions.length === 0) {
        transactionsList.innerHTML = `<li style="color:#6a5f4e; text-align:center; justify-content:center;">لا توجد معاملات</li>`;
        return;
    }
    transactionsList.innerHTML = transactions.map(tx => {
        const statusClass = tx.status === 'completed' ? 'tx-status-completed' : (tx.status === 'pending' ? 'tx-status-pending' : 'tx-status-failed');
        return `<li>
            <span>${tx.type || 'معاملة'} - ${new Date(tx.created_at).toLocaleDateString('ar-SA')}</span>
            <span class="${statusClass}">${tx.amount ? tx.amount.toFixed(4) : ''} ${tx.currency || ''}</span>
        </li>`;
    }).join('');
}

async function transferPointsToCasino() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const amount = parseFloat(internalTransferAmount?.value);
    if (!amount || amount <= 0) {
        if (internalTransferStatus) {
            internalTransferStatus.textContent = 'يرجى إدخال مبلغ صحيح';
            internalTransferStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/transfer/points-to-casino', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل التحويل');
        const user = await fetchUserData();
        if (user) {
            updateSidebar(user);
            updateWalletUI(user);
        }
        if (internalTransferStatus) {
            internalTransferStatus.textContent = '✅ ' + data.message;
            internalTransferStatus.style.color = '#2ecc71';
        }
        loadTransactions();
    } catch (error) {
        if (internalTransferStatus) {
            internalTransferStatus.textContent = error.message;
            internalTransferStatus.style.color = '#e74c3c';
        }
    }
}

async function transferCasinoToPoints() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const amount = parseFloat(internalTransferAmount?.value);
    if (!amount || amount <= 0) {
        if (internalTransferStatus) {
            internalTransferStatus.textContent = 'يرجى إدخال مبلغ صحيح';
            internalTransferStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/transfer/casino-to-points', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل التحويل');
        const user = await fetchUserData();
        if (user) {
            updateSidebar(user);
            updateWalletUI(user);
        }
        if (internalTransferStatus) {
            internalTransferStatus.textContent = '✅ ' + data.message;
            internalTransferStatus.style.color = '#2ecc71';
        }
        loadTransactions();
    } catch (error) {
        if (internalTransferStatus) {
            internalTransferStatus.textContent = error.message;
            internalTransferStatus.style.color = '#e74c3c';
        }
    }
}

async function buyPoints() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const amount = parseFloat(marketAmount?.value);
    if (!amount || amount <= 0) {
        if (marketStatus) {
            marketStatus.textContent = 'يرجى إدخال مبلغ صحيح';
            marketStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/market/buy', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل الشراء');
        const user = await fetchUserData();
        if (user) {
            updateSidebar(user);
            updateWalletUI(user);
        }
        if (marketStatus) {
            marketStatus.textContent = '✅ ' + data.message;
            marketStatus.style.color = '#2ecc71';
        }
        loadTransactions();
    } catch (error) {
        if (marketStatus) {
            marketStatus.textContent = error.message;
            marketStatus.style.color = '#e74c3c';
        }
    }
}

async function sellPoints() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const amount = parseFloat(marketAmount?.value);
    if (!amount || amount <= 0) {
        if (marketStatus) {
            marketStatus.textContent = 'يرجى إدخال مبلغ صحيح';
            marketStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/market/sell', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل البيع');
        const user = await fetchUserData();
        if (user) {
            updateSidebar(user);
            updateWalletUI(user);
        }
        if (marketStatus) {
            marketStatus.textContent = '✅ ' + data.message;
            marketStatus.style.color = '#2ecc71';
        }
        loadTransactions();
    } catch (error) {
        if (marketStatus) {
            marketStatus.textContent = error.message;
            marketStatus.style.color = '#e74c3c';
        }
    }
}

async function requestWithdraw() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const address = withdrawAddress?.value.trim();
    const amount = parseFloat(withdrawAmount?.value);
    if (!address || !amount || amount < 4) {
        if (walletStatus) {
            walletStatus.textContent = 'يرجى إدخال عنوان صحيح ومبلغ 4 USDT على الأقل';
            walletStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل طلب السحب');
        if (walletStatus) {
            walletStatus.textContent = '✅ ' + data.message;
            walletStatus.style.color = '#2ecc71';
        }
        const user = await fetchUserData();
        if (user) {
            updateSidebar(user);
            updateWalletUI(user);
        }
        loadTransactions();
    } catch (error) {
        if (walletStatus) {
            walletStatus.textContent = error.message;
            walletStatus.style.color = '#e74c3c';
        }
    }
}

async function submitDeposit() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const txId = depositTxId?.value.trim();
    if (!txId) {
        if (depositStatus) {
            depositStatus.textContent = 'يرجى إدخال رقم العملية';
            depositStatus.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch('/api/deposit', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ txId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل تأكيد الإيداع');
        if (depositStatus) {
            depositStatus.textContent = '✅ ' + data.message;
            depositStatus.style.color = '#2ecc71';
        }
        const user = await fetchUserData();
        if (user) {
            updateSidebar(user);
            updateWalletUI(user);
        }
        loadTransactions();
    } catch (error) {
        if (depositStatus) {
            depositStatus.textContent = error.message;
            depositStatus.style.color = '#e74c3c';
        }
    }
}

async function copyAddress() {
    try {
        await navigator.clipboard.writeText(DEPOSIT_ADDRESS);
        alert('تم نسخ عنوان الإيداع');
    } catch (err) {
        prompt('انسخ العنوان يدوياً:', DEPOSIT_ADDRESS);
    }
}

// ===== دوال الألعاب =====

function updateGameSelection(game) {
    selectedGame = game;
    gameSelectors.forEach(btn => {
        btn.classList.remove('active-game');
        if (btn.dataset.game === game) {
            btn.classList.add('active-game');
        }
    });
}

async function playGame() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const risk = parseInt(riskSlider?.value) || 50;
    const bet = parseFloat(betAmountInput?.value);
    if (!bet || bet <= 0) {
        if (gameResult) {
            gameResult.textContent = 'يرجى إدخال رهان صحيح';
            gameResult.style.color = '#e74c3c';
        }
        return;
    }
    try {
        const response = await fetch(`/api/games/${selectedGame}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ risk, bet })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل تشغيل اللعبة');
        if (gameResult) {
            gameResult.textContent = data.win ? '🎉 ربحت!' : '😞 خسرت';
            gameResult.style.color = data.win ? '#2ecc71' : '#e74c3c';
        }
        if (gameDetails) {
            gameDetails.textContent = data.details || `النتيجة: ${data.result || ''}`;
        }
        const user = await fetchUserData();
        if (user) {
            updateSidebar(user);
            updateWalletUI(user);
        }
        loadTransactions();
    } catch (error) {
        if (gameResult) {
            gameResult.textContent = error.message;
            gameResult.style.color = '#e74c3c';
        }
    }
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
        if (signupError) {
            signupError.textContent = '✅ ' + data.message + '، يرجى تسجيل الدخول الآن';
            signupError.style.color = '#2ecc71';
        }
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

// ===== إدارة التبويبات =====

function switchTab(tabId) {
    // تحديث الأزرار
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });
    // تحديث اللوحات
    Object.keys(tabPanels).forEach(key => {
        const panel = tabPanels[key];
        if (panel) {
            panel.classList.remove('active');
            if (key === tabId) {
                panel.classList.add('active');
            }
        }
    });
}

// ===== تهيئة التطبيق =====

async function initApp() {
    // ربط التبويبات
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            if (tabId) switchTab(tabId);
        });
    });

    // تفعيل التبويب الافتراضي
    switchTab('mining');

    // التحقق من الجلسة
    await checkAutoLogin();

    // ربط الأحداث
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

    if (transferPointsToCasinoBtn) transferPointsToCasinoBtn.addEventListener('click', transferPointsToCasino);
    if (transferCasinoToPointsBtn) transferCasinoToPointsBtn.addEventListener('click', transferCasinoToPoints);
    if (buyPointsBtn) buyPointsBtn.addEventListener('click', buyPoints);
    if (sellPointsBtn) sellPointsBtn.addEventListener('click', sellPoints);
    if (withdrawBtn) withdrawBtn.addEventListener('click', requestWithdraw);
    if (depositBtn) depositBtn.addEventListener('click', submitDeposit);
    if (copyAddressBtn) copyAddressBtn.addEventListener('click', copyAddress);

    if (riskSlider) {
        riskSlider.addEventListener('input', function() {
            if (riskValue) riskValue.textContent = this.value;
        });
    }

    gameSelectors.forEach(btn => {
        btn.addEventListener('click', function() {
            updateGameSelection(this.dataset.game);
        });
    });

    if (playGameBtn) playGameBtn.addEventListener('click', playGame);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', clearSession);
}

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', initApp);
