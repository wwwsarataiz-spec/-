// ===== app.js - عميل Nexora =====

// عناصر DOM الأساسية
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

// عناصر المحفظة
const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
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

// عناصر تحويل النقاط
const transferRecipientEmail = document.getElementById('transferRecipientEmail');
const transferPointsAmount = document.getElementById('transferPointsAmount');
const transferPointsBtn = document.getElementById('transferPointsBtn');
const transferPointsStatus = document.getElementById('transferPointsStatus');

// عناصر الألعاب
const gameSelectors = document.querySelectorAll('.game-selector');
const riskSlider = document.getElementById('riskSlider');
const riskValue = document.getElementById('riskValue');
const betAmountInput = document.getElementById('betAmount');
const playGameBtn = document.getElementById('playGameBtn');
const gameResult = document.getElementById('gameResult');
const gameDetails = document.getElementById('gameDetails');

let selectedGame = 'chicken';

const DEPOSIT_ADDRESS = '0x2975dc1f8188c30b2a4be0ec27e33494da66cb46';

// ===== دوال مساعدة =====

function setSession(token, user) {
    localStorage.setItem('nexora_token', token);
    localStorage.setItem('nexora_user', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('nexora_token');
    localStorage.removeItem('nexora_user');
    loginOverlay.style.display = 'flex';
    sidebarUsername.textContent = 'زائر';
    sidebarBalance.textContent = '٠';
    sidebarCasinoBalance.textContent = '٠';
    updateSidebar(null);
    updateWalletUI(null);
    updateMiningUI(null);
    transactionsList.innerHTML = `<li style="color:#6a5f4e; text-align:center; justify-content:center;">لا توجد معاملات</li>`;
}

function updateSidebar(user) {
    if (user && user.name) {
        sidebarUsername.textContent = user.name;
        sidebarBalance.textContent = (user.balance || 0).toFixed(4);
        sidebarCasinoBalance.textContent = (user.casinoBalance || 0).toFixed(4);
    } else {
        sidebarUsername.textContent = 'زائر';
        sidebarBalance.textContent = '٠';
        sidebarCasinoBalance.textContent = '٠';
    }
}

function updateWalletUI(user) {
    if (!user) {
        walletBalanceDisplay.textContent = '0.0000';
        casinoBalanceDisplay.textContent = '0.0000';
        return;
    }
    walletBalanceDisplay.textContent = (user.balance || 0).toFixed(4);
    casinoBalanceDisplay.textContent = (user.casinoBalance || 0).toFixed(4);
}

function updateMiningUI(user) {
    if (!user) {
        miningEarningsDisplay.textContent = '0.0000';
        return;
    }
    miningEarningsDisplay.textContent = (user.miningEarnings || 0).toFixed(4);
}

function showLoginOverlay() { loginOverlay.style.display = 'flex'; }
function hideLoginOverlay() { loginOverlay.style.display = 'none'; }

// ===== جلب بيانات المستخدم من السيرفر =====

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
            miningMessage.textContent = data.message || 'فشل التعدين';
            miningMessage.style.color = '#e74c3c';
            return;
        }
        const user = {
            balance: data.balance,
            casinoBalance: data.casinoBalance,
            miningEarnings: data.miningEarnings
        };
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        miningMessage.textContent = '✅ ' + data.message;
        miningMessage.style.color = '#2ecc71';
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        miningMessage.textContent = 'خطأ في الاتصال';
        miningMessage.style.color = '#e74c3c';
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
            miningMessage.textContent = data.message || 'فشل الحصاد';
            miningMessage.style.color = '#e74c3c';
            return;
        }
        const user = {
            balance: data.balance,
            casinoBalance: data.casinoBalance,
            miningEarnings: data.miningEarnings
        };
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        miningMessage.textContent = '✅ ' + data.message;
        miningMessage.style.color = '#2ecc71';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        miningMessage.textContent = 'خطأ في الاتصال';
        miningMessage.style.color = '#e74c3c';
    }
}

// ===== دوال المحفظة =====

async function transferToCasino() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const amount = parseFloat(transferAmount.value);
    if (!amount || amount <= 0) {
        walletStatus.textContent = 'أدخل مبلغاً صحيحاً';
        walletStatus.style.color = '#e74c3c';
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
            walletStatus.textContent = data.message || 'فشل التحويل';
            walletStatus.style.color = '#e74c3c';
            return;
        }
        const user = { balance: data.balance, casinoBalance: data.casinoBalance };
        updateSidebar(user);
        updateWalletUI(user);
        walletStatus.textContent = '✅ ' + data.message;
        walletStatus.style.color = '#2ecc71';
        transferAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        stored.balance = data.balance;
        stored.casinoBalance = data.casinoBalance;
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        walletStatus.textContent = 'خطأ في الاتصال';
        walletStatus.style.color = '#e74c3c';
    }
}

async function requestWithdraw() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const address = withdrawAddress.value.trim();
    const amount = parseFloat(withdrawAmount.value);
    if (!address) {
        walletStatus.textContent = 'أدخل عنوان المحفظة';
        walletStatus.style.color = '#e74c3c';
        return;
    }
    if (!amount || amount < 4) {
        walletStatus.textContent = 'الحد الأدنى للسحب 4 USDT';
        walletStatus.style.color = '#e74c3c';
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
            walletStatus.textContent = data.message || 'فشل السحب';
            walletStatus.style.color = '#e74c3c';
            return;
        }
        const user = { balance: data.balance, casinoBalance: data.casinoBalance };
        updateSidebar(user);
        updateWalletUI(user);
        walletStatus.textContent = '✅ ' + data.message;
        walletStatus.style.color = '#2ecc71';
        withdrawAddress.value = '';
        withdrawAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        stored.balance = data.balance;
        stored.casinoBalance = data.casinoBalance;
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        walletStatus.textContent = 'خطأ في الاتصال';
        walletStatus.style.color = '#e74c3c';
    }
}

async function submitDeposit() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const txid = depositTxId.value.trim();
    if (!txid) {
        depositStatus.textContent = 'الرجاء إدخال رقم العملية';
        depositStatus.style.color = '#e74c3c';
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
            depositStatus.textContent = data.message || 'فشل تسجيل الإيداع';
            depositStatus.style.color = '#e74c3c';
            return;
        }
        depositStatus.textContent = '✅ ' + data.message;
        depositStatus.style.color = '#2ecc71';
        depositTxId.value = '';
        loadTransactions();
    } catch (error) {
        depositStatus.textContent = 'خطأ في الاتصال';
        depositStatus.style.color = '#e74c3c';
    }
}

function copyAddress() {
    navigator.clipboard.writeText(DEPOSIT_ADDRESS).then(() => {
        depositStatus.textContent = '✅ تم نسخ العنوان';
        depositStatus.style.color = '#2ecc71';
        setTimeout(() => { depositStatus.textContent = ''; }, 3000);
    }).catch(() => {
        depositStatus.textContent = '⚠️ فشل النسخ، حاول يدوياً';
        depositStatus.style.color = '#e67e22';
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

// ===== دوال تحويل النقاط (Market) =====

async function transferPoints() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const recipientEmail = transferRecipientEmail.value.trim();
    const amount = parseFloat(transferPointsAmount.value);
    if (!recipientEmail) {
        transferPointsStatus.textContent = 'أدخل بريد المستلم';
        transferPointsStatus.style.color = '#e74c3c';
        return;
    }
    if (!amount || amount <= 0) {
        transferPointsStatus.textContent = 'أدخل مبلغاً صحيحاً';
        transferPointsStatus.style.color = '#e74c3c';
        return;
    }
    try {
        const response = await fetch('/api/market/transfer-points', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientEmail, amount })
        });
        const data = await response.json();
        if (!response.ok) {
            transferPointsStatus.textContent = data.message || 'فشل التحويل';
            transferPointsStatus.style.color = '#e74c3c';
            return;
        }
        const user = { balance: data.balance };
        updateSidebar(user);
        updateWalletUI(user);
        transferPointsStatus.textContent = '✅ ' + data.message;
        transferPointsStatus.style.color = '#2ecc71';
        transferRecipientEmail.value = '';
        transferPointsAmount.value = '';
        loadTransactions();
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        stored.balance = data.balance;
        stored.transactions = data.transactions || [];
        localStorage.setItem('nexora_user', JSON.stringify(stored));
    } catch (error) {
        transferPointsStatus.textContent = 'خطأ في الاتصال';
        transferPointsStatus.style.color = '#e74c3c';
    }
}

// ===== دوال ألعاب الكازينو =====

// اختيار اللعبة
gameSelectors.forEach(btn => {
    btn.addEventListener('click', function() {
        gameSelectors.forEach(b => b.classList.remove('active-game'));
        this.classList.add('active-game');
        selectedGame = this.dataset.game;
    });
});

// شريط المخاطرة
riskSlider.addEventListener('input', function() {
    riskValue.textContent = this.value;
});

// زر التشغيل
playGameBtn.addEventListener('click', async function() {
    const token = localStorage.getItem('nexora_token');
    if (!token) { showLoginOverlay(); return; }
    const betAmount = parseFloat(betAmountInput.value);
    const risk = parseInt(riskSlider.value);
    if (!betAmount || betAmount <= 0) {
        gameResult.textContent = '⚠️ أدخل مبلغ رهان صحيح';
        gameResult.style.color = '#e74c3c';
        return;
    }
    // تعطيل الزر مؤقتاً
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
            gameResult.textContent = '❌ ' + (data.message || 'فشل اللعب');
            gameResult.style.color = '#e74c3c';
            gameDetails.textContent = '';
            return;
        }
        // عرض النتيجة
        gameResult.textContent = data.resultMessage;
        gameResult.style.color = data.win ? '#2ecc71' : '#e74c3c';
        gameDetails.textContent = `المضاعف: ${data.multiplier}x | فرصة الفوز: ${data.winProbability}% | الرقم: ${data.randomNumber}`;
        // تحديث رصيد الكازينو
        const userUpdate = { casinoBalance: data.newCasinoBalance };
        // نستدعي updateWalletUI و updateSidebar مع البيانات الجديدة
        // نحتاج لجلب كامل بيانات المستخدم من localStorage وتحديثها
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        stored.casinoBalance = data.newCasinoBalance;
        localStorage.setItem('nexora_user', JSON.stringify(stored));
        updateSidebar(stored);
        updateWalletUI(stored);
        // تحديث المعاملات
        loadTransactions();
    } catch (error) {
        gameResult.textContent = '⚠️ خطأ في الاتصال بالسيرفر';
        gameResult.style.color = '#e74c3c';
        gameDetails.textContent = '';
    } finally {
        this.disabled = false;
        this.textContent = '▶ تشغيل';
    }
});

// ===== دوال تسجيل الدخول والتسجيل =====

async function loginUser(email, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل تسجيل الدخول');
        setSession(data.token, data.user);
        const user = data.user;
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        hideLoginOverlay();
        loginError.textContent = '';
        loadTransactions();
        return true;
    } catch (error) {
        loginError.textContent = error.message;
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
        if (!response.ok) throw new Error(data.message || 'فشل إنشاء الحساب');
        setSession(data.token, data.user);
        const user = data.user;
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        hideLoginOverlay();
        signupError.textContent = '';
        loadTransactions();
        return true;
    } catch (error) {
        signupError.textContent = error.message;
        return false;
    }
}

// ===== تهيئة التطبيق (استعادة الجلسة) =====

async function initApp() {
    const token = localStorage.getItem('nexora_token');
    const storedUser = localStorage.getItem('nexora_user');

    if (token && storedUser) {
        try {
            const user = await fetchUserData();
            if (user) {
                updateSidebar(user);
                updateWalletUI(user);
                updateMiningUI(user);
                hideLoginOverlay();
                loadTransactions();
                return;
            }
        } catch (e) {
            try {
                const user = JSON.parse(storedUser);
                updateSidebar(user);
                updateWalletUI(user);
                updateMiningUI(user);
                hideLoginOverlay();
                loadTransactions();
                return;
            } catch (err) {
                clearSession();
            }
        }
    }
    showLoginOverlay();
}

// ===== ربط الأحداث =====

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    if (!email || !password) {
        loginError.textContent = 'يرجى ملء جميع الحقول';
        return;
    }
    await loginUser(email, password);
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    if (!name || !phone || !email || !password) {
        signupError.textContent = 'يرجى ملء جميع الحقول';
        return;
    }
    await registerUser(name, phone, email, password);
});

mineBtn.addEventListener('click', handleMine);
harvestBtn.addEventListener('click', handleHarvest);
transferBtn.addEventListener('click', transferToCasino);
withdrawBtn.addEventListener('click', requestWithdraw);
depositBtn.addEventListener('click', submitDeposit);
copyAddressBtn.addEventListener('click', copyAddress);

if (transferPointsBtn) {
    transferPointsBtn.addEventListener('click', transferPoints);
}

document.getElementById('logoutBtn').addEventListener('click', clearSession);

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', initApp);
