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
    document.getElementById('dif
