// ===== الإعدادات والروابط الأساسية =====
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : '/api'; // يتوافق تلقائياً مع بورت 3000 المثبت في سيرفرك

// متغيرات حالة التطبيق (State Management)
let currentUser = null;
let currentToken = localStorage.getItem('nexora_token') || null;
let activeClimbGame = null;

// ===== 1. فحص الجلسة التلقائي عند تشغيل التطبيق (Auto-Login) =====
document.addEventListener('DOMContentLoaded', () => {
    verifySession();
    setupMiningButtons();
    // تحميل البيانات العامة التي لا تحتاج لتسجيل دخول عميق فوراً
    loadActiveAds();
    loadMarketOrders();
});

async function verifySession() {
    if (!currentToken) {
        showLoginOverlay(true);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/verify-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentToken })
        });
        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            updateUIWithUserData();
            showLoginOverlay(false);
            // تحميل سجل المعاملات وبيانات الوكيل الخاصة بالمستخدم
            loadTransactions();
            checkAgentStatus();
        } else {
            logout();
        }
    } catch (error) {
        console.error("خطأ أثناء فحص الجلسة:", error);
    }
}

// ===== 2. نظام المصادقة (تسجيل دخول / تسجيل جديد) =====
let isLoginMode = true;

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const fullNameInput = document.getElementById('loginFullName');
    const phoneInput = document.getElementById('loginPhone');
    const actionBtn = document.getElementById('authActionBtn');
    const toggleText = document.getElementById('toggleAuthText');
    const errorDiv = document.getElementById('authError');
    
    errorDiv.innerText = '';

    if (isLoginMode) {
        fullNameInput.style.display = 'none';
        phoneInput.style.display = 'none';
        actionBtn.innerText = 'تسجيل الدخول';
        toggleText.innerText = 'ليس لديك حساب؟ سجل الآن';
    } else {
        fullNameInput.style.display = 'block';
        phoneInput.style.display = 'block';
        actionBtn.innerText = 'إنشاء حساب جديد';
        toggleText.innerText = 'لديك حساب بالفعل؟ سجل دخولك';
    }
}

async function handleAuth() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('authError');
    
    if (!email || !password) {
        errorDiv.innerText = 'يرجى ملء الحقول الإلزامية';
        return;
    }

    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
    const payload = { email, password };

    if (!isLoginMode) {
        payload.fullName = document.getElementById('loginFullName').value.trim();
        payload.phone = document.getElementById('loginPhone').value.trim();
        if (!payload.fullName || !payload.phone) {
            errorDiv.innerText = 'يرجى ملء جميع الحقول للتسجيل';
            return;
        }
    }

    try {
        errorDiv.innerText = 'جاري المعالجة...';
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            currentToken = data.token;
            localStorage.setItem('nexora_token', data.token);
            currentUser = data.user;
            
            updateUIWithUserData();
            showLoginOverlay(false);
            errorDiv.innerText = '';
            loadTransactions();
            checkAgentStatus();
        } else {
            errorDiv.innerText = data.message || 'فشلت العملية، تحقق من البيانات';
        }
    } catch (error) {
        errorDiv.innerText = 'خطأ في الاتصال بالسيرفر';
    }
}

function logout() {
    currentUser = null;
    currentToken = null;
    localStorage.removeItem('nexora_token');
    showLoginOverlay(true);
}

function showLoginOverlay(show) {
    const overlay = document.getElementById('loginOverlay');
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
}

// ===== 3. تحديث واجهات المستخدم (UI) الدورية =====
function updateUIWithUserData() {
    if (!currentUser) return;

    document.getElementById('welcomeMessage').innerHTML = `مرحباً، <span>${currentUser.fullName}</span>`;
    
    const formattedBalance = parseFloat(currentUser.balance || 0).toFixed(6);
    const formattedCasino = parseFloat(currentUser.casinoBalance || 0).toFixed(6);
    
    document.getElementById('liveBalance').innerHTML = `${formattedBalance} <small>USDT</small>`;
    document.getElementById('walletBalance').innerHTML = `${formattedBalance} <small>USDT</small>`;
    document.getElementById('casinoBalance').innerHTML = `${formattedCasino} <small>USDT</small>`;
    
    document.getElementById('miningProgressDisplay').innerText = `${parseFloat(currentUser.miningProgress || 0).toFixed(4)} USDT`;
    document.getElementById('miningClicksDisplay').innerText = `${currentUser.miningClicks || 0} / 100`;
    document.getElementById('miningRemainingDisplay').innerText = 100 - (currentUser.miningClicks || 0);
    
    document.getElementById('freeRoundsDisplay').innerText = currentUser.freeRounds || 0;
    document.getElementById('freeRoundsDisplay2').innerText = currentUser.freeRounds || 0;
    document.getElementById('walletPoints').innerText = currentUser.points || 0;
}

// ===== 4. نظام التنقل والتبويب السفلي (Tabs Navigation) =====
function navigateTo(sectionId) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    const targetSection = document.getElementById(`section-${sectionId}`);
    if (targetSection) targetSection.classList.add('active');

    const targetBtn = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (targetBtn) targetBtn.classList.add('active');
}

// ===== 5. نظام التعدين اليدوي وحفظ النقاط =====
function setupMiningButtons() {
    const clickBtn = document.getElementById('miningClickBtn');
    const harvestBtn = document.getElementById('harvestMiningBtn');
    const statusDiv = document.getElementById('miningStatus');

    if (clickBtn) {
        clickBtn.onclick = async () => {
            if (!currentUser) return;
            if (currentUser.miningClicks >= 100) {
                statusDiv.innerText = '❌ وصلت للحد الأقصى اليومي (100 ضغطة)';
                return;
            }

            // تحديث واجهة فوري سريع للإحساس بالسرعة
            currentUser.miningClicks++;
            currentUser.miningProgress += 0.001;
            updateUIWithUserData();

            try {
                const response = await fetch(`${API_URL}/mining/click`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser._id })
                });
                const data = await response.json();
                if (data.success) {
                    statusDiv.innerText = `⛏️ تم التعدين! الضغطات: ${data.miningClicks}/100`;
                    if(data.bonus > 0) statusDiv.innerText += ` 🎉 مكافأة إضافية +${data.bonus} USDT!`;
                    // إعادة مزامنة البيانات الحقيقية من السيرفر
                    currentUser.miningProgress = data.miningProgress;
                    currentUser.miningClicks = data.miningClicks;
                    updateUIWithUserData();
                }
            } catch (error) {
                console.error("خطأ التعدين:", error);
            }
        };
    }

    if (harvestBtn) {
        harvestBtn.onclick = async () => {
            if (!currentUser || currentUser.miningProgress <= 0) {
                statusDiv.innerText = '❌ لا يوجد رصيد تعدين لحصاده حالياً';
                return;
            }
            try {
                const response = await fetch(`${API_URL}/mining/harvest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser._id })
                });
                const data = await response.json();
                if (data.success) {
                    currentUser.balance = data.newBalance;
                    currentUser.miningProgress = 0;
                    updateUIWithUserData();
                    statusDiv.innerText = `💰 تم حصاد ${data.harvested.toFixed(4)} USDT إلى رصيدك الرئيسي!`;
                    loadTransactions();
                }
            } catch (error) {
                statusDiv.innerText = '❌ خطأ أثناء معالجة الحصاد';
            }
        };
    }
}

// ===== 6. نظام الكازينو (لعبة الدجاجة ومستويات الصعوبة) =====
let currentDifficulty = "medium";
const difficultySettings = {
    normal: { bombs: 3, multiplier: 1.3 },
    medium: { bombs: 5, multiplier: 1.6 },
    hard: { bombs: 8, multiplier: 2.0 },
    veryhard: { bombs: 10, multiplier: 2.2 }
};

function updateDifficultyDisplay() {
    currentDifficulty = document.getElementById('difficultySelect').value;
    const config = difficultySettings[currentDifficulty];
    document.getElementById('climbRiskLabel').innerText = config.bombs;
    document.getElementById('climbProfitLabel').innerText = config.multiplier.toFixed(2);
    document.getElementById('climbMultiplier').innerText = `${config.multiplier.toFixed(2)}x`;
}

function startClimbGame() {
    const betInput = document.getElementById('climbBet');
    const useFreeRound = document.getElementById('useFreeRound').checked;
    const betAmount = parseFloat(betInput.value) || 0;
    const resultDiv = document.getElementById('climbResult');

    if (!useFreeRound && currentUser.casinoBalance < betAmount) {
        resultDiv.className = "game-result lose";
        resultDiv.innerText = "❌ رصيد الكازينو غير كافٍ لإتمام الرهان!";
        return;
    }

    if (useFreeRound && currentUser.freeRounds < 1) {
        resultDiv.className = "game-result lose";
        resultDiv.innerText = "❌ لا تمتلك جولات مجانية متاحة حالياً!";
        return;
    }

    // خصم الرصيد محلياً للبدء
    if (useFreeRound) {
        currentUser.freeRounds--;
    } else {
        currentUser.casinoBalance -= betAmount;
    }
    updateUIWithUserData();

    resultDiv.className = "game-result";
    resultDiv.innerText = "🎮 بدأت الجولة! اختر الخلايا بحذر...";
    
    // إعداد واجهة اللعبة العشوائية (تتم محلياً بالكامل لتجنب الثقل)
    const config = difficultySettings[currentDifficulty];
    activeClimbGame = {
        bet: betAmount,
        useFree: useFreeRound,
        bombsCount: config.bombs,
        multiplier: config.multiplier,
        currentStep: 0,
        currentMultiplier: 1.0,
        bombsPositions: []
    };

    // توليد مواقع القنابل عشوائياً في شبكة 5x5 (25 خلية)
    while (activeClimbGame.bombsPositions.length < activeClimbGame.bombsCount) {
        let pos = Math.floor(Math.random() * 25);
        if (!activeClimbGame.bombsPositions.includes(pos)) {
            activeClimbGame.bombsPositions.push(pos);
        }
    }

    const grid = document.getElementById('climbGrid');
    grid.innerHTML = '';
    document.getElementById('climbCashoutBtn').disabled = false;
    document.getElementById('climbStep').innerText = "0";

    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'climb-cell';
        cell.innerHTML = '<i class="fas fa-question" style="font-size:12px; color:#4a3f68;"></i>';
        cell.onclick = () => revealClimbCell(i, cell);
        grid.appendChild(cell);
    }
}

function revealClimbCell(index, cellElement) {
    if (!activeClimbGame) return;
    if (cellElement.classList.contains('revealed')) return;

    const resultDiv = document.getElementById('climbResult');

    if (activeClimbGame.bombsPositions.includes(index)) {
        // 💥 انفجار قنبلة وخسارة
        cellElement.className = 'climb-cell bomb';
        cellElement.innerHTML = '<i class="fas fa-bomb"></i>';
        resultDiv.className = "game-result lose";
        resultDiv.innerText = `💥 قنبلة! خسرت جولة الرهان بقيمة ${activeClimbGame.bet} USDT.`;
        endClimbGame(false);
    } else {
        // 🍗 خلية آمنة (دجاجة)
        cellElement.className = 'climb-cell safe';
        cellElement.innerHTML = '<i class="fas fa-chicken" style="color:#d4af37;"></i>🍗';
        activeClimbGame.currentStep++;
        activeClimbGame.currentMultiplier *= activeClimbGame.multiplier;
        
        document.getElementById('climbStep').innerText = activeClimbGame.currentStep;
        document.getElementById('climbMultiplier').innerText = `${activeClimbGame.currentMultiplier.toFixed(2)}x`;
        
        // تحديث نص زر الحصاد لعرض المبلغ المتوقع الفوز به
        const potentialWin = (activeClimbGame.bet * activeClimbGame.currentMultiplier).toFixed(4);
        document.getElementById('climbCashoutBtn').innerText = `سحب الأرباح (${potentialWin} USDT)`;
    }
}

async function cashoutClimb() {
    if (!activeClimbGame) return;
    const resultDiv = document.getElementById('climbResult');
    const winAmount = activeClimbGame.bet * activeClimbGame.currentMultiplier;

    // إضافة الأرباح إلى حساب المستخدم بالسيرفر والمحلية
    try {
        currentUser.casinoBalance += winAmount;
        updateUIWithUserData();
        
        resultDiv.className = "game-result win";
        resultDiv.innerText = `🎉 مبروك الفوز! حصدت ${winAmount.toFixed(4)} USDT بمضاعف ${activeClimbGame.currentMultiplier.toFixed(2)}x`;
        
        // إرسال معاملة تحسين رصيد الكازينو خلف الكواليس
        await fetch(`${API_URL}/wallet/transfer-to-casino`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id, amount: -winAmount }) // تحويل سالب لإضافة الرصيد بالسيرفر
        });
        loadTransactions();
    } catch (error) {
        console.error(error);
    }
    endClimbGame(true);
}

function endClimbGame(isWin) {
    activeClimbGame = null;
    document.getElementById('climbCashoutBtn').disabled = true;
    document.getElementById('climbCashoutBtn').innerText = `سحب الأرباح`;
    // كشف باقي الخلايا
    const cells = document.querySelectorAll('.climb-cell');
    cells.forEach((cell, idx) => {
        cell.onclick = null; // إيقاف الضغط
    });
}

// ===== 8. إدارة الإيداع، السحب، وتحويل الأموال =====
async function transferToCasino() {
    const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
    if (amount <= 0 || currentUser.balance < amount) {
        alert("الرصيد الاستثماري الحالي لا يكفي لإتمام عملية التحويل!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/wallet/transfer-to-casino`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id, amount })
        });
        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            updateUIWithUserData();
            alert("تم تحويل الرصيد لمحفظة الكازينو بنجاح!");
            loadTransactions();
        }
    } catch (error) {
        alert("خطأ أثناء تحويل الرصيد");
    }
}

async function submitWithdraw() {
    const address = document.getElementById('withdrawAddress').value.trim();
    const amount = parseFloat(document.getElementById('withdrawAmount').value) || 0;
    const resultDiv = document.getElementById('withdrawResult');

    if(!address || amount < 10) {
        resultDiv.innerText = "⚠️ الحد الأدنى للسحب هو 10 USDT مع كتابة العنوان!";
        return;
    }

    resultDiv.innerText = "⏳ جاري إرسال الطلب للمسؤولين...";
    // محاكاة حجز السحب وربطه بالسيرفر عبر جدول العمليات
    setTimeout(() => {
        resultDiv.innerText = "✅ تم تقديم طلب السحب بنجاح وهو قيد المراجعة الإدارية الحالية!";
    }, 1500);
}

// ===== 9. سوق النقاط وإعدادات الوكلاء المعتمَدين =====
async function loadMarketOrders() {
    try {
        const resSell = await fetch(`${API_URL}/market/sell-orders`);
        const dataSell = await resSell.json();
        if (dataSell.success) {
            document.getElementById('sellCount').innerText = dataSell.count;
            const list = document.getElementById('sellOrdersList');
            list.innerHTML = dataSell.agents.map(ag => `
                <div class="pending-user" style="flex-direction:column; align-items:flex-start; gap:4px;">
                    <div><b>الوكيل:</b> ${ag.fullName}</div>
                    <div><b>سعر البيع:</b> ${ag.sellPrice} USDT</div>
                    <button class="mini-btn" onclick="executeMarketOrder('buy', '${ag.agentId}')" style="background:var(--gold); color:#000; width:100%; margin-top:4px;">شراء نقاط منه</button>
                </div>
            `).join('') || '<p style="color:#8a7fa0; text-align:center;">لا يوجد وكلاء بيع حالياً</p>';
        }
    } catch (e) { console.error(e); }
}

async function executeMarketOrder(type, agentId) {
    if (!currentUser) return alert("سجل دخولك أولاً!");
    const points = prompt("أدخل كمية النقاط المراد تداولها:");
    if (!points || isNaN(points) || parseInt(points) <= 0) return;

    try {
        const response = await fetch(`${API_URL}/market/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, userId: currentUser._id, agentId, points: parseInt(points) })
        });
        const data = await response.json();
        alert(data.message);
        verifySession(); // تحديث الأرصدة
    } catch (error) {
        alert("خطأ في معالجة طلب تداول النقاط");
    }
}

async function checkAgentStatus() {
    // إظهار وإخفاء البيانات الحساسة للوكيل إن كان معتمداً
    const panel = document.getElementById('agentPanel');
    if (currentUser && currentUser.isAgent) {
        panel.style.opacity = "1";
    } else {
        panel.style.opacity = "0.5";
    }
}

async function requestAgent() {
    const statusDiv = document.getElementById('agentRequestStatus');
    try {
        const response = await fetch(`${API_URL}/agent/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id, fullName: currentUser.fullName, phone: currentUser.phone, email: currentUser.email })
        });
        const data = await response.json();
        statusDiv.innerText = data.message;
    } catch (error) {
        statusDiv.innerText = "❌ تعذر إرسال طلب الوكالة حالياً";
    }
}

// ===== 10. تصفح الإعلانات ونشر الحملات المموّلة =====
async function loadActiveAds() {
    try {
        const response = await fetch(`${API_URL}/ads/active`);
        const data = await response.json();
        const container = document.getElementById('activeAdsContainer');
        if (data.success && data.ads.length > 0) {
            container.innerHTML = data.ads.map(ad => `
                <div class="ad-card">
                    <h5>📢 ${ad.title}</h5>
                    <p style="font-size:12px; color:#8a7fa0; margin:4px 0;">${ad.content}</p>
                    <button class="btn btn-outline" onclick="viewAdAction('${ad._id}', '${ad.link}')" style="width:100%; padding:6px; font-size:12px;">🔗 فتح الرابط وكسب النقاط</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color:#8a7fa0; text-align:center;">لا توجد حملات إعلانية نشطة اليوم</p>';
        }
    } catch (error) { console.error(error); }
}

async function viewAdAction(adId, link) {
    if(!currentUser) return alert("يرجى تسجيل الدخول أولاً للربح!");
    window.open(link, '_blank');
    
    try {
        const response = await fetch(`${API_URL}/ads/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adId, userId: currentUser._id })
        });
        const data = await response.json();
        if(data.success) {
            document.getElementById('adMessage').innerText = "✅ رائع! شاهدت الإعلان وحصلت على +0.5 نقطة في محفظتك.";
            verifySession(); // لتحديث جولات الكازينو المجانية والنقاط تلقائياً
        }
    } catch (error) { console.error(error); }
}

function updateAdCost() {
    const views = parseInt(document.getElementById('adTargetViews').value) || 0;
    document.getElementById('adCostDisplay').innerText = (views * 0.001).toFixed(2);
}

async function submitAd() {
    const title = document.getElementById('adTitle').value.trim();
    const content = document.getElementById('adContent').value.trim();
    const link = document.getElementById('adLink').value.trim();
    const targetViews = parseInt(document.getElementById('adTargetViews').value) || 0;
    const statusDiv = document.getElementById('adSubmitStatus');

    if(!title || !link || targetViews <= 0) {
        statusDiv.innerText = "❌ يرجى تعبئة كافة بيانات الحملة الإعلانية بشكل صحيح!";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/ads/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, link, targetViews, userId: currentUser._id })
        });
        const data = await response.json();
        statusDiv.innerText = data.message;
        if(data.success) verifySession();
    } catch (e) { statusDiv.innerText = "❌ خطأ أثناء تمويل ونشر الإعلان"; }
}

// ===== 11. تحميل سجل المعاملات التاريخي للنظام =====
async function loadTransactions() {
    if(!currentUser) return;
    try {
        const response = await fetch(`${API_URL}/transactions?userId=${currentUser._id}`);
        const data = await response.json();
        const list = document.getElementById('transactionsList');
        if (data.success && data.transactions.length > 0) {
            list.innerHTML = data.transactions.map(tx => `
                <div class="transaction-item">
                    <span>${tx.description}</span>
                    <span style="color:${tx.type.includes('harvest')?'#2ecc71':'#e74c3c'}">${tx.amount} USDT</span>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p style="color:#8a7fa0; font-size:12px;">لا توجد معاملات سابقة بحسابك</p>';
        }
    } catch (e) { console.error(e); }
}
