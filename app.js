// =======================================================
//  Nexora Reborn – app.js (الإصدار الكامل مع Chicken Run)
// =======================================================

// ---------- متغيرات عامة ----------
let currentUser = null;
let token = localStorage.getItem('nexora_token') || null;

// حالة اللعبة
let gameActive = false;
let gameSteps = 0;
let gameMultiplier = 1.0;
let bombPositions = [];          // مصفوفة أعمدة القنابل لكل صف (من الصف 0 إلى 4)
let currentRow = 4;             // الصف الحالي (0 = الأعلى، 4 = الأسفل)
let currentCol = 2;             // العمود الحالي (0-4)
let chosenDifficulty = 'medium';
let betAmount = 0;
let usingFreeRound = false;
let canvas, ctx;
const ROWS = 5;
const COLS = 5;
const CELL_SIZE = 80;

// إعدادات الصعوبة
const DIFFICULTY = {
    normal:  { base: 1.3, inc: 0.10, bombs: 3 },
    medium:  { base: 1.6, inc: 0.15, bombs: 5 },
    hard:    { base: 2.0, inc: 0.20, bombs: 7 },
    veryhard:{ base: 2.2, inc: 0.25, bombs: 9 }
};

// ---------- عند تحميل الصفحة ----------
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('chickenCanvas');
    ctx = canvas.getContext('2d');
    
    setupUI();
    if (token) verifySession();
    else showLogin();
    
    restoreMiningState();
    updateDifficultyDisplay();
    drawStaticRoad(); // رسم الشارع الأولي
});

// ---------- المصادقة والجلسة ----------
async function verifySession() {
    try {
        const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            hideLogin();
            updateAllBalances();
            fetchMiningStatus();
            fetchActiveAds();
        } else {
            logout();
        }
    } catch { logout(); }
}

function showLogin() { document.getElementById('loginOverlay').style.display = 'flex'; }
function hideLogin() { document.getElementById('loginOverlay').style.display = 'none'; }

let authMode = 'login';
function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('authTitle').innerText = authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب';
    document.getElementById('loginFullName').style.display = authMode === 'register' ? 'block' : 'none';
    document.getElementById('toggleAuthLink').innerText = authMode === 'login' ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب؟ سجل دخولك';
}

async function handleAuth() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('authError');
    if (!email || !password) { errEl.innerText = 'املأ الحقول'; return; }

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = { email, password };
    if (authMode === 'register') {
        payload.fullName = document.getElementById('loginFullName').value.trim() || 'مستخدم';
        payload.phone = '000';
    }

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            token = data.token;
            localStorage.setItem('nexora_token', token);
            currentUser = data.user;
            hideLogin();
            updateAllBalances();
            fetchMiningStatus();
            fetchActiveAds();
        } else {
            errEl.innerText = data.message;
        }
    } catch { errEl.innerText = 'خطأ في الاتصال'; }
}

function logout() {
    localStorage.removeItem('nexora_token');
    token = null;
    currentUser = null;
    showLogin();
}

// ---------- التنقل بين الأقسام ----------
function navigateTo(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const sec = document.getElementById(`section-${section}`);
    if (sec) sec.classList.add('active');
    const nav = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (nav) nav.classList.add('active');
    
    if (section === 'ads') fetchActiveAds();
    if (section === 'market') fetchMarketData();
    if (section === 'admin') loadAdminPanel();
    if (section === 'casino') drawStaticRoad();
    document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ---------- تحديث الأرصدة ----------
function updateAllBalances() {
    if (!currentUser) return;
    document.getElementById('liveBalance').innerHTML = `${currentUser.balance.toFixed(4)} <small>USDT</small>`;
    document.getElementById('walletBalance').innerHTML = `${currentUser.balance.toFixed(4)} <small>USDT</small>`;
    document.getElementById('headerCasinoBalance').innerText = currentUser.casinoBalance.toFixed(2);
    document.getElementById('walletCasinoBalance').innerText = currentUser.casinoBalance.toFixed(2);
    document.getElementById('headerPoints').innerText = currentUser.points.toFixed(1);
    document.getElementById('walletPoints').innerText = currentUser.points.toFixed(1);
    document.getElementById('headerFreeRounds').innerText = currentUser.freeRounds;
    document.getElementById('sidebarUserName').innerText = currentUser.fullName;
    document.getElementById('sidebarUserEmail').innerText = currentUser.email;
}

// ---------- نظام التعدين ----------
function setupUI() {
    document.getElementById('miningClickBtn').onclick = miningClick;
    document.getElementById('harvestMiningBtn').onclick = harvestMining;
    document.getElementById('startGameBtn').onclick = startChickenRun;
    document.getElementById('cashoutBtn').onclick = cashout;
    document.getElementById('difficultySelect').onchange = updateDifficultyDisplay;
    canvas.onclick = handleCanvasClick;
}

async function miningClick() {
    if (!currentUser) return alert('سجل الدخول أولاً');
    const res = await fetch('/api/mining/click', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
        updateMiningDisplay(data);
        saveMiningState(data);
    } else alert(data.message);
}

async function harvestMining() {
    if (!currentUser) return;
    const res = await fetch('/api/mining/harvest', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
        currentUser.balance = data.newBalance;
        updateAllBalances();
        document.getElementById('miningProgressDisplay').innerText = '0.0000';
        saveMiningState({ miningProgress: 0, miningClicks: 0, lastReset: new Date() });
    } else alert(data.message);
}

async function fetchMiningStatus() {
    if (!currentUser) return;
    const res = await fetch('/api/mining/status', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) updateMiningDisplay(data);
}

function updateMiningDisplay(data) {
    document.getElementById('miningProgressDisplay').innerText = data.miningProgress.toFixed(4);
    document.getElementById('miningClicksDisplay').innerText = `${data.miningClicks}/100`;
    const remaining = 100 - data.miningClicks;
    document.getElementById('miningResetDisplay').innerText = formatTime(data.lastReset);
    let msg = `+0.001 USDT (${data.miningClicks}/100)`;
    if (data.bonus) msg += ` | 🎁 +${data.bonus}`;
    if (data.freeRound) {
        msg += ' | 🎰 جولة مجانية!';
        document.getElementById('headerFreeRounds').innerText = 
            parseInt(document.getElementById('headerFreeRounds').innerText) + 1;
    }
    document.getElementById('miningStatus').innerText = msg;
}

function formatTime(lastReset) {
    if (!lastReset) return '...';
    const now = Date.now();
    const last = new Date(lastReset).getTime();
    const diff = 24*60*60*1000 - (now - last);
    if (diff <= 0) return 'الآن';
    const h = Math.floor(diff / (60*60*1000));
    const m = Math.floor((diff % (60*60*1000)) / (60*1000));
    return `${h}س ${m}د`;
}

function saveMiningState(data) {
    localStorage.setItem('nexora_mining', JSON.stringify({
        progress: data.miningProgress || 0,
        clicks: data.miningClicks || 0,
        lastReset: data.lastReset || new Date().toISOString()
    }));
}
function restoreMiningState() {
    const saved = localStorage.getItem('nexora_mining');
    if (saved) {
        const s = JSON.parse(saved);
        document.getElementById('miningProgressDisplay').innerText = s.progress.toFixed(4);
        document.getElementById('miningClicksDisplay').innerText = `${s.clicks}/100`;
        document.getElementById('miningResetDisplay').innerText = formatTime(s.lastReset);
    }
}

// ---------- المحفظة والتحويل ----------
async function transferToCasino() {
    if (!currentUser) return alert('سجل الدخول');
    const amount = parseFloat(document.getElementById('transferAmount').value);
    if (isNaN(amount) || amount <= 0) return alert('مبلغ غير صالح');
    const res = await fetch('/api/wallet/transfer-to-casino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (data.success) {
        currentUser.balance = data.user.balance;
        currentUser.casinoBalance = data.user.casinoBalance;
        updateAllBalances();
        document.getElementById('transferAmount').value = '';
    } else alert(data.message);
}

function copyAddress() {
    navigator.clipboard.writeText(document.getElementById('walletAddress').value);
    alert('تم النسخ');
}

async function requestWithdraw() {
    if (!currentUser) return;
    const addr = document.getElementById('withdrawAddress').value.trim();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    if (!addr || amount < 10) return alert('الحد الأدنى 10 USDT وعنوان صحيح');
    // تحتاج إلى نقطة نهاية /api/withdraw (يمكن إضافتها لاحقاً)
    alert('جاري تطوير السحب الآلي، سيتم يدوياً');
}

// ========== لعبة الدجاجة (Chicken Run) ==========

// رسم الشارع الثابت
function drawStaticRoad() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // خلفية خضراء (عشب)
    ctx.fillStyle = '#4a7c3f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // الطريق (رمادي)
    ctx.fillStyle = '#555';
    ctx.fillRect(10, 10, canvas.width-20, canvas.height-20);
    // خطوط منتصف الطريق (بيضاء متقطعة)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 15]);
    for (let col = 1; col < COLS; col++) {
        ctx.beginPath();
        ctx.moveTo(col * CELL_SIZE, 10);
        ctx.lineTo(col * CELL_SIZE, canvas.height-10);
        ctx.stroke();
    }
    // خط أفقي
    for (let row = 1; row < ROWS; row++) {
        ctx.beginPath();
        ctx.moveTo(10, row * CELL_SIZE);
        ctx.lineTo(canvas.width-10, row * CELL_SIZE);
        ctx.stroke();
    }
    ctx.setLineDash([]); // إعادة تعيين

    // رسم الدجاجة في وضع البداية (إذا لم تكن اللعبة نشطة)
    if (!gameActive) {
        drawChicken(2, 4);
    }
}

// رسم الدجاجة في عمود وصف معين (الإحداثيات بالخلايا)
function drawChicken(col, row) {
    const x = col * CELL_SIZE + CELL_SIZE/2;
    const y = row * CELL_SIZE + CELL_SIZE/2 + 10; // +10 عشان تكون فوق الخط السفلي
    ctx.fillStyle = '#f0c060';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI*2);
    ctx.fill();
    // عيون
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x-8, y-8, 3, 0, Math.PI*2);
    ctx.arc(x+8, y-8, 3, 0, Math.PI*2);
    ctx.fill();
    // منقار
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.moveTo(x, y-2);
    ctx.lineTo(x+12, y-8);
    ctx.lineTo(x, y-14);
    ctx.fill();
    // رجلين
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x-10, y+20);
    ctx.lineTo(x-15, y+30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x+10, y+20);
    ctx.lineTo(x+15, y+30);
    ctx.stroke();
}

// تحديث عرض المضاعف
function updateDifficultyDisplay() {
    const diff = DIFFICULTY[document.getElementById('difficultySelect').value];
    document.getElementById('climbMultiplier').innerText = `${diff.base.toFixed(2)}x`;
}

// بدء الجولة
async function startChickenRun() {
    if (!currentUser) { alert('سجل الدخول'); return; }

    chosenDifficulty = document.getElementById('difficultySelect').value;
    const diff = DIFFICULTY[chosenDifficulty];
    betAmount = parseFloat(document.getElementById('climbBet').value) || 0;
    usingFreeRound = document.getElementById('useFreeRound').checked;

    // التحقق من الرصيد
    if (!usingFreeRound) {
        if (currentUser.casinoBalance < betAmount || betAmount <= 0) {
            alert('رصيد الكازينو غير كافٍ');
            return;
        }
    } else {
        if (currentUser.freeRounds <= 0) {
            alert('لا توجد جولات مجانية');
            return;
        }
    }

    // خصم الرهان (لغير المجانية)
    if (!usingFreeRound) {
        const res = await fetch('/api/casino/bet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ betAmount, useFreeRound: false })
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); return; }
        currentUser.casinoBalance -= betAmount;
    } else {
        currentUser.freeRounds -= 1;
    }
    updateAllBalances();

    // توليد القنابل (لكل صف قنبلة عشوائية في أحد الأعمدة)
    bombPositions = [];
    for (let r = 0; r < ROWS; r++) {
        bombPositions.push(Math.floor(Math.random() * COLS));
    }

    gameActive = true;
    gameSteps = 0;
    gameMultiplier = diff.base;
    currentRow = 4;
    currentCol = 2;

    document.getElementById('cashoutBtn').disabled = false;
    document.getElementById('gameMessage').innerHTML = '';
    document.getElementById('climbMultiplier').innerText = `${gameMultiplier.toFixed(2)}x`;
    drawStaticRoad();
}

// معالجة النقر على Canvas
function handleCanvasClick(e) {
    if (!gameActive) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    // مسموح فقط بالانتقال إلى صف أعلى (رقم صف أقل)
    if (row >= currentRow) return;

    // الانتقال
    const newCol = col;
    const newRow = row;

    // التحقق من القنبلة في الصف الجديد
    if (bombPositions[newRow] === newCol) {
        // انفجار
        gameActive = false;
        document.getElementById('cashoutBtn').disabled = true;
        drawExplosion(newCol, newRow);
        document.getElementById('gameMessage').innerHTML = '<span style="color:#e74c3c;">💥 انفجرت! خسرت الجولة</span>';
        if (!usingFreeRound) {
            fetch('/api/casino/lose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ betAmount })
            });
        }
    } else {
        // خطوة آمنة
        gameSteps++;
        const diff = DIFFICULTY[chosenDifficulty];
        gameMultiplier = diff.base + (gameSteps * diff.inc);
        document.getElementById('climbMultiplier').innerText = `${gameMultiplier.toFixed(2)}x`;

        // تحريك الدجاجة
        animateChicken(currentCol, currentRow, newCol, newRow);
        currentCol = newCol;
        currentRow = newRow;

        // فوز تلقائي إذا وصلت للصف 0 (الأعلى)
        if (newRow === 0) {
            gameActive = false;
            document.getElementById('cashoutBtn').disabled = true;
            document.getElementById('gameMessage').innerHTML = '<span style="color:#2ecc71;">🎉 فزت! وصلت إلى النهاية</span>';
            processWin();
        }
    }
}

// رسم انفجار
function drawExplosion(col, row) {
    const x = col * CELL_SIZE + CELL_SIZE/2;
    const y = row * CELL_SIZE + CELL_SIZE/2;
    ctx.fillStyle = '#ff3300';
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI*2);
    ctx.fill();
}

// تحريك الدجاجة
function animateChicken(fromCol, fromRow, toCol, toRow) {
    const startX = fromCol * CELL_SIZE + CELL_SIZE/2;
    const startY = fromRow * CELL_SIZE + CELL_SIZE/2 + 10;
    const endX = toCol * CELL_SIZE + CELL_SIZE/2;
    const endY = toRow * CELL_SIZE + CELL_SIZE/2 + 10;
    let progress = 0;
    const duration = 300;
    const startTime = Date.now();

    function step() {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / duration, 1);
        const x = startX + (endX - startX) * progress;
        const y = startY + (endY - startY) * progress;

        drawStaticRoad(); // إعادة رسم الخلفية
        // رسم الدجاجة في الموقع الجديد
        ctx.save();
        ctx.translate(x, y);
        // (الدجاجة مرسومة في drawChicken بمركز 0,0)
        drawChicken(0, -10); // تعديل بسيط
        ctx.restore();

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

// سحب الأرباح
function cashout() {
    if (!gameActive) return;
    gameActive = false;
    document.getElementById('cashoutBtn').disabled = true;
    const winAmount = usingFreeRound ? betAmount * gameMultiplier : betAmount * gameMultiplier;
    document.getElementById('gameMessage').innerHTML = `<span style="color:#2ecc71;">✅ سحبت ${winAmount.toFixed(4)} USDT</span>`;
    processWin();
}

async function processWin() {
    const res = await fetch('/api/casino/win', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ multiplier: gameMultiplier, betAmount, useFreeRound: usingFreeRound })
    });
    const data = await res.json();
    if (data.success) {
        currentUser.casinoBalance = data.user.casinoBalance;
        currentUser.freeRounds = data.user.freeRounds;
        updateAllBalances();
    }
}

// ---------- الإعلانات ----------
async function fetchActiveAds() {
    const res = await fetch('/api/ads/active');
    const data = await res.json();
    const container = document.getElementById('activeAdsContainer');
    if (data.success && data.ads.length) {
        container.innerHTML = data.ads.map(ad => `
            <div class="card" style="margin-bottom:10px;">
                <h4>${ad.title}</h4>
                <p>${ad.content}</p>
                <div style="background:#333; height:6px; border-radius:3px; margin:8px 0;">
                    <div style="width:${(ad.currentViews/ad.targetViews)*100}%; height:100%; background:var(--gold); border-radius:3px;"></div>
                </div>
                <small>${ad.currentViews}/${ad.targetViews}</small>
                <button class="btn btn-gold" onclick="viewAd('${ad._id}')" ${ad.currentViews >= ad.targetViews ? 'disabled' : ''}>مشاهدة (+0.5 نقطة)</button>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p>لا توجد إعلانات</p>';
    }
}

async function viewAd(adId) {
    if (!currentUser) return;
    const res = await fetch('/api/ads/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ adId })
    });
    const data = await res.json();
    if (data.success) {
        currentUser.points += 0.5;
        if (data.freeRoundAwarded) currentUser.freeRounds += 1;
        updateAllBalances();
        fetchActiveAds();
        document.getElementById('adMessage').innerHTML = data.freeRoundAwarded ? '✅ +0.5 نقطة وجولة مجانية' : '✅ +0.5 نقطة';
    } else {
        document.getElementById('adMessage').innerHTML = `⚠️ ${data.message}`;
    }
}

async function submitAd() {
    if (!currentUser) return;
    const title = document.getElementById('adTitle').value.trim();
    const content = document.getElementById('adContent').value.trim();
    const target = parseInt(document.getElementById('adTargetViews').value);
    if (!title || !target) return alert('املأ الحقول');
    const res = await fetch('/api/ads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, content, targetViews: target })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
        document.getElementById('adTitle').value = '';
        document.getElementById('adContent').value = '';
    }
}

// ---------- السوق والوكالة ----------
async function fetchMarketData() {
    const res = await fetch('/api/market/agents');
    const data = await res.json();
    if (data.success) {
        let minSell = Infinity, maxBuy = 0;
        data.agents.forEach(a => {
            if (a.sellPrice < minSell) minSell = a.sellPrice;
            if (a.buyPrice > maxBuy) maxBuy = a.buyPrice;
        });
        document.getElementById('minSellPrice').innerText = minSell !== Infinity ? minSell.toFixed(4) : '-';
        document.getElementById('maxBuyPrice').innerText = maxBuy > 0 ? maxBuy.toFixed(4) : '-';
    }
}

async function updateAgentPrices() {
    const sell = parseFloat(document.getElementById('agentSellPrice').value);
    const buy = parseFloat(document.getElementById('agentBuyPrice').value);
    const res = await fetch('/api/agent/set-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sellPrice: sell, buyPrice: buy })
    });
    alert((await res.json()).message);
}

async function requestAgent() {
    const res = await fetch('/api/agent/request', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    document.getElementById('agentRequestStatus').innerText = (await res.json()).message;
}

// ---------- الإدارة ----------
async function showAdminLogin() {
    const pw = prompt('كلمة مرور الإدارة:');
    if (!pw) return;
    const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
    });
    const data = await res.json();
    if (data.success) {
        localStorage.setItem('admin_token', data.token);
        document.getElementById('adminNavItem').style.display = 'block';
        navigateTo('admin');
    } else alert(data.message);
}

async function loadAdminPanel() {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) return;
    const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.success) {
        document.getElementById('adminStats').innerHTML = `
            <span>👥 ${data.totalUsers} مستخدم</span>
            <span>📢 ${data.totalAds} إعلان</span>
            <span>⏳ ${data.pendingAds} معلق</span>
            <span>🤝 ${data.pendingAgents} طلب</span>
        `;
    }
}

// ---------- ربط الدوال العامة ----------
window.navigateTo = navigateTo;
window.toggleSidebar = toggleSidebar;
window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;
window.miningClick = miningClick;
window.harvestMining = harvestMining;
window.transferToCasino = transferToCasino;
window.copyAddress = copyAddress;
window.requestWithdraw = requestWithdraw;
window.startChickenRun = startChickenRun;
window.cashout = cashout;
window.updateDifficultyDisplay = updateDifficultyDisplay;
window.viewAd = viewAd;
window.submitAd = submitAd;
window.updateAgentPrices = updateAgentPrices;
window.requestAgent = requestAgent;
window.showAdminLogin = showAdminLogin;
