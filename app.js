let currentUserId = null;
let userToken = localStorage.getItem('nexora_token') || null;

let gameInProgress = false;
let currentSteps = 0;
let currentMultiplier = 1.00;
let bombLocations = [];
const totalCells = 25;

document.addEventListener("DOMContentLoaded", () => {
    setupMiningButtons();
    if (userToken) {
        verifySessionToken();
    } else {
        document.getElementById("loginOverlay").classList.remove("hidden");
    }
});

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
    document.getElementById("freeRoundsDisplay").innerText = user.freeRounds;
    document.getElementById("welcomeMessage").innerText = `مرحباً بك، ${user.fullName}`;
}

function navigateTo(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`section-${sectionId}`).classList.add('active');
    document.querySelector(`.nav-item[data-section="${sectionId}"]`).classList.add('active');
}

function setupMiningButtons() {
    document.getElementById('miningClickBtn').onclick = async () => {
        const response = await fetch('/api/mining/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('miningProgressDisplay').innerText = `${data.miningProgress.toFixed(4)} USDT`;
            document.getElementById('miningClicksDisplay').innerText = `${data.miningClicks} / 100`;
        }
    };

    document.getElementById('harvestMiningBtn').onclick = async () => {
        const response = await fetch('/api/mining/harvest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        if (data.success) {
            verifySessionToken();
        }
    };
}

async function fetchMiningStatus() {
    const response = await fetch('/api/mining/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
    });
    const data = await response.json();
    if (data.success) {
        document.getElementById('miningProgressDisplay').innerText = `${data.miningProgress.toFixed(4)} USDT`;
        document.getElementById('miningClicksDisplay').innerText = `${data.miningClicks} / 100`;
    }
}

let difficultySettings = { normal: { bombs: 3, multiplier: 1.3 }, medium: { bombs: 5, multiplier: 1.6 }, hard: { bombs: 8, multiplier: 2.0 } };
let chosenDifficulty = "medium";

function updateDifficultyDisplay() { chosenDifficulty = document.getElementById('difficultySelect').value; }

function startClimbGame() {
    gameInProgress = true; currentSteps = 0; currentMultiplier = 1.00; bombLocations = [];
    const totalBombs = difficultySettings[chosenDifficulty].bombs;
    while (bombLocations.length < totalBombs) {
        let randPos = Math.floor(Math.random() * totalCells);
        if (!bombLocations.includes(randPos)) bombLocations.push(randPos);
    }
    const grid = document.getElementById('climbGrid');
    grid.innerHTML = '';
    document.getElementById('climbCashoutBtn').disabled = false;
    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'climb-cell';
        cell.innerHTML = '<i class="fas fa-question" style="color:#4a3f68;"></i>';
        cell.onclick = () => revealCell(i, cell);
        grid.appendChild(cell);
    }
}

function revealCell(index, cellElement) {
    if (!gameInProgress) return;
    if (bombLocations.includes(index)) {
        cellElement.className = 'climb-cell bomb';
        cellElement.innerHTML = '<i class="fas fa-bomb"></i>';
        gameInProgress = false;
    } else {
        cellElement.className = 'climb-cell safe';
        cellElement.innerHTML = '🍗';
        currentSteps++;
        currentMultiplier *= difficultySettings[chosenDifficulty].multiplier;
        document.getElementById('climbStep').innerText = currentSteps;
        document.getElementById('climbMultiplier').innerText = `${currentMultiplier.toFixed(2)}x`;
    }
}

function cashoutClimb() { gameInProgress = false; document.getElementById('climbCashoutBtn').disabled = true; }

async function transferToCasino() {
    const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
    const response = await fetch('/api/wallet/transfer-to-casino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, amount })
    });
    const data = await response.json();
    if (data.success) updateDashboardData(data.user);
}
