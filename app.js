// ================================================================
// 1. البيانات الأساسية والمتغيرات
// ================================================================
let currentBalance = 0;
let casinoBalance = 0;
let users = [];
let pendingUsers = [];
let withdrawals = [];
let adminRevenue = 0;
let miningPlans = [];
let flexMiningPlans = [];
let points = 0;
let exchangeRate = 1.00;
let houseEdge = 5;
let currentUser = null;
let isLoginMode = true;
let adViews = 0;
let lastFreeMining = 0;
let adminToken = null;
let withdrawalBlocked = false;

// ===== متغيرات التعدين الجديدة =====
let miningClicks = 0;
let miningMaxClicks = 100;
let miningProgress = 0;
let miningLastReset = 0;

// ===== إعدادات مستويات الصعوبة للعبة الدجاجة =====
const DIFFICULTIES = {
    normal: { label: 'عادي', baseMultiplier: 1.3, increment: 0.1, bombs: 3 },
    medium: { label: 'متوسط', baseMultiplier: 1.6, increment: 0.15, bombs: 5 },
    hard: { label: 'صعب', baseMultiplier: 2.0, increment: 0.2, bombs: 7 },
    veryhard: { label: 'صعب جداً', baseMultiplier: 2.2, increment: 0.25, bombs: 9 }
};

// ================================================================
// 2. تسجيل الدخول والمصادقة
// ================================================================
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const btn = document.getElementById('authActionBtn');
    const toggleText = document.getElementById('toggleAuthText');
    const fullNameField = document.getElementById('loginFullName');
    const phoneField = document.getElementById('loginPhone');

    if (isLoginMode) {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
        toggleText.textContent = 'ليس لديك حساب؟ سجل الآن';
        fullNameField.style.display = 'none';
        phoneField.style.display = 'none';
    } else {
        btn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء حساب';
        toggleText.textContent = 'لديك حساب؟ سجل دخول';
        fullNameField.style.display = 'block';
        phoneField.style.display = 'block';
    }
    document.getElementById('authError').textContent = '';
}

async function handleAuth() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('authError');

    if (!email || !password) {
        errorEl.textContent = '⚠️ يرجى ملء البريد وكلمة المرور';
        return;
    }

    if (isLoginMode) {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                currentUser = data.user;
                localStorage.setItem('nexora_user', JSON.stringify(data.user));
                afterLogin(data.user);
            } else {
                errorEl.textContent = '❌ ' + (data.message || 'بيانات خاطئة');
            }
        } catch (e) {
            errorEl.textContent = '❌ خطأ في الشبكة';
            console.error('Login error:', e);
        }
    } else {
        const fullName = document.getElementById('loginFullName').value.trim();
        const phone = document.getElementById('loginPhone').value.trim();
        if (!fullName || !phone) {
            errorEl.textContent = '⚠️ املأ الاسم ورقم الجوال';
            return;
        }
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, email, phone, password })
            });
            const data = await res.json();
            if (data.success) {
                currentUser = data.user;
                localStorage.setItem('nexora_user', JSON.stringify(data.user));
                alert('✅ تم التسجيل بنجاح!');
                afterLogin(data.user);
                errorEl.textContent = '';
            } else {
                errorEl.textContent = '❌ ' + (data.message || 'فشل التسجيل');
            }
        } catch (e) {
            errorEl.textContent = '❌ خطأ في الشبكة';
            console.error('Register error:', e);
        }
    }
}

function afterLogin(user) {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('liveBalance').innerHTML = user.balance.toFixed(6) + ' <small>USDT</small>';
    currentBalance = user.balance;
    casinoBalance = user.casinoBalance || 0;
    document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
    points = user.points || 0;
    document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
    document.getElementById('walletBalance').innerHTML = user.balance.toFixed(6) + ' <small>USDT</small>';
    document.getElementById('walletPoints').textContent = points;

    // استعادة حالة التعدين
    miningProgress = user.miningProgress || 0;
    miningClicks = user.miningClicks || 0;
    miningMaxClicks = user.miningMaxClicks || 100;
    miningLastReset = new Date(user.miningLastReset || Date.now()).getTime();
    document.getElementById('miningProgressDisplay').textContent = miningProgress.toFixed(6) + ' USDT';
    document.getElementById('miningClicksDisplay').textContent = `${miningClicks} / ${miningMaxClicks}`;
    document.getElementById('miningRemainingDisplay').textContent = miningMaxClicks - miningClicks;

    // التحقق من إعادة الضبط اليومي
    const now = Date.now();
    if (now - miningLastReset > 24 * 60 * 60 * 1000) {
        miningClicks = 0;
        miningLastReset = now;
        document.getElementById('miningClicksDisplay').textContent = `0 / ${miningMaxClicks}`;
        document.getElementById('miningRemainingDisplay').textContent = miningMaxClicks;
    }

    // عرض وقت إعادة الضبط المتبقي
    const resetIn = Math.max(0, 24 - (now - miningLastReset) / (60 * 60 * 1000));
    document.getElementById('miningResetDisplay').textContent = resetIn > 0 ? `${Math.ceil(resetIn)} ساعة` : 'يمكنك البدء الآن';

    // رسالة الترحيب
    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) welcomeEl.textContent = `مرحباً، ${user.fullName}`;

    // عرض الجولات المجانية
    const freeRoundsEl = document.getElementById('freeRoundsDisplay');
    if (freeRoundsEl) freeRoundsEl.textContent = user.freeRounds || 0;
    const freeRoundsEl2 = document.getElementById('freeRoundsDisplay2');
    if (freeRoundsEl2) freeRoundsEl2.textContent = user.freeRounds || 0;

    showDashboard();
    if (typeof loadUserPlans === 'function') loadUserPlans(user);
    if (!users.find(u => u._id === user._id)) {
        users.push(user);
    }
    loadActiveAds();
    loadAllAdsForAdmin();
    loadUserTransactions(user._id);
    loadMarketOrders();
    if (user.isAgent) loadAgentPendingOrders();
    checkWithdrawalStatus();
}

// ================================================================
// 3. التنقل بين الأقسام
// ================================================================
function showDashboard() {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    const dashboard = document.getElementById('section-dashboard');
    if (dashboard) dashboard.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === 'dashboard') item.classList.add('active');
    });
}

function navigateTo(section) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('section-' + section);
    if (target) {
        target.classList.add('active');
    } else {
        showDashboard();
        return;
    }
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) item.classList.add('active');
    });
    if (section === 'ads') loadActiveAds();
    if (section === 'wallet') {
        if (currentUser) loadUserTransactions(currentUser._id);
        checkWithdrawalStatus();
    }
    if (section === 'casino') {
        setTimeout(initCasinoGames, 100);
        if (currentUser) {
            document.getElementById('freeRoundsDisplay').textContent = currentUser.freeRounds || 0;
            document.getElementById('freeRoundsDisplay2').textContent = currentUser.freeRounds || 0;
        }
    }
    if (section === 'market') loadMarketOrders();
}

// ================================================================
// 4. التعدين اليدوي الجديد
// ================================================================
async function performMiningClick() {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول');
        return;
    }

    try {
        const res = await fetch('/api/mining/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id })
        });
        const data = await res.json();

        if (data.success) {
            miningProgress = data.miningProgress;
            miningClicks = data.miningClicks;
            const remaining = data.remaining;

            document.getElementById('miningProgressDisplay').textContent = miningProgress.toFixed(6) + ' USDT';
            document.getElementById('miningClicksDisplay').textContent = `${miningClicks} / ${miningMaxClicks}`;
            document.getElementById('miningRemainingDisplay').textContent = remaining;

            if (data.bonus > 0) {
                alert(`🎉 مكافأة! +${data.bonus.toFixed(4)} USDT`);
            }
            if (data.freeRound) {
                alert('🎁 جولة مجانية إضافية!');
                if (currentUser) {
                    currentUser.freeRounds = (currentUser.freeRounds || 0) + 1;
                    document.getElementById('freeRoundsDisplay').textContent = currentUser.freeRounds;
                    document.getElementById('freeRoundsDisplay2').textContent = currentUser.freeRounds;
                    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
                }
            }

            if (currentUser) {
                currentUser.miningProgress = miningProgress;
                currentUser.miningClicks = miningClicks;
                localStorage.setItem('nexora_user', JSON.stringify(currentUser));
            }
        } else {
            alert('⚠️ ' + data.message);
        }
    } catch (error) {
        console.error('Mining click error:', error);
        alert('❌ خطأ في الشبكة');
    }
}

async function harvestMining() {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول');
        return;
    }

    if (miningProgress <= 0) {
        alert('⚠️ لا توجد أرباح للحصاد');
        return;
    }

    try {
        const res = await fetch('/api/mining/harvest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id })
        });
        const data = await res.json();

        if (data.success) {
            currentBalance = data.newBalance;
            miningProgress = 0;
            document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
            document.getElementById('miningProgressDisplay').textContent = '0.0000 USDT';
            alert(`✅ تم حصاد ${data.harvested.toFixed(6)} USDT بنجاح!`);

            if (currentUser) {
                currentUser.balance = currentBalance;
                currentUser.miningProgress = 0;
                localStorage.setItem('nexora_user', JSON.stringify(currentUser));
            }
        } else {
            alert('⚠️ ' + data.message);
        }
    } catch (error) {
        console.error('Harvest error:', error);
        alert('❌ خطأ في الشبكة');
    }
}

// ================================================================
// 5. التعدين المجاني (يومي)
// ================================================================
function claimFreeMining() {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول أولاً');
        return;
    }
    const now = Date.now();
    if (now - lastFreeMining < 86400000) {
        const remaining = Math.ceil((86400000 - (now - lastFreeMining)) / 3600000);
        document.getElementById('freeMiningStatus').textContent = `⏳ انتظر ${remaining} ساعة`;
        return;
    }
    const reward = 0.005;
    currentBalance += reward;
    document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
    lastFreeMining = now;
    document.getElementById('freeMiningStatus').textContent = `✅ تم إضافة ${reward.toFixed(4)} USDT`;
    document.getElementById('freeMiningCounter').textContent = `${reward.toFixed(4)} USDT`;
    if (currentUser) {
        currentUser.balance = currentBalance;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
    setTimeout(() => {
        document.getElementById('freeMiningStatus').textContent = '';
    }, 5000);
}

// ================================================================
// 6. التعدين المدفوع المرن
// ================================================================
function updateInvestmentCalc() {
    const amount = parseFloat(document.getElementById('investAmount').value);
    if (isNaN(amount) || amount < 3) {
        document.getElementById('dailyProfitDisplay').textContent = '0.00 USDT';
        document.getElementById('totalProfitDisplay').textContent = '0.00 USDT';
        return;
    }
    let dailyRate = 0.03;
    if (amount > 30) dailyRate = 0.04;
    const daily = amount * dailyRate;
    const total = daily * 50;
    document.getElementById('dailyProfitDisplay').textContent = daily.toFixed(2) + ' USDT';
    document.getElementById('totalProfitDisplay').textContent = total.toFixed(2) + ' USDT';
}

function purchaseFlexMining() {
    if (!currentUser) { alert('⚠️ يرجى تسجيل الدخول'); return; }
    const amount = parseFloat(document.getElementById('investAmount').value);
    if (isNaN(amount) || amount < 3) { alert('⚠️ الحد الأدنى 3 USDT'); return; }
    if (currentBalance < amount) { alert('❌ رصيد غير كاف'); return; }
    if (flexMiningPlans.find(p => p.userId === currentUser._id)) {
        alert('⚠️ لديك خطة نشطة بالفعل');
        return;
    }
    if (!confirm(`سيتم خصم ${amount} USDT لبدء خطة مدتها 50 يوماً. هل تتابع؟`)) return;
    currentBalance = Math.max(0, currentBalance - amount);
    const dailyRate = amount > 30 ? 0.04 : 0.03;
    const dailyProfit = amount * dailyRate;
    flexMiningPlans.push({
        userId: currentUser._id,
        capital: amount,
        dailyProfit: dailyProfit,
        day: 0,
        duration: 50,
        startDate: new Date().toISOString()
    });
    currentUser.totalInvested = (currentUser.totalInvested || 0) + amount;
    document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
    document.getElementById('flexMiningStatus').textContent = `✅ تم تفعيل الخطة! الأرباح اليومية: ${dailyProfit.toFixed(2)} USDT`;
    if (currentUser) {
        currentUser.balance = currentBalance;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
    refreshAdminData();
}

// ================================================================
// 7. الإعدادات (أيقونة الترس)
// ================================================================
function openSettings() {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول أولاً');
        return;
    }
    const modal = document.getElementById('settingsModal');
    if (modal) {
        document.getElementById('settingsFullName').value = currentUser.fullName || '';
        document.getElementById('settingsEmail').value = currentUser.email || '';
        document.getElementById('settingsLanguage').value = currentUser.language || 'ar';
        modal.style.display = 'flex';
    }
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

async function saveSettings() {
    const fullName = document.getElementById('settingsFullName').value.trim();
    const password = document.getElementById('settingsPassword').value.trim();
    const language = document.getElementById('settingsLanguage').value;

    if (!fullName) {
        alert('⚠️ الاسم مطلوب');
        return;
    }

    try {
        const res = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser._id,
                fullName,
                password: password || undefined,
                language
            })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('nexora_user', JSON.stringify(data.user));
            document.getElementById('welcomeMessage').textContent = `مرحباً، ${data.user.fullName}`;
            alert('✅ تم تحديث البيانات بنجاح');
            closeSettings();
            if (language === 'en') {
                document.body.dir = 'ltr';
                document.documentElement.lang = 'en';
            } else {
                document.body.dir = 'rtl';
                document.documentElement.lang = 'ar';
            }
        } else {
            alert('❌ ' + data.message);
        }
    } catch (e) {
        console.error('خطأ في حفظ الإعدادات:', e);
        alert('❌ خطأ في الشبكة');
    }
}

// ================================================================
// 8. المحفظة (مع تحذير BEP20)
// ================================================================
function copyAddress() {
    const a = document.getElementById('walletAddress');
    if (a) { a.select(); document.execCommand('copy'); alert('✅ تم نسخ العنوان'); }
}

async function submitWithdraw() {
    if (withdrawalBlocked) {
        alert('⛔ السحب متوقف مؤقتاً من قبل الإدارة');
        return;
    }
    const address = document.getElementById('withdrawAddress').value.trim();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const resultEl = document.getElementById('withdrawResult');

    if (!address || address.length < 10) {
        resultEl.textContent = '⚠️ أدخل عنوان محفظة صحيح (BEP20)';
        resultEl.style.color = '#e74c3c';
        return;
    }
    if (!amount || amount < 10) {
        resultEl.textContent = '⚠️ الحد الأدنى 10 USDT';
        resultEl.style.color = '#e74c3c';
        return;
    }
    if (currentBalance < amount) {
        resultEl.textContent = '⚠️ رصيد غير كاف';
        resultEl.style.color = '#e74c3c';
        return;
    }

    if (!confirm('⚠️ تنبيه هام: الإيداع والسحب يتم حصرياً عبر شبكة Smart Chain (BEP20). إرسال الأموال عبر أي شبكة أخرى سيتسبب في فقدانها بشكل دائم. هل أنت متأكد؟')) {
        return;
    }

    currentBalance = Math.max(0, currentBalance - amount);
    withdrawals.push({ user: currentUser ? currentUser.fullName : 'Guest', amount, address, status: 'pending' });
    document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
    resultEl.textContent = `✅ تم تقديم طلب سحب ${amount.toFixed(2)} USDT إلى ${address}`;
    resultEl.style.color = '#2ecc71';
    document.getElementById('withdrawAddress').value = '';
    document.getElementById('withdrawAmount').value = '';
    refreshAdminData();
    loadUserTransactions(currentUser?._id);
}

function sellPoints() {
    const pts = parseFloat(document.getElementById('pointsToSell').value);
    if (!pts || pts <= 0) { alert('⚠️ أدخل عدد النقاط'); return; }
    if (pts > points) { alert('⚠️ نقاط غير كافية'); return; }
    const usdt = pts / 1000 * exchangeRate;
    points -= pts;
    currentBalance += usdt;
    document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
    document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
    alert(`✅ تم بيع ${pts} نقطة مقابل ${usdt.toFixed(4)} USDT`);
    document.getElementById('pointsToSell').value = '';
    if (currentUser) {
        currentUser.points = points;
        currentUser.balance = currentBalance;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
}

// ================================================================
// 9. تحويل الرصيد من المحفظة إلى الكازينو
// ================================================================
async function transferToCasino() {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول');
        return;
    }
    const amount = parseFloat(document.getElementById('transferAmount').value);
    if (!amount || amount <= 0) {
        alert('⚠️ أدخل مبلغاً صحيحاً');
        return;
    }
    if (currentBalance < amount) {
        alert('لا يوجد لديك رصيد كافٍ في المحفظة');
        return;
    }
    try {
        const res = await fetch('/api/wallet/transfer-to-casino', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id, amount })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            currentBalance = data.user.balance;
            casinoBalance = data.user.casinoBalance || 0;
            localStorage.setItem('nexora_user', JSON.stringify(data.user));
            document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
            document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
            document.getElementById('walletBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
            alert('✅ تم التحويل بنجاح');
            document.getElementById('transferAmount').value = '';
            loadUserTransactions(currentUser._id);
        } else {
            alert('❌ ' + data.message);
        }
    } catch (e) {
        console.error('خطأ في التحويل:', e);
        alert('❌ خطأ في الشبكة');
    }
}

// ================================================================
// 10. الإعلانات الممولة (مع حاسبة التكلفة)
// ================================================================
function updateAdCost() {
    const targetViews = parseInt(document.getElementById('adTargetViews').value) || 0;
    const cost = targetViews * 0.001;
    document.getElementById('adCostDisplay').textContent = cost.toFixed(2);
}

async function submitAd() {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول');
        return;
    }

    const title = document.getElementById('adTitle').value.trim();
    const content = document.getElementById('adContent').value.trim();
    const link = document.getElementById('adLink').value.trim();
    const targetViews = parseInt(document.getElementById('adTargetViews').value);

    if (!title || !content || !link || !targetViews) {
        document.getElementById('adSubmitStatus').textContent = '⚠️ املأ جميع الحقول';
        document.getElementById('adSubmitStatus').style.color = '#e74c3c';
        return;
    }
    if (targetViews < 1) {
        document.getElementById('adSubmitStatus').textContent = '⚠️ عدد المشاهدات يجب أن يكون أكبر من 0';
        document.getElementById('adSubmitStatus').style.color = '#e74c3c';
        return;
    }

    const totalCost = targetViews * 0.001;

    if (!confirm(`💰 سيتم خصم ${totalCost.toFixed(2)} USDT من رصيدك لنشر الإعلان (${targetViews} مشاهدة).\nهل تتابع؟`)) {
        return;
    }

    try {
        const response = await fetch('/api/ads/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                content,
                link,
                targetViews,
                userId: currentUser._id,
                userName: currentUser.fullName
            })
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('adSubmitStatus').textContent = data.message;
            document.getElementById('adSubmitStatus').style.color = '#2ecc71';
            document.getElementById('adTitle').value = '';
            document.getElementById('adContent').value = '';
            document.getElementById('adLink').value = '';
            document.getElementById('adTargetViews').value = '1000';
            updateAdCost();
            if (currentUser) {
                const userRes = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentUser.email, password: currentUser.password })
                });
                const userData = await userRes.json();
                if (userData.success) {
                    currentUser = userData.user;
                    currentBalance = userData.user.balance;
                    document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
                    localStorage.setItem('nexora_user', JSON.stringify(userData.user));
                }
            }
            refreshAdminData();
            loadAllAdsForAdmin();
        } else {
            document.getElementById('adSubmitStatus').textContent = '❌ ' + data.message;
            document.getElementById('adSubmitStatus').style.color = '#e74c3c';
            alert(data.message);
        }
    } catch (error) {
        console.error('خطأ في نشر الإعلان:', error);
        document.getElementById('adSubmitStatus').textContent = '❌ خطأ في الشبكة';
        document.getElementById('adSubmitStatus').style.color = '#e74c3c';
    }
}

async function watchAd(adId) {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول لمشاهدة الإعلانات');
        return;
    }

    try {
        const response = await fetch('/api/ads/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adId, userId: currentUser._id })
        });
        const data = await response.json();

        if (data.success) {
            const adCard = document.querySelector(`[data-ad-id="${adId}"]`);
            if (adCard) {
                const viewsSpan = adCard.querySelector('.ad-views-count');
                if (viewsSpan) {
                    viewsSpan.textContent = data.currentViews + ' / ' + data.targetViews;
                }
                const progressFill = adCard.querySelector('.ad-progress-fill');
                if (progressFill) {
                    const progress = (data.currentViews / data.targetViews) * 100;
                    progressFill.style.width = Math.min(progress, 100) + '%';
                }
                if (data.completed) {
                    adCard.style.opacity = '0.5';
                    const statusEl = adCard.querySelector('.ad-status');
                    if (statusEl) {
                        statusEl.textContent = '✅ مكتمل';
                        statusEl.style.color = '#2ecc71';
                    }
                    const watchBtn = adCard.querySelector('.btn-gold');
                    if (watchBtn) watchBtn.disabled = true;
                }
            }

            // تحديث النقاط والجولات المجانية
            const savedUser = localStorage.getItem('nexora_user');
            if (savedUser) {
                try {
                    const user = JSON.parse(savedUser);
                    user.points = (user.points || 0) + 0.5;
                    // الجولة المجانية تضاف من الخادم، لكننا نحدث العرض
                    const userRes = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: currentUser.email, password: currentUser.password })
                    });
                    const userData = await userRes.json();
                    if (userData.success) {
                        currentUser = userData.user;
                        points = userData.user.points;
                        document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
                        document.getElementById('freeRoundsDisplay').textContent = currentUser.freeRounds || 0;
                        document.getElementById('freeRoundsDisplay2').textContent = currentUser.freeRounds || 0;
                        localStorage.setItem('nexora_user', JSON.stringify(userData.user));
                    }
                } catch (e) {}
            }

            document.getElementById('adMessage').textContent = '✅ تم تسجيل المشاهدة! +0.5 نقطة';
            document.getElementById('adMessage').style.color = '#2ecc71';
            loadActiveAds();
        } else {
            document.getElementById('adMessage').textContent = '⚠️ ' + data.message;
            document.getElementById('adMessage').style.color = '#f39c12';
        }
    } catch (error) {
        console.error('خطأ في مشاهدة الإعلان:', error);
        document.getElementById('adMessage').textContent = '❌ خطأ في الشبكة';
        document.getElementById('adMessage').style.color = '#e74c3c';
    }
}

async function loadActiveAds() {
    try {
        const response = await fetch('/api/ads/active');
        const data = await response.json();
        const container = document.getElementById('activeAdsContainer');
        if (!container) return;

        if (data.success && data.ads.length > 0) {
            container.innerHTML = data.ads.map(ad => `
                <div class="ad-card" data-ad-id="${ad._id}">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div style="flex:1;">
                            <h4 style="color:var(--gold); margin-bottom:4px;">${ad.title}</h4>
                            <p style="font-size:clamp(11px,2vw,13px); color:#8a7fa0;">${ad.content}</p>
                            <a href="${ad.link}" target="_blank" style="color:var(--purple); font-size:clamp(11px,2vw,13px); word-break:break-all;">${ad.link}</a>
                        </div>
                        <span class="ad-status" style="font-size:clamp(10px,2vw,12px); color:#2ecc71; background:rgba(46,204,113,0.1); padding:2px 10px; border-radius:12px;">نشط</span>
                    </div>
                    <div style="margin-top:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:clamp(10px,2vw,12px); color:#8a7fa0;">
                            <span>المشاهدات: <span class="ad-views-count">${ad.currentViews} / ${ad.targetViews}</span></span>
                            <span>المعلن: ${ad.advertiserName}</span>
                        </div>
                        <div class="ad-progress" style="width:100%; height:4px; background:rgba(255,255,255,0.05); border-radius:4px; margin:4px 0; overflow:hidden;">
                            <div class="ad-progress-fill" style="height:100%; width:${Math.min((ad.currentViews/ad.targetViews)*100, 100)}%; background:linear-gradient(90deg, var(--gold), var(--purple)); border-radius:4px; transition:width 0.5s ease;"></div>
                        </div>
                    </div>
                    <button class="btn btn-gold" onclick="watchAd('${ad._id}')" style="width:100%; margin-top:6px; padding:8px;">
                        <i class="fas fa-play"></i> مشاهدة الإعلان (+0.5 نقطة)
                    </button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color:#8a7fa0; font-size:clamp(12px,2.5vw,14px); text-align:center;">لا توجد إعلانات نشطة حالياً</p>';
        }
    } catch (error) {
        console.error('خطأ في جلب الإعلانات:', error);
    }
}

async function loadAllAdsForAdmin() {
    try {
        const response = await fetch('/api/ads/all');
        const data = await response.json();
        const container = document.getElementById('adminAdsList');
        if (!container) return;

        if (data.success && data.ads.length > 0) {
            container.innerHTML = data.ads.map(ad => `
                <div style="background:var(--glass-bg); padding:10px; border-radius:8px; margin:6px 0; backdrop-filter:blur(4px);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                        <div>
                            <span style="font-weight:600; color:var(--gold);">${ad.title}</span>
                            <span style="font-size:clamp(10px,2vw,12px); color:#8a7fa0; margin-right:8px;">(${ad.advertiserName})</span>
                        </div>
                        <span style="font-size:clamp(10px,2vw,12px); padding:2px 10px; border-radius:12px; background:${ad.status === 'pending' ? 'rgba(241,196,15,0.2)' : ad.status === 'active' ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.2)'}; color:${ad.status === 'pending' ? '#f1c40f' : ad.status === 'active' ? '#2ecc71' : ad.status === 'completed' ? '#2ecc71' : '#e74c3c'};">
                            ${ad.status === 'pending' ? 'قيد المراجعة' : ad.status === 'active' ? 'نشط' : ad.status === 'completed' ? 'مكتمل' : 'مرفوض'}
                        </span>
                    </div>
                    <div style="font-size:clamp(10px,2vw,12px); color:#8a7fa0; margin-top:4px;">
                        <span>المشاهدات: ${ad.currentViews} / ${ad.targetViews}</span>
                        <span style="margin-right:12px;">التكلفة: ${ad.totalCost.toFixed(2)} USDT</span>
                    </div>
                    ${ad.status === 'pending' ? `
                        <div style="margin-top:6px; display:flex; gap:6px;">
                            <button class="mini-btn" style="border-color:#2ecc71; color:#2ecc71;" onclick="approveAdAdmin('${ad._id}')"><i class="fas fa-check"></i> موافقة</button>
                            <button class="mini-btn" style="border-color:#e74c3c; color:#e74c3c;" onclick="rejectAdAdmin('${ad._id}')"><i class="fas fa-times"></i> رفض</button>
                            <button class="mini-btn" style="border-color:#e74c3c; color:#e74c3c;" onclick="deleteAd('${ad._id}')"><i class="fas fa-trash"></i> حذف</button>
                        </div>
                    ` : `
                        <button class="mini-btn" style="border-color:#e74c3c; color:#e74c3c; margin-top:4px;" onclick="deleteAd('${ad._id}')"><i class="fas fa-trash"></i> حذف</button>
                    `}
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color:#8a7fa0; font-size:clamp(12px,2.5vw,14px);">لا توجد إعلانات</p>';
        }
    } catch (error) {
        console.error('خطأ في جلب الإعلانات للإدارة:', error);
    }
}

async function approveAdAdmin(adId) {
    if (!confirm('✅ هل أنت متأكد من الموافقة على هذا الإعلان؟')) return;
    try {
        const response = await fetch('/api/ads/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adId })
        });
        const data = await response.json();
        if (data.success) {
            alert('✅ تم الموافقة على الإعلان');
            loadAllAdsForAdmin();
            loadActiveAds();
            refreshAdminData();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        console.error('خطأ:', error);
        alert('❌ خطأ في الشبكة');
    }
}

async function rejectAdAdmin(adId) {
    if (!confirm('❌ هل أنت متأكد من رفض هذا الإعلان؟')) return;
    try {
        const response = await fetch('/api/ads/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adId })
        });
        const data = await response.json();
        if (data.success) {
            alert('❌ تم رفض الإعلان');
            loadAllAdsForAdmin();
            refreshAdminData();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        console.error('خطأ:', error);
        alert('❌ خطأ في الشبكة');
    }
}

async function deleteAd(adId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الإعلان نهائياً؟')) return;
    try {
        const response = await fetch('/api/ads/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adId })
        });
        const data = await response.json();
        if (data.success) {
            alert('✅ تم حذف الإعلان');
            loadAllAdsForAdmin();
            loadActiveAds();
            refreshAdminData();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        console.error('خطأ:', error);
        alert('❌ خطأ في الشبكة');
    }
}

// ================================================================
// 11. سوق النقاط (مع عداد)
// ================================================================
async function loadMarketOrders() {
    try {
        const sellRes = await fetch('/api/market/sell-orders');
        const sellData = await sellRes.json();
        const sellContainer = document.getElementById('sellOrdersList');
        const sellCountEl = document.getElementById('sellCount');

        if (sellContainer && sellData.success) {
            if (sellCountEl) sellCountEl.textContent = sellData.count || 0;
            if (sellData.agents.length > 0) {
                sellContainer.innerHTML = sellData.agents.map(agent => `
                    <div style="background:var(--glass-bg); padding:10px; border-radius:8px; margin:6px 0; backdrop-filter:blur(4px);">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                            <span style="font-weight:600; color:var(--gold);">${agent.fullName}</span>
                            <span style="color:#2ecc71; font-weight:700;">${agent.sellPrice.toFixed(4)} USDT</span>
                        </div>
                        <div style="font-size:clamp(10px,2vw,12px); color:#8a7fa0; margin-top:4px;">
                            <span>${agent.email} | ${agent.phone}</span>
                        </div>
                        <button class="btn btn-gold" onclick="openMarketOrder('buy', '${agent.agentId}')" style="width:100%; margin-top:6px; padding:6px;">
                            <i class="fas fa-shopping-cart"></i> شراء نقاط
                        </button>
                    </div>
                `).join('');
            } else {
                sellContainer.innerHTML = '<p style="color:#8a7fa0;">لا يوجد بائعون نشطون</p>';
            }
        }

        const buyRes = await fetch('/api/market/buy-orders');
        const buyData = await buyRes.json();
        const buyContainer = document.getElementById('buyOrdersList');
        const buyCountEl = document.getElementById('buyCount');

        if (buyContainer && buyData.success) {
            if (buyCountEl) buyCountEl.textContent = buyData.count || 0;
            if (buyData.agents.length > 0) {
                buyContainer.innerHTML = buyData.agents.map(agent => `
                    <div style="background:var(--glass-bg); padding:10px; border-radius:8px; margin:6px 0; backdrop-filter:blur(4px);">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                            <span style="font-weight:600; color:var(--gold);">${agent.fullName}</span>
                            <span style="color:#e74c3c; font-weight:700;">${agent.buyPrice.toFixed(4)} USDT</span>
                        </div>
                        <div style="font-size:clamp(10px,2vw,12px); color:#8a7fa0; margin-top:4px;">
                            <span>${agent.email} | ${agent.phone}</span>
                        </div>
                        <button class="btn btn-gold" onclick="openMarketOrder('sell', '${agent.agentId}')" style="width:100%; margin-top:6px; padding:6px;">
                            <i class="fas fa-coins"></i> بيع نقاط
                        </button>
                    </div>
                `).join('');
            } else {
                buyContainer.innerHTML = '<p style="color:#8a7fa0;">لا يوجد مشترون نشطون</p>';
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل سوق النقاط:', error);
    }
}

function openMarketOrder(type, agentId) {
    const points = prompt(`أدخل عدد النقاط التي ترغب في ${type === 'buy' ? 'شرائها' : 'بيعها'}:`);
    if (!points || isNaN(points) || points <= 0) {
        alert('⚠️ أدخل عدد نقاط صحيح');
        return;
    }
    createMarketOrder(type, agentId, parseInt(points));
}

async function createMarketOrder(type, agentId, points) {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول أولاً');
        return;
    }
    try {
        const response = await fetch('/api/market/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                userId: currentUser._id,
                agentId,
                points
            })
        });
        const data = await response.json();
        if (data.success) {
            alert(data.message);
            const userRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email, password: currentUser.password })
            });
            const userData = await userRes.json();
            if (userData.success) {
                currentUser = userData.user;
                currentBalance = userData.user.balance;
                points = userData.user.points || 0;
                document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
                document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
                localStorage.setItem('nexora_user', JSON.stringify(userData.user));
            }
            loadMarketOrders();
            loadUserTransactions(currentUser._id);
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        console.error('خطأ في إنشاء الأمر:', error);
        alert('❌ خطأ في الشبكة');
    }
}

// ================================================================
// 12. طلب التاجر (مع منع الضغط المتكرر)
// ================================================================
let agentRequestInProgress = false;

async function requestAgent() {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول أولاً');
        return;
    }
    if (agentRequestInProgress) return;
    agentRequestInProgress = true;

    try {
        const response = await fetch('/api/agent/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser._id,
                fullName: currentUser.fullName,
                email: currentUser.email,
                phone: currentUser.phone
            })
        });
        const data = await response.json();
        if (data.success) {
            alert(data.message);
        } else {
            if (data.isDuplicate) {
                alert('عزيزي المستخدم، نود إفادتك بأن طلب الانضمام الخاص بك كتاجر لا يزال تحت الدراسة. لا يتطلب منك اتخاذ أي إجراء إضافي حالياً.');
            } else {
                alert('❌ ' + data.message);
            }
        }
    } catch (error) {
        console.error('خطأ في طلب الوكالة:', error);
        alert('❌ خطأ في الشبكة');
    } finally {
        agentRequestInProgress = false;
    }
}

// ================================================================
// 13. لوحة الإدارة (محمية بكلمة مرور)
// ================================================================
function showAdminLoginModal() {
    const password = prompt('🔐 أدخل كلمة مرور الإدارة:');
    if (!password) return;
    loginAdmin(password);
}

async function loginAdmin(password) {
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await response.json();
        if (data.success) {
            adminToken = data.token;
            withdrawalBlocked = data.withdrawalBlocked || false;
            alert('✅ تم تسجيل الدخول كمسؤول بنجاح');
            window.open('/admin-panel.html', '_blank');
        } else {
            alert('❌ فشل تسجيل الدخول: ' + data.message);
        }
    } catch (error) {
        console.error('خطأ في تسجيل دخول المسؤول:', error);
        alert('❌ خطأ في الشبكة');
    }
}

// ================================================================
// 14. دوال الإدارة العامة
// ================================================================
function refreshAdminData() {
    const totalUsers = users.filter(u => u.approved !== false).length;
    const totalBalance = users.reduce((sum, u) => sum + u.balance, 0) + currentBalance;
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    document.getElementById('adminTotalUsers').textContent = totalUsers;
    document.getElementById('adminTotalBalance').textContent = totalBalance.toFixed(2);
    document.getElementById('adminTotalWithdrawals').textContent = totalWithdrawals.toFixed(2);
    document.getElementById('adminTotalRevenue').textContent = adminRevenue.toFixed(2);
}

function approveUser(userId) {
    const user = pendingUsers.find(u => u._id === userId);
    if (user) {
        user.approved = true;
        pendingUsers = pendingUsers.filter(u => u._id !== userId);
        alert(`✅ تم الموافقة على ${user.fullName}`);
        refreshAdminData();
    }
}

function rejectUser(userId) {
    const user = pendingUsers.find(u => u._id === userId);
    if (user) {
        pendingUsers = pendingUsers.filter(u => u._id !== userId);
        users = users.filter(u => u._id !== userId);
        alert(`❌ تم رفض ${user.fullName}`);
        refreshAdminData();
    }
}

// ================================================================
// 15. لعبة الدجاجة (مع مستويات الصعوبة والجولات المجانية)
// ================================================================
let climbActive = false;
let climbStep = 0;
let climbMultiplier = 1.00;
let climbBetAmount = 0;
let climbBombs = [];
let climbRevealed = [];
let climbCashedOut = false;
let currentDifficulty = 'medium';

function updateDifficultyDisplay() {
    const select = document.getElementById('difficultySelect');
    if (select) {
        currentDifficulty = select.value;
        const diff = DIFFICULTIES[currentDifficulty];
        document.getElementById('climbMultiplier').textContent = diff.baseMultiplier.toFixed(2) + 'x';
        document.getElementById('climbRiskLabel').textContent = diff.bombs + ' قنابل';
        const safeCells = 25 - diff.bombs;
        const maxMult = diff.baseMultiplier + safeCells * diff.increment;
        document.getElementById('climbProfitLabel').textContent = maxMult.toFixed(2) + 'x';
    }
}

function initClimbGrid() {
    const grid = document.getElementById('climbGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'climb-cell';
        cell.dataset.index = i;
        cell.textContent = '❓';
        cell.onclick = () => revealClimbCell(i);
        grid.appendChild(cell);
    }
}

function startClimbGame() {
    if (!currentUser) {
        alert('⚠️ يرجى تسجيل الدخول');
        return;
    }
    if (climbActive) return;

    const useFreeRound = document.getElementById('useFreeRound')?.checked || false;
    let bet = parseFloat(document.getElementById('climbBet').value);

    if (useFreeRound) {
        if ((currentUser.freeRounds || 0) <= 0) {
            alert('⚠️ لا توجد جولات مجانية متبقية');
            return;
        }
        bet = 0;
    } else {
        if (!bet || bet < 0.3) {
            document.getElementById('climbResult').textContent = '⚠️ الحد الأدنى 0.3 USDT';
            document.getElementById('climbResult').className = 'game-result lose';
            return;
        }
        if (casinoBalance < bet) {
            document.getElementById('climbResult').textContent = '⚠️ رصيد الكازينو غير كافٍ';
            document.getElementById('climbResult').className = 'game-result lose';
            return;
        }
    }

    if (!useFreeRound) {
        casinoBalance = Math.max(0, casinoBalance - bet);
        document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
    } else {
        currentUser.freeRounds = (currentUser.freeRounds || 0) - 1;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
        document.getElementById('freeRoundsDisplay').textContent = currentUser.freeRounds;
        document.getElementById('freeRoundsDisplay2').textContent = currentUser.freeRounds;
    }

    climbActive = true;
    climbStep = 0;
    climbBetAmount = bet || 0.3;
    climbCashedOut = false;

    const diff = DIFFICULTIES[currentDifficulty];
    climbMultiplier = diff.baseMultiplier;
    document.getElementById('climbStep').textContent = '0';
    document.getElementById('climbMultiplier').textContent = climbMultiplier.toFixed(2) + 'x';
    document.getElementById('climbResult').textContent = '';
    document.getElementById('climbResult').className = 'game-result';
    document.getElementById('climbCashoutBtn').disabled = false;
    document.getElementById('climbCashoutBtn').textContent = '💰 سحب الأرباح';

    const totalCells = 25;
    const bombCount = diff.bombs;
    climbBombs = [];
    const shuffled = Array.from({ length: totalCells }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(bombCount, 20); i++) {
        climbBombs.push(shuffled[i]);
    }
    climbRevealed = [];

    const grid = document.getElementById('climbGrid');
    grid.innerHTML = '';
    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'climb-cell';
        cell.dataset.index = i;
        cell.textContent = '❓';
        cell.onclick = () => revealClimbCell(i);
        grid.appendChild(cell);
    }

    document.getElementById('climbResult').textContent = '✅ اختر خلية للكشف عنها!';
    document.getElementById('climbResult').className = 'game-result';
}

function revealClimbCell(index) {
    if (!climbActive || climbCashedOut) return;
    if (climbRevealed.includes(index)) return;

    const cellEl = document.querySelector(`.climb-cell[data-index="${index}"]`);
    climbRevealed.push(index);

    if (climbBombs.includes(index)) {
        cellEl.className = 'climb-cell bomb';
        cellEl.textContent = '💣';
        climbActive = false;
        document.getElementById('climbCashoutBtn').disabled = true;
        document.getElementById('climbResult').textContent = `💥 انفجار! خسرت ${climbBetAmount.toFixed(4)} USDT`;
        document.getElementById('climbResult').className = 'game-result lose';
        adminRevenue += climbBetAmount;
        sendLossToAdmin(climbBetAmount, 'climb');
        climbBombs.forEach(b => {
            const el = document.querySelector(`.climb-cell[data-index="${b}"]`);
            if (el) { el.className = 'climb-cell bomb'; el.textContent = '💣'; }
        });
        return;
    }

    cellEl.className = 'climb-cell safe';
    cellEl.textContent = '🐣';
    climbStep++;
    const diff = DIFFICULTIES[currentDifficulty];
    climbMultiplier = diff.baseMultiplier + climbStep * diff.increment;
    climbMultiplier = Math.round(climbMultiplier * 100) / 100;
    document.getElementById('climbStep').textContent = climbStep;
    document.getElementById('climbMultiplier').textContent = climbMultiplier.toFixed(2) + 'x';

    const safeCells = Array.from({ length: 25 }, (_, i) => i).filter(i => !climbBombs.includes(i));
    if (climbRevealed.length >= safeCells.length) {
        const win = climbBetAmount * climbMultiplier;
        casinoBalance += win;
        document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
        document.getElementById('climbResult').textContent = `🎉 فوز! ربحت ${win.toFixed(4)} USDT`;
        document.getElementById('climbResult').className = 'game-result win';
        climbActive = false;
        document.getElementById('climbCashoutBtn').disabled = true;
        if (currentUser) {
            currentUser.casinoBalance = casinoBalance;
            localStorage.setItem('nexora_user', JSON.stringify(currentUser));
        }
        refreshAdminData();
    }
}

function cashoutClimb() {
    if (!climbActive || climbCashedOut) return;
    climbCashedOut = true;
    const win = climbBetAmount * climbMultiplier;
    casinoBalance += win;
    document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
    document.getElementById('climbResult').textContent = `🎉 سحبت عند ${climbMultiplier.toFixed(2)}x | ربحت ${win.toFixed(4)} USDT`;
    document.getElementById('climbResult').className = 'game-result win';
    climbActive = false;
    document.getElementById('climbCashoutBtn').disabled = true;
    if (currentUser) {
        currentUser.casinoBalance = casinoBalance;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
    refreshAdminData();
}

function sendLossToAdmin(amount, gameType) {
    adminRevenue += amount;
    fetch('/api/admin/loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, game: gameType, userId: currentUser ? currentUser._id : 'guest' })
    }).catch(e => console.error(e));
}

function initCasinoGames() {
    initClimbGrid();
    updateDifficultyDisplay();
    if (currentUser) {
        document.getElementById('freeRoundsDisplay').textContent = currentUser.freeRounds || 0;
        document.getElementById('freeRoundsDisplay2').textContent = currentUser.freeRounds || 0;
    }
}

// ================================================================
// 16. سجل المعاملات
// ================================================================
async function loadUserTransactions(userId) {
    try {
        const response = await fetch(`/api/transactions?userId=${userId}`);
        const data = await response.json();
        const container = document.getElementById('transactionsList');
        if (!container) return;
        if (data.success && data.transactions.length > 0) {
            container.innerHTML = data.transactions.map(t => `
                <div class="transaction-item">
                    <div>
                        <span style="font-weight:600; color:var(--gold);">${t.type}</span>
                        <span style="font-size:clamp(10px,2vw,12px); color:#8a7fa0; margin-right:8px;">${t.description || ''}</span>
                    </div>
                    <div style="text-align:left;">
                        <span style="color:${t.status === 'completed' ? '#2ecc71' : t.status === 'pending' ? '#f1c40f' : '#e74c3c'}; font-weight:700;">${t.amount.toFixed(4)} USDT</span>
                        <span style="font-size:clamp(9px,2vw,11px); color:#8a7fa0; margin-right:6px; display:block;">${t.status === 'completed' ? '✅ مكتملة' : t.status === 'pending' ? '⏳ معلقة' : '❌ مرفوضة'}</span>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color:#8a7fa0; font-size:clamp(12px,2.5vw,14px);">لا توجد معاملات</p>';
        }
    } catch (error) {
        console.error('خطأ في جلب المعاملات:', error);
    }
}

// ================================================================
// 17. شريط التحذير
// ================================================================
function initTicker() {
    const messages = [
        'قام أحمد بشراء خطة VIP بقيمة 100 USDT',
        'ربحت مريم 25.5 USDT من لعبة الدجاجة',
        'انضم محمد للتو وحصل على 5 USDT مجاناً',
        'سحبت نورة 50 USDT من أرباح التعدين',
        'علي ربح 12.3 USDT من لعبة الدجاجة',
        'سارة فعّلت خطة مرنة بقيمة 45 USDT'
    ];
    let idx = 0;
    setInterval(() => {
        const ticker = document.getElementById('tickerText');
        if (ticker) {
            const msg = messages[idx % messages.length];
            ticker.innerHTML = `<span>🔄</span> ${msg} <span>💰</span> ` + ticker.innerHTML;
            idx++;
        }
    }, 5000);
}

// ================================================================
// 18. دوال الإدارة الأخرى (خطط الترقية، إلخ)
// ================================================================
function renderPlans() {
    const container = document.getElementById('plansContainer');
    if (!container) return;
    const plans = [
        { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
        { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
        { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
    ];
    container.innerHTML = plans.map(p => `
        <div style="background:var(--glass-bg); padding:10px; border-radius:8px; margin:6px 0; backdrop-filter:blur(4px);">
            <div style="font-weight:700; color:var(--gold); font-size:clamp(14px,3vw,17px);">${p.name}</div>
            <div style="font-size:clamp(11px,2.5vw,13px); color:#8a7fa0;">
                المبلغ: ${p.min} - ${p.max} USDT | الربح: ${p.profit}% | المدة: ${p.duration} يوم
            </div>
            <button class="mini-btn" style="border-color:var(--gold); color:var(--gold);" onclick="purchasePlan('${p.name}')">
                <i class="fas fa-play"></i> تفعيل
            </button>
        </div>
    `).join('');
}

function purchasePlan(planName) {
    if (!currentUser) { alert('⚠️ يرجى تسجيل الدخول'); return; }
    const plans = [
        { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
        { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
        { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
    ];
    const plan = plans.find(p => p.name === planName);
    if (!plan) return;
    const amount = plan.min;
    if (currentBalance < amount) { alert(`❌ تحتاج ${amount} USDT`); return; }
    if (miningPlans.find(p => p.userId === currentUser._id)) {
        alert('⚠️ لديك خطة نشطة');
        return;
    }
    if (!confirm(`سيتم خصم ${amount} USDT لتفعيل ${planName}. هل تتابع؟`)) return;
    currentBalance = Math.max(0, currentBalance - amount);
    const dailyProfit = amount * (plan.profit / 100);
    miningPlans.push({
        userId: currentUser._id,
        capital: amount,
        dailyProfit: dailyProfit,
        day: 0,
        duration: plan.duration,
        planName: plan.name
    });
    currentUser.totalInvested = (currentUser.totalInvested || 0) + amount;
    document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
    alert(`✅ تم تفعيل ${planName}`);
    if (currentUser) {
        currentUser.balance = currentBalance;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
    refreshAdminData();
}

function loadUserPlans(user) {
    const plan = miningPlans.find(p => p.userId === user._id);
    if (plan) {
        const statusEl = document.getElementById('miningPlanStatus');
        if (statusEl) statusEl.innerHTML = `⛏️ ${plan.planName}: اليوم ${plan.day}/${plan.duration} | أرباح اليوم: ${plan.dailyProfit.toFixed(2)} USDT`;
    }
    const flexPlan = flexMiningPlans.find(p => p.userId === user._id);
    if (flexPlan) {
        const statusEl = document.getElementById('flexMiningStatus');
        if (statusEl) statusEl.textContent = `⛏️ خطة مرنة: اليوم ${flexPlan.day}/${flexPlan.duration} | أرباح اليوم: ${flexPlan.dailyProfit.toFixed(2)} USDT`;
    }
}

function renderAdminPlans() {
    const container = document.getElementById('adminPlansList');
    if (!container) return;
    const plans = [
        { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
        { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
        { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
    ];
    container.innerHTML = plans.map((p, idx) => `
        <div style="background:var(--glass-bg); padding:8px; border-radius:8px; margin:4px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; backdrop-filter:blur(4px);">
            <span style="font-weight:600; color:var(--gold);">${p.name}</span>
            <span style="font-size:clamp(11px,2vw,13px); color:#8a7fa0;">${p.min}-${p.max} USDT | ${p.profit}% | ${p.duration} يوم</span>
            <button class="mini-btn" style="border-color:#e74c3c; color:#e74c3c;" onclick="removePlan(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

function showAddPlanForm() {
    document.getElementById('addPlanForm').style.display = 'block';
}

function addPlan() {
    const name = document.getElementById('planName').value.trim();
    const min = parseFloat(document.getElementById('planMin').value);
    const max = parseFloat(document.getElementById('planMax').value);
    const profit = parseFloat(document.getElementById('planProfit').value);
    const duration = parseInt(document.getElementById('planDuration').value);
    if (!name || isNaN(min) || isNaN(max) || isNaN(profit) || isNaN(duration)) {
        alert('⚠️ املأ جميع الحقول بشكل صحيح');
        return;
    }
    const plans = [
        { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
        { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
        { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
    ];
    plans.push({ name, min, max, profit, duration });
    document.getElementById('addPlanForm').style.display = 'none';
    document.getElementById('planName').value = '';
    document.getElementById('planMin').value = '';
    document.getElementById('planMax').value = '';
    document.getElementById('planProfit').value = '';
    document.getElementById('planDuration').value = '';
    renderPlans();
    renderAdminPlans();
    alert('✅ تم إضافة الخطة بنجاح');
}

function removePlan(index) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذه الخطة؟')) return;
    const plans = [
        { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
        { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
        { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
    ];
    plans.splice(index, 1);
    renderPlans();
    renderAdminPlans();
}

function updateHouseEdge() {
    const val = parseFloat(document.getElementById('houseEdgeInput').value);
    if (isNaN(val) || val < 0 || val > 20) {
        alert('⚠️ أدخل نسبة بين 0 و 20');
        return;
    }
    houseEdge = val;
    alert(`✅ تم تحديث نسبة الربح إلى ${houseEdge}%`);
}

function emergencyStop() {
    if (!confirm('⚠️ تحذير: سيتم إيقاف جميع الألعاب فوراً. هل أنت متأكد؟')) return;
    alert('🛑 تم إيقاف الطوارئ. جميع الألعاب متوقفة مؤقتاً.');
}

function resetCasino() {
    if (!confirm('⚠️ سيتم إعادة تعيين جميع إعدادات الكازينو. هل تتابع؟')) return;
    houseEdge = 5;
    document.getElementById('houseEdgeInput').value = 5;
    alert('✅ تم إعادة تعيين الكازينو');
}

function sendReward() {
    const email = document.getElementById('rewardUserEmail').value.trim();
    const pts = parseFloat(document.getElementById('rewardPoints').value);
    if (!email || !pts || pts <= 0) {
        document.getElementById('rewardStatus').textContent = '⚠️ أدخل بريداً وعدد نقاط صحيح';
        document.getElementById('rewardStatus').style.color = '#e74c3c';
        return;
    }
    const user = users.find(u => u.email === email);
    if (!user) {
        document.getElementById('rewardStatus').textContent = '❌ المستخدم غير موجود';
        document.getElementById('rewardStatus').style.color = '#e74c3c';
        return;
    }
    user.points = (user.points || 0) + pts;
    document.getElementById('rewardStatus').textContent = `✅ تم إرسال ${pts} نقطة إلى ${user.fullName}`;
    document.getElementById('rewardStatus').style.color = '#2ecc71';
    document.getElementById('rewardUserEmail').value = '';
    document.getElementById('rewardPoints').value = '';
    refreshAdminData();
}

// ================================================================
// 19. تهيئة التطبيق عند تحميل الصفحة
// ================================================================
window.onload = function() {
    const savedUser = localStorage.getItem('nexora_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            if (user.approved !== false) {
                currentUser = user;
                document.getElementById('loginOverlay').classList.add('hidden');
                document.getElementById('liveBalance').innerHTML = user.balance.toFixed(6) + ' <small>USDT</small>';
                currentBalance = user.balance;
                casinoBalance = user.casinoBalance || 0;
                document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
                points = user.points || 0;
                document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
                document.getElementById('walletBalance').innerHTML = user.balance.toFixed(6) + ' <small>USDT</small>';
                document.getElementById('walletPoints').textContent = points;

                // استعادة حالة التعدين
                miningProgress = user.miningProgress || 0;
                miningClicks = user.miningClicks || 0;
                miningMaxClicks = user.miningMaxClicks || 100;
                miningLastReset = new Date(user.miningLastReset || Date.now()).getTime();
                document.getElementById('miningProgressDisplay').textContent = miningProgress.toFixed(6) + ' USDT';
                document.getElementById('miningClicksDisplay').textContent = `${miningClicks} / ${miningMaxClicks}`;
                document.getElementById('miningRemainingDisplay').textContent = miningMaxClicks - miningClicks;

                const now = Date.now();
                if (now - miningLastReset > 24 * 60 * 60 * 1000) {
                    miningClicks = 0;
                    miningLastReset = now;
                    document.getElementById('miningClicksDisplay').textContent = `0 / ${miningMaxClicks}`;
                    document.getElementById('miningRemainingDisplay').textContent = miningMaxClicks;
                }

                const resetIn = Math.max(0, 24 - (now - miningLastReset) / (60 * 60 * 1000));
                document.getElementById('miningResetDisplay').textContent = resetIn > 0 ? `${Math.ceil(resetIn)} ساعة` : 'يمكنك البدء الآن';

                const welcomeEl = document.getElementById('welcomeMessage');
                if (welcomeEl) welcomeEl.textContent = `مرحباً، ${user.fullName}`;
                showDashboard();
                if (typeof loadUserPlans === 'function') loadUserPlans(user);
                loadActiveAds();
                loadAllAdsForAdmin();
                loadUserTransactions(user._id);
                loadMarketOrders();
                if (user.isAgent) loadAgentPendingOrders();
                checkWithdrawalStatus();
                const freeRoundsEl = document.getElementById('freeRoundsDisplay');
                if (freeRoundsEl) freeRoundsEl.textContent = user.freeRounds || 0;
                const freeRoundsEl2 = document.getElementById('freeRoundsDisplay2');
                if (freeRoundsEl2) freeRoundsEl2.textContent = user.freeRounds || 0;
            }
        } catch (e) {
            localStorage.removeItem('nexora_user');
        }
    }

    initTicker();
    renderPlans();
    renderAdminPlans();
    refreshAdminData();
    updateInvestmentCalc();
    updateAdCost();
    setTimeout(initCasinoGames, 500);

    // ربط أزرار التعدين الجديدة
    const clickBtn = document.getElementById('miningClickBtn');
    if (clickBtn) clickBtn.onclick = performMiningClick;
    const harvestBtn = document.getElementById('harvestMiningBtn');
    if (harvestBtn) harvestBtn.onclick = harvestMining;
};

// ================================================================
// 20. محاكاة تحديث خطط التعدين اليومية
// ================================================================
setInterval(() => {
    flexMiningPlans.forEach(plan => {
        if (plan.day < plan.duration) {
            plan.day++;
            const profit = plan.dailyProfit;
            const user = users.find(u => u._id === plan.userId);
            if (user) {
                user.balance += profit;
                if (user._id === currentUser?._id) {
                    currentBalance += profit;
                    document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
                }
            }
            if (plan.day >= plan.duration) {
                const user = users.find(u => u._id === plan.userId);
                if (user) {
                    user.balance += plan.capital;
                    if (user._id === currentUser?._id) {
                        currentBalance += plan.capital;
                        document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
                    }
                }
                flexMiningPlans = flexMiningPlans.filter(p => p.userId !== plan.userId);
            }
        }
    });
}, 15000);
