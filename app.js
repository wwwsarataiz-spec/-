let currentUserId = null;
let userToken = localStorage.getItem('nexora_token') || null;

let gameInProgress = false;
let currentSteps = 0;
let currentMultiplier = 1.00;
let bombLocations = [];
const totalCells = 25;

// ===== إعدادات الصعوبة (4 مستويات مع القيم الدقيقة) =====
const difficultySettings = {
    normal: {
        baseMultiplier: 1.3,
        increment: 0.10,
        bombs: 3,
        label: 'عادي'
    },
    medium: {
        baseMultiplier: 1.6,
        increment: 0.15,
        bombs: 5,
        label: 'متوسط'
    },
    hard: {
        baseMultiplier: 2.0,
        increment: 0.20,
        bombs: 7,
        label: 'صعب'
    },
    veryhard: {
        baseMultiplier: 2.2,
        increment: 0.25,
        bombs: 9,
        label: 'صعب جداً'
    }
};
let chosenDifficulty = 'medium';

// ===== عند تحميل الصفحة =====
document.addEventListener("DOMContentLoaded", () => {
    setupMiningButtons();
    setupAdListeners();
    if (userToken) {
        verifySessionToken();
    } else {
        document.getElementById("loginOverlay").classList.remove("hidden");
    }
    // استعادة حالة التعدين من localStorage فوراً
    restoreMiningFromLocalStorage();
});

// ===== استعادة حالة التعدين من localStorage =====
function restoreMiningFromLocalStorage() {
    const saved = localStorage.getItem('nexora_mining');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            document.getElementById('miningProgressDisplay').innerText = `${data.miningProgress.toFixed(4)} USDT`;
            document.getElementById('miningClicksDisplay').innerText = `${data.miningClicks} / 100`;
            const remaining = 100 - data.miningClicks;
            document.getElementById('miningRemainingDisplay').innerText = remaining;
            updateMiningResetTimer(data.miningLastReset);
        } catch (e) {
            console.error("خطأ في استعادة حالة التعدين:", e);
        }
    }
}

// ===== تحديث عداد الوقت المتبقي لإعادة الضبط =====
function updateMiningResetTimer(lastReset) {
    const now = Date.now();
    const last = new Date(lastReset).getTime();
    const elapsed = (now - last) / (60 * 60 * 1000);
    const remainingHours = Math.max(0, 24 - elapsed);
    const hours = Math.floor(remainingHours);
    const minutes = Math.floor((remainingHours - hours) * 60);
    document.getElementById('miningResetDisplay').innerText = `${hours} ساعة و${minutes} دقيقة`;
}

// ===== حفظ حالة التعدين في localStorage =====
function saveMiningToLocalStorage(progress, clicks, lastReset) {
    localStorage.setItem('nexora_mining', JSON.stringify({
        miningProgress: progress,
        miningClicks: clicks,
        miningLastReset: lastReset
    }));
}

// ===== التحقق من الجلسة =====
async function verifySessionToken() {
    try {
        const response = await fetch('/api/auth/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: userToken })
        });
        const data = await response.json();
        if (data.success) {
            currentUserId = data.user._id;
            document.getElementById("loginOverlay").classList.add("hidden");
            updateDashboardData(data.user);
            fetchMiningStatus();
            fetchActiveAds();
            fetchMarketData();
        } else {
            localStorage.removeItem('nexora_token');
            document.getElementById("loginOverlay").classList.remove("hidden");
        }
    } catch (err) {
        console.error("خطأ جلسة:", err);
    }
}

let isLoginMode = true;
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('loginFullName').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('loginPhone').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('authActionBtn').innerText = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
    document.getElementById('toggleAuthText').innerText = isLoginMode ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخولك';
}

async function handleAuth() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("authError");
    
    if (!email || !password) {
        errorDiv.innerText = "يرجى ملء الحقول المطلوبة";
        return;
    }

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const payload = { email, password };

    if (!isLoginMode) {
        payload.fullName = document.getElementById('loginFullName').value.trim();
        payload.phone = document.getElementById('loginPhone').value.trim();
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('nexora_token', data.token);
            userToken = data.token;
            currentUserId = data.user._id;
            document.getElementById("loginOverlay").classList.add("hidden");
            updateDashboardData(data.user);
            fetchMiningStatus();
            fetchActiveAds();
            fetchMarketData();
        } else {
            errorDiv.innerText = data.message;
        }
    } catch (err) {
        errorDiv.innerText = "خطأ في الاتصال";
    }
}

function updateDashboardData(user) {
    document.getElementById("liveBalance").innerHTML = `${user.balance.toFixed(4)} <small>USDT</small>`;
    document.getElementById("walletBalance").innerText = `${user.balance.toFixed(2)} USDT`;
    document.getElementById("casinoBalance").innerText = `${user.casinoBalance.toFixed(2)} USDT`;
    document.getElementById("freeRoundsDisplay").innerText = user.freeRounds || 0;
    document.getElementById("freeRoundsDisplay2").innerText = user.freeRounds || 0;
    document.getElementById("welcomeMessage").innerText = `مرحباً بك، ${user.fullName}`;
    document.getElementById("walletPoints").innerText = user.points ? user.points.toFixed(1) : '0';
}

function navigateTo(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`section-${sectionId}`).classList.add('active');
    document.querySelector(`.nav-item[data-section="${sectionId}"]`).classList.add('active');
}

// ===== إعداد أزرار التعدين =====
function setupMiningButtons() {
    document.getElementById('miningClickBtn').onclick = async () => {
        if (!currentUserId) return;
        try {
            const response = await fetch('/api/mining/click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });
            const data = await response.json();
            if (data.success) {
                document.getElementById('miningProgressDisplay').innerText = `${data.miningProgress.toFixed(4)} USDT`;
                document.getElementById('miningClicksDisplay').innerText = `${data.miningClicks} / 100`;
                document.getElementById('miningRemainingDisplay').innerText = data.remaining;
                // حفظ الحالة محلياً
                saveMiningToLocalStorage(data.miningProgress, data.miningClicks, new Date().toISOString());
                updateMiningResetTimer(new Date().toISOString());
                
                let statusMsg = `✅ +0.001 USDT (${data.miningClicks}/100)`;
                if (data.bonus > 0) statusMsg += ` | 🎁 مكافأة +${data.bonus} USDT`;
                if (data.freeRound) {
                    statusMsg += ' | 🎰 جولة مجانية!';
                    document.getElementById("freeRoundsDisplay").innerText = 
                        (parseInt(document.getElementById("freeRoundsDisplay").innerText) || 0) + 1;
                    document.getElementById("freeRoundsDisplay2").innerText = 
                        document.getElementById("freeRoundsDisplay").innerText;
                }
                document.getElementById("miningStatus").innerHTML = statusMsg;
            } else {
                document.getElementById("miningStatus").innerHTML = `⚠️ ${data.message}`;
            }
        } catch (err) {
            console.error("خطأ في التعدين:", err);
        }
    };

    document.getElementById('harvestMiningBtn').onclick = async () => {
        if (!currentUserId) return;
        try {
            const response = await fetch('/api/mining/harvest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });
            const data = await response.json();
            if (data.success) {
                document.getElementById('miningProgressDisplay').innerText = '0.0000 USDT';
                document.getElementById("liveBalance").innerHTML = `${data.newBalance.toFixed(4)} <small>USDT</small>`;
                document.getElementById("walletBalance").innerText = `${data.newBalance.toFixed(2)} USDT`;
                document.getElementById("miningStatus").innerHTML = `✅ تم حصاد ${data.harvested.toFixed(4)} USDT`;
                // تصفير localStorage
                saveMiningToLocalStorage(0, parseInt(document.getElementById('miningClicksDisplay').innerText.split(' / ')[0]) || 0, new Date().toISOString());
            } else {
                document.getElementById("miningStatus").innerHTML = `⚠️ ${data.message}`;
            }
        } catch (err) {
            console.error("خطأ في الحصاد:", err);
        }
    };
}

// ===== جلب حالة التعدين من الخادم =====
async function fetchMiningStatus() {
    if (!currentUserId) return;
    try {
        const response = await fetch('/api/mining/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('miningProgressDisplay').innerText = `${data.miningProgress.toFixed(4)} USDT`;
            document.getElementById('miningClicksDisplay').innerText = `${data.miningClicks} / 100`;
            document.getElementById('miningRemainingDisplay').innerText = data.remaining;
            updateMiningResetTimer(data.lastReset || data.miningLastReset);
            // مزامنة localStorage
            saveMiningToLocalStorage(data.miningProgress, data.miningClicks, data.lastReset || data.miningLastReset);
            if (data.freeRounds !== undefined) {
                document.getElementById("freeRoundsDisplay").innerText = data.freeRounds;
                document.getElementById("freeRoundsDisplay2").innerText = data.freeRounds;
            }
        }
    } catch (err) {
        console.error("خطأ في جلب حالة التعدين:", err);
    }
}

// ===== لعبة الدجاجة =====
function updateDifficultyDisplay() {
    chosenDifficulty = document.getElementById('difficultySelect').value;
    const settings = difficultySettings[chosenDifficulty];
    document.getElementById('climbRiskLabel').innerText = settings.bombs;
    const maxMultiplier = settings.baseMultiplier + ((totalCells - settings.bombs) * settings.increment);
    document.getElementById('climbProfitLabel').innerText = maxMultiplier.toFixed(2);
    document.getElementById('climbMultiplier').innerText = `${settings.baseMultiplier.toFixed(2)}x`;
}

function startClimbGame() {
    if (!currentUserId) {
        document.getElementById('climbResult').innerHTML = '<span style="color:#e74c3c;">يجب تسجيل الدخول أولاً</span>';
        return;
    }
    
    const settings = difficultySettings[chosenDifficulty];
    const betAmount = parseFloat(document.getElementById('climbBet').value) || 0;
    const useFreeRound = document.getElementById('useFreeRound').checked;
    
    if (!useFreeRound && betAmount <= 0) {
        document.getElementById('climbResult').innerHTML = '<span style="color:#e74c3c;">الرجاء إدخال مبلغ الرهان</span>';
        return;
    }

    gameInProgress = true;
    currentSteps = 0;
    currentMultiplier = settings.baseMultiplier;
    bombLocations = [];
    const totalBombs = settings.bombs;
    
    while (bombLocations.length < totalBombs) {
        let randPos = Math.floor(Math.random() * totalCells);
        if (!bombLocations.includes(randPos)) bombLocations.push(randPos);
    }
    
    const grid = document.getElementById('climbGrid');
    grid.innerHTML = '';
    document.getElementById('climbCashoutBtn').disabled = false;
    document.getElementById('climbStep').innerText = '0';
    document.getElementById('climbMultiplier').innerText = `${settings.baseMultiplier.toFixed(2)}x`;
    document.getElementById('climbResult').innerHTML = '';
    
    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'climb-cell';
        cell.innerHTML = '<i class="fas fa-question" style="color:#4a3f68;"></i>';
        cell.onclick = () => revealCell(i, cell, useFreeRound, betAmount);
        grid.appendChild(cell);
    }
}

async function revealCell(index, cellElement, useFreeRound, betAmount) {
    if (!gameInProgress) return;
    
    const settings = difficultySettings[chosenDifficulty];
    
    if (bombLocations.includes(index)) {
        // انفجار القنبلة
        cellElement.className = 'climb-cell bomb';
        cellElement.innerHTML = '<i class="fas fa-bomb"></i>';
        gameInProgress = false;
        document.getElementById('climbCashoutBtn').disabled = true;
        document.getElementById('climbResult').innerHTML = '<span style="color:#e74c3c;">💥 انفجرت! خسرت الجولة</span>';
        document.getElementById('climbResult').className = 'game-result lose';
        
        // خصم الرهان إذا لم تكن جولة مجانية
        if (!useFreeRound && betAmount > 0 && currentUserId) {
            try {
                await fetch('/api/casino/lose', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, amount: betAmount })
                });
                verifySessionToken();
            } catch (err) {
                console.error("خطأ في خصم الرهان:", err);
            }
        }
        return;
    }
    
    // خلية آمنة
    cellElement.className = 'climb-cell safe';
    cellElement.innerHTML = '🍗';
    currentSteps++;
    // المعادلة: المضاعف = المضاعف الأساسي + (عدد الخطوات الآمنة × الزيادة لكل خطوة)
    currentMultiplier = settings.baseMultiplier + (currentSteps * settings.increment);
    document.getElementById('climbStep').innerText = currentSteps;
    document.getElementById('climbMultiplier').innerText = `${currentMultiplier.toFixed(2)}x`;
    
    // التحقق من كشف جميع الخلايا الآمنة
    const safeCells = totalCells - settings.bombs;
    if (currentSteps >= safeCells) {
        gameInProgress = false;
        document.getElementById('climbCashoutBtn').disabled = true;
        document.getElementById('climbResult').innerHTML = `<span style="color:#2ecc71;">🎉 رائع! كشفت كل الخلايا الآمنة! المضاعف: ${currentMultiplier.toFixed(2)}x</span>`;
        document.getElementById('climbResult').className = 'game-result win';
        await processWin(useFreeRound, betAmount);
    }
}

async function cashoutClimb() {
    if (!gameInProgress) return;
    gameInProgress = false;
    document.getElementById('climbCashoutBtn').disabled = true;
    
    const useFreeRound = document.getElementById('useFreeRound').checked;
    const betAmount = parseFloat(document.getElementById('climbBet').value) || 0;
    
    const winnings = useFreeRound ? 0 : betAmount * currentMultiplier;
    document.getElementById('climbResult').innerHTML = `<span style="color:#2ecc71;">✅ تم السحب! المضاعف: ${currentMultiplier.toFixed(2)}x | الربح: ${winnings.toFixed(4)} USDT</span>`;
    document.getElementById('climbResult').className = 'game-result win';
    
    await processWin(useFreeRound, betAmount);
}

async function processWin(useFreeRound, betAmount) {
    if (!currentUserId) return;
    
    try {
        const response = await fetch('/api/casino/win', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUserId,
                amount: betAmount,
                multiplier: currentMultiplier,
                useFreeRound: useFreeRound
            })
        });
        const data = await response.json();
        if (data.success) {
            updateDashboardData(data.user);
        }
    } catch (err) {
        console.error("خطأ في معالجة الربح:", err);
    }
}

// ===== الإعلانات =====
function setupAdListeners() {
    document.getElementById('adTargetViews')?.addEventListener('input', updateAdCost);
}

function updateAdCost() {
    const targetViews = parseInt(document.getElementById('adTargetViews').value) || 0;
    const cost = targetViews * 0.001;
    document.getElementById('adCostDisplay').innerText = cost.toFixed(2);
}

async function fetchActiveAds() {
    try {
        const response = await fetch('/api/ads/active');
        const data = await response.json();
        if (data.success) {
            renderAds(data.ads);
        }
    } catch (err) {
        console.error("خطأ في جلب الإعلانات:", err);
    }
}

function renderAds(ads) {
    const container = document.getElementById('activeAdsContainer');
    if (!ads || ads.length === 0) {
        container.innerHTML = '<p style="color:#8a7fa0; text-align:center;">لا توجد إعلانات نشطة حالياً</p>';
        return;
    }
    
    container.innerHTML = ads.map(ad => {
        const progress = (ad.currentViews / ad.targetViews) * 100;
        const completed = ad.currentViews >= ad.targetViews;
        return `
            <div class="ad-card" style="margin:8px 0;">
                <h5 style="color:var(--gold); font-size:clamp(14px,3vw,16px);">${ad.title || 'إعلان'}</h5>
                <p style="font-size:clamp(12px,2.5vw,14px); color:#8a7fa0;">${ad.content || ''}</p>
                <div class="ad-progress">
                    <div class="ad-progress-fill" style="width:${progress}%;"></div>
                </div>
                <small style="color:#8a7fa0;">${ad.currentViews} / ${ad.targetViews} مشاهدة</small>
                <button class="btn btn-gold" onclick="viewAd('${ad._id}', this)" 
                    style="margin-top:6px; width:100%; font-size:clamp(12px,2.5vw,14px);"
                    ${completed ? 'disabled' : ''}>
                    ${completed ? '✅ مكتمل' : '👁️ مشاهدة (+0.5 نقطة)'}
                </button>
            </div>
        `;
    }).join('');
}

async function viewAd(adId, buttonElement) {
    if (!currentUserId) {
        document.getElementById('adMessage').innerText = 'يجب تسجيل الدخول أولاً';
        return;
    }
    
    try {
        const response = await fetch('/api/ads/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adId, userId: currentUserId })
        });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('adMessage').innerHTML = '<span style="color:#2ecc71;">✅ تمت المشاهدة +0.5 نقطة</span>';
            
            // تحديث النقاط في الواجهة
            const pointsSpan = document.getElementById('walletPoints');
            if (pointsSpan) {
                pointsSpan.innerText = (parseFloat(pointsSpan.innerText) + 0.5).toFixed(1);
            }
            
            // تحديث عداد الجولات المجانية إذا تم منحها
            if (data.freeRoundAwarded) {
                const currentRounds = parseInt(document.getElementById('freeRoundsDisplay').innerText) || 0;
                document.getElementById('freeRoundsDisplay').innerText = currentRounds + 1;
                document.getElementById('freeRoundsDisplay2').innerText = currentRounds + 1;
                document.getElementById('adMessage').innerHTML += ' | 🎰 جولة مجانية!';
            }
            
            // تحديث شريط التقدم
            const progressFill = buttonElement.parentElement.querySelector('.ad-progress-fill');
            if (progressFill) {
                const progress = (data.currentViews / data.targetViews) * 100;
                progressFill.style.width = `${progress}%`;
            }
            
            // تحديث نص العداد
            const counterSpan = buttonElement.parentElement.querySelector('small');
            if (counterSpan) {
                counterSpan.innerText = `${data.currentViews} / ${data.targetViews} مشاهدة`;
            }
            
            // تعطيل الزر إذا اكتمل
            if (data.completed) {
                buttonElement.disabled = true;
                buttonElement.innerText = '✅ مكتمل';
            }
        } else {
            document.getElementById('adMessage').innerHTML = `<span style="color:#e74c3c;">⚠️ ${data.message}</span>`;
        }
    } catch (err) {
        console.error("خطأ في مشاهدة الإعلان:", err);
        document.getElementById('adMessage').innerText = 'خطأ في الاتصال';
    }
}

async function submitAd() {
    if (!currentUserId) {
        document.getElementById('adSubmitStatus').innerText = 'يجب تسجيل الدخول أولاً';
        return;
    }
    
    const title = document.getElementById('adTitle').value.trim();
    const content = document.getElementById('adContent').value.trim();
    const link = document.getElementById('adLink').value.trim();
    const targetViews = parseInt(document.getElementById('adTargetViews').value) || 0;
    
    if (!title || !content || targetViews <= 0) {
        document.getElementById('adSubmitStatus').innerText = 'يرجى ملء جميع الحقول';
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
                userId: currentUserId,
                userName: document.getElementById('welcomeMessage').innerText.replace('مرحباً بك، ', '')
            })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('adSubmitStatus').innerHTML = '<span style="color:#2ecc71;">✅ تم إرسال الإعلان للمراجعة</span>';
            document.getElementById('adTitle').value = '';
            document.getElementById('adContent').value = '';
            document.getElementById('adLink').value = '';
            document.getElementById('adTargetViews').value = '1000';
            updateAdCost();
            // تحديث الرصيد
            verifySessionToken();
        } else {
            document.getElementById('adSubmitStatus').innerHTML = `<span style="color:#e74c3c;">⚠️ ${data.message}</span>`;
        }
    } catch (err) {
        console.error("خطأ في نشر الإعلان:", err);
        document.getElementById('adSubmitStatus').innerText = 'خطأ في الاتصال';
    }
}

// ===== التحويل إلى الكازينو =====
async function transferToCasino() {
    if (!currentUserId) return;
    const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
    if (amount <= 0) return;
    
    try {
        const response = await fetch('/api/wallet/transfer-to-casino', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, amount })
        });
        const data = await response.json();
        if (data.success) {
            updateDashboardData(data.user);
            document.getElementById('transferAmount').value = '';
        } else {
            alert(data.message || 'فشل التحويل');
        }
    } catch (err) {
        console.error("خطأ في التحويل:", err);
    }
}

// ===== الوظائف الإضافية =====
async function copyAddress() {
    const address = document.getElementById('walletAddress').value;
    try {
        await navigator.clipboard.writeText(address);
        alert('تم نسخ العنوان بنجاح');
    } catch (err) {
        prompt('انسخ العنوان يدوياً:', address);
    }
}

function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    if (currentUserId) {
        // هنا يمكن إضافة منطق جلب بيانات المستخدم للإعدادات
    }
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

async function saveSettings() {
    // سيتم تنفيذها لاحقاً
    closeSettings();
}

async function claimFreeMining() {
    if (!currentUserId) return;
    // يمكن إضافة منطق المطالبة بالتعدين المجاني هنا
}

async function purchaseFlexMining() {
    if (!currentUserId) return;
    // يمكن إضافة منطق شراء التعدين المدفوع هنا
}

function updateInvestmentCalc() {
    const amount = parseFloat(document.getElementById('investAmount').value) || 0;
    const dailyProfit = amount * 0.02;
    const totalProfit = dailyProfit * 50;
    document.getElementById('dailyProfitDisplay').innerText = dailyProfit.toFixed(2) + ' USDT';
    document.getElementById('totalProfitDisplay').innerText = totalProfit.toFixed(2) + ' USDT';
}

async function submitWithdraw() {
    if (!currentUserId) return;
    // سيتم تنفيذها لاحقاً
}

async function sellPoints() {
    if (!currentUserId) return;
    // سيتم تنفيذها لاحقاً
}

async function setAgentPrices(sellPrice, buyPrice) {
    if (!currentUserId) return;
    try {
        const response = await fetch('/api/agent/set-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, sellPrice, buyPrice })
        });
        const data = await response.json();
        if (data.success) {
            alert('تم تحديث الأسعار بنجاح');
        } else {
            alert(data.message || 'فشل التحديث');
        }
    } catch (err) {
        console.error("خطأ في تحديث الأسعار:", err);
    }
}

async function requestAgent() {
    if (!currentUserId) {
        document.getElementById('agentRequestStatus').innerText = 'يجب تسجيل الدخول أولاً';
        return;
    }
    try {
        const response = await fetch('/api/agent/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUserId,
                fullName: document.getElementById('welcomeMessage').innerText.replace('مرحباً بك، ', ''),
                email: '',
                phone: ''
            })
        });
        const data = await response.json();
        document.getElementById('agentRequestStatus').innerHTML = data.success ?
            '<span style="color:#2ecc71;">✅ ' + data.message + '</span>' :
            '<span style="color:#e74c3c;">⚠️ ' + data.message + '</span>';
    } catch (err) {
        console.error("خطأ في طلب الوكالة:", err);
        document.getElementById('agentRequestStatus').innerText = 'خطأ في الاتصال';
    }
}

function showAdminLoginModal() {
    const password = prompt('أدخل كلمة مرور الإدارة:');
    if (password) {
        adminLogin(password);
    }
}

async function adminLogin(password) {
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await response.json();
        if (data.success) {
            alert('تم تسجيل الدخول بنجاح');
            // يمكن إضافة توجيه للوحة الإدارة هنا
        } else {
            alert('كلمة المرور غير صحيحة');
        }
    } catch (err) {
        console.error("خطأ في تسجيل الدخول:", err);
    }
}

async function fetchMarketData() {
    // سيتم تنفيذها لاحقاً
}

// تحديث حساب الاستثمار عند التحميل
document.addEventListener("DOMContentLoaded", () => {
    updateInvestmentCalc();
    updateDifficultyDisplay();
});
