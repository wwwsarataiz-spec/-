// ===== app.js - عميل Nexora (محدث للعداد الحي والتأثيرات المشعة) =====

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
let miningCounterInterval = null; // مؤقت العداد الحي الجديد

const DEPOSIT_ADDRESS = '0x2975dc1f8188c30b2a4be0ec27e33494da66cb46';
const MAX_MINING_AMOUNT = 0.0040; // القيمة القصوى اليومية
const MAX_MINING_DURATION = 86400; // 24 ساعة بالثواني

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
    if (miningCounterInterval) {
        clearInterval(miningCounterInterval);
        miningCounterInterval = null;
    }
    if (mineBtn) {
        mineBtn.disabled = false;
        mineBtn.textContent = '⛏️ تعدين (يدوي)';
    }
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

// ====== دوال العداد الحي (المضافة حديثاً) ======
function startLiveMiningCounter(remainingSeconds) {
    if (miningCounterInterval) clearInterval(miningCounterInterval);
    
    // حساب الوقت المنقضي الحالي
    let totalElapsed = MAX_MINING_DURATION - remainingSeconds;
    
    miningCounterInterval = setInterval(() => {
        totalElapsed++;
        // أقصى حماية للبيانات
        if (totalElapsed >= MAX_MINING_DURATION) {
            totalElapsed = MAX_MINING_DURATION;
            clearInterval(miningCounterInterval);
            miningCounterInterval = null;
        }
        
        // حساب التقدم تصاعدياً وضربه بالقيمة القصوى
        const progress = totalElapsed / MAX_MINING_DURATION;
        const currentEarnings = progress * MAX_MINING_AMOUNT;
        
        // تحديث الواجهة و حالة العملة
        if (miningEarningsDisplay) {
            miningEarningsDisplay.textContent = currentEarnings.toFixed(4);
        }
        updateCoinState(true, remainingSeconds - totalElapsed);
    }, 50); // 50 مللي ثانية لسلاسة وسرعة رائعة
}
// =====================================================

async function updateMiningUIFromStatus(status) {
    if (!status) return;
    
    // إيقاف أي عدادات قديمة
    if (miningCounterInterval) {
        clearInterval(miningCounterInterval);
        miningCounterInterval = null;
    }
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
    }

    if (status.canMine) {
        if (mineBtn) {
            mineBtn.disabled = false;
            mineBtn.textContent = '⛏️ تعدين (يدوي)';
        }
        if (miningMessage) miningMessage.textContent = '';
        updateCoinState(true, 0);
        // قيمة ثابتة عند انتهاء التعدين
        if (miningEarningsDisplay) {
            miningEarningsDisplay.textContent = (status.miningEarnings || 0).toFixed(4);
        }
    } else {
        if (mineBtn) {
            mineBtn.disabled = true;
            const remaining = status.cooldownRemaining || 0;
            updateCooldownButton(remaining);
            updateCoinState(false, remaining);
        }
        
        // بدء العداد الحي التصاعدي بناءً على الوقت المتبقي
        startLiveMiningCounter(status.cooldownRemaining);
        
        // مؤقت التحديث العكسي للثواني
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
            if (cooldownTimer) {
                const hours = Math.floor(remainingSeconds / 3600);
                const minutes = Math.floor((remainingSeconds % 3600) / 60);
                const secs = remainingSeconds % 60;
                cooldownTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
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

// ===== دوال المحفظة, السوق, التحويل الداخلي, والألعاب =====
// ⚠️ تنبيه صارم: في الكود الذي أرسلته لي سابقاً، هذه الدوال كانت مختصرة بـ "...". 
// لقد وضعت لك مساحة هنا لإعادة لصق أكوادك القديمة الأصلية الخاصة بهذه الدوال (مثل: loadTransactions, transferToCasino, buyPoints, playGame)
// لأنني لا أملكها. اتركها هنا كما هي ولصق أكوادك تحتها:

// [ ضع هنا دوال التحويل الداخلي: transferPointsToCasino, transferCasinoToPoints ]
// [ ضع هنا دوال الإيداع والسحب: handleDeposit, handleWithdraw ]
// [ ضع هنا دوال سوق الاستبدال: buyPoints, sellPoints ]
// [ ضع هنا دوال الألعاب: playGame ]
// [ ضع هنا دوال المعاملات: loadTransactions, renderTransactions ]


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

    // إضافة: إيقاف العداد إذا غادر المستخدم تبويبة التعدين للحفاظ على الأداء
    if (tabId !== 'mining' && miningCounterInterval) {
        clearInterval(miningCounterInterval);
        miningCounterInterval = null;
    }
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

    // ربط الأحداث (قم بربط أزرارك القديمة هنا)
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

    // [ هنا ضع روابط أزرار المحفظة والألعاب الخاصة بك في هذا الموقع ] 
    // (مثال: if(transferPointsToCasinoBtn) transferPointsToCasinoBtn.addEventListener(...))

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', clearSession);
}

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', initApp);
