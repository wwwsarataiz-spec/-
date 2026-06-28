// ==========================================
// Nexora Reborn – Frontend Logic
// ==========================================
let currentUserId = null;
let userToken = localStorage.getItem('nexora_token') || null;
let gameInProgress = false;
let gameSteps = 0;
let gameMultiplier = 1.0;
let bombCells = [];
let chosenDifficulty = 'medium';
let currentBet = 0;
let useFreeRound = false;
const totalRows = 5, totalCols = 5, cellSize = 80;

// Difficulty settings (matched to server, base + increment)
const difficulties = {
    normal: { base: 1.3, inc: 0.10, bombs: 3 },
    medium: { base: 1.6, inc: 0.15, bombs: 5 },
    hard: { base: 2.0, inc: 0.20, bombs: 7 },
    veryhard: { base: 2.2, inc: 0.25, bombs: 9 }
};

document.addEventListener("DOMContentLoaded", () => {
    setupMiningUI();
    setupCanvas();
    setupAdListeners();
    if (userToken) verifyToken();
    else showLogin();
    restoreMiningState();
    updateDifficultyDisplay();
});

// ========== Auth & Session ==========
function showLogin() { document.getElementById('loginOverlay').style.display = 'flex'; }
function hideLogin() { document.getElementById('loginOverlay').style.display = 'none'; }

let isLoginMode = true;
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('authTitle').innerText = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب';
    document.getElementById('loginFullName').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('toggleAuthLink').innerText = isLoginMode ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب؟ سجل دخولك';
}

async function handleAuth() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('authError');
    if (!email || !password) { errorDiv.innerText = 'يرجى ملء الحقول'; return; }
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const payload = { email, password };
    if (!isLoginMode) {
        payload.fullName = document.getElementById('loginFullName').value.trim();
        payload.phone = ''; // يمكن إضافتها لاحقاً
    }
    try {
        const res = await fetch(endpoint, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('nexora_token', data.token);
            userToken = data.token;
            currentUserId = data.user._id;
            hideLogin();
            updateUserUI(data.user);
            fetchMiningStatus();
            fetchActiveAds();
        } else {
            errorDiv.innerText = data.message;
        }
    } catch (err) { errorDiv.innerText = 'خطأ في الاتصال'; }
}

async function verifyToken() {
    try {
        const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${userToken}` } });
        const data = await res.json();
        if (data.success) {
            currentUserId = data.user._id;
            updateUserUI(data.user);
            fetchMiningStatus();
            fetchActiveAds();
            // تحقق من صلاحية الإدارة
            if (data.user.isAgent) {
                document.getElementById('adminNavItem').style.display = 'block';
                document.getElementById('agentPanel').style.display = 'block';
            }
        } else { logout(); }
    } catch (err) { logout(); }
}

function logout() {
    localStorage.removeItem('nexora_token');
    userToken = null;
    currentUserId = null;
    showLogin();
    document.getElementById('adminNavItem').style.display = 'none';
}

function updateUserUI(user) {
    document.getElementById('liveBalance').innerHTML = `${user.balance.toFixed(4)} <small>USDT</small>`;
    document.getElementById('walletBalance').innerHTML = `${user.balance.toFixed(4)} <small>USDT</small>`;
    document.getElementById('headerCasinoBalance').innerText = user.casinoBalance.toFixed(2);
    document.getElementById('walletCasinoBalance').innerText = user.casinoBalance.toFixed(2);
    document.getElementById('headerPoints').innerText = user.points.toFixed(1);
    document.getElementById('walletPoints').innerText = user.points.toFixed(1);
    document.getElementById('headerFreeRounds').innerText = user.freeRounds;
    document.getElementById('sidebarUserName').innerText = user.fullName;
    document.getElementById('sidebarUserEmail').innerText = user.email;
}

// ========== Navigation ==========
function navigateTo(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const section = document.getElementById(`section-${sectionId}`);
    if (section) section.classList.add('active');
    const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (navItem) navItem.classList.add('active');
    if (sectionId === 'casino') resetCanvas();
    if (sectionId === 'ads') fetchActiveAds();
    if (sectionId === 'market') fetchMarketData();
    if (sectionId === 'admin') loadAdminPanel();
    // إغلاق الشريط في الجوال
    document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ========== Mining ==========
function setupMiningUI() {
    document.getElementById('miningClickBtn').onclick = async () => {
        if (!currentUserId) return alert('سجل الدخول أولاً');
        try {
            const res = await fetch('/api/mining/click', { method: 'POST', headers: {'Authorization':`Bearer ${userToken}`} });
            const data = await res.json();
            if (data.success) {
                updateMiningDisplay(data);
                saveMiningState(data);
            } else alert(data.message);
        } catch (err) { alert('خطأ'); }
    };
    document.getElementById('harvestMiningBtn').onclick = async () => {
        if (!currentUserId) return;
        const res = await fetch('/api/mining/harvest', { method: 'POST', headers: {'Authorization':`Bearer ${userToken}`} });
        const data = await res.json();
        if (data.success) {
            document.getElementById('liveBalance').innerHTML = `${data.newBalance.toFixed(4)} <small>USDT</small>`;
            document.getElementById('miningProgressDisplay').innerText = '0.0000';
            saveMiningState({ miningProgress: 0, miningClicks: 0, lastReset: new Date() });
        } else alert(data.message);
    };
}

function updateMiningDisplay(data) {
    document.getElementById('miningProgressDisplay').innerText = data.miningProgress.toFixed(4);
    document.getElementById('miningClicksDisplay').innerText = `${data.miningClicks}/100`;
    const remaining = data.remaining || (100 - data.miningClicks);
    document.getElementById('miningResetDisplay').innerText = formatTime(data.lastReset);
    let msg = `+0.001 USDT (${data.miningClicks}/100)`;
    if (data.bonus) msg += ` | مكافأة +${data.bonus}`;
    if (data.freeRound) msg += ' | جولة مجانية!';
    document.getElementById('miningStatus').innerText = msg;
    // تحديث الجولات
    if (data.freeRound) {
        const fr = document.getElementById('headerFreeRounds');
        fr.innerText = parseInt(fr.innerText) + 1;
    }
}

function formatTime(lastReset) {
    const now = Date.now();
    const last = new Date(lastReset).getTime();
    const diff = 24*60*60*1000 - (now - last);
    if (diff <= 0) return 'الآن';
    const h = Math.floor(diff / (60*60*1000));
    const m = Math.floor((diff % (60*60*1000)) / (60*1000));
    return `${h} ساعة و${m} دقيقة`;
}

async function fetchMiningStatus() {
    if (!currentUserId) return;
    const res = await fetch('/api/mining/status', { headers: {'Authorization':`Bearer ${userToken}`} });
    const data = await res.json();
    if (data.success) updateMiningDisplay(data);
}

function saveMiningState(data) {
    localStorage.setItem('nexora_mining', JSON.stringify({
        progress: data.miningProgress || 0,
        clicks: data.miningClicks || 0,
        lastReset: data.lastReset || new Date()
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

// ========== Wallet & Transfer ==========
async function transferToCasino() {
    if (!currentUserId) return alert('سجل الدخول');
    const amount = parseFloat(document.getElementById('transferAmount').value);
    if (isNaN(amount) || amount <= 0) return alert('مبلغ غير صالح');
    const res = await fetch('/api/wallet/transfer-to-casino', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`},
        body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (data.success) {
        document.getElementById('transferAmount').value = '';
        document.getElementById('walletBalance').innerHTML = `${data.user.balance.toFixed(4)} <small>USDT</small>`;
        document.getElementById('walletCasinoBalance').innerText = data.user.casinoBalance.toFixed(2);
        document.getElementById('headerCasinoBalance').innerText = data.user.casinoBalance.toFixed(2);
    } else alert(data.message);
}

function copyAddress() { navigator.clipboard.writeText(document.getElementById('walletAddress').value); alert('تم النسخ'); }

async function requestWithdraw() {
    if (!currentUserId) return;
    const address = document.getElementById('withdrawAddress').value.trim();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    if (!address || amount < 10) return alert('الحد الأدنى 10 USDT وعنوان صحيح');
    const res = await fetch('/api/withdraw', { method: 'POST', headers: {'Authorization':`Bearer ${userToken}`, 'Content-Type':'application/json'}, body: JSON.stringify({address, amount}) });
    const data = await res.json();
    document.getElementById('withdrawStatus').innerText = data.message || 'تم استلام الطلب';
}

// ========== Casino (Canvas Chicken Run) ==========
const canvas = document.getElementById('chickenCanvas');
const ctx = canvas.getContext('2d');

function setupCanvas() {
    canvas.addEventListener('click', handleCanvasClick);
    document.getElementById('startGameBtn').onclick = startGame;
    document.getElementById('cashoutBtn').onclick = cashout;
}

function resetCanvas() {
    gameInProgress = false;
    document.getElementById('cashoutBtn').disabled = true;
    document.getElementById('gameMessage').innerHTML = '';
    drawGrid();
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
            const x = c * cellSize, y = r * cellSize;
            ctx.fillStyle = '#222244';
            ctx.fillRect(x, y, cellSize-2, cellSize-2);
            ctx.strokeStyle = '#f0c060';
            ctx.strokeRect(x, y, cellSize-2, cellSize-2);
        }
    }
    // Draw chicken at bottom
    ctx.fillStyle = '#f0c060';
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height-30, 15, 0, Math.PI*2);
    ctx.fill();
}

function getCellFromClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (row >= totalRows || col >= totalCols) return null;
    return { row, col };
}

function handleCanvasClick(e) {
    if (!gameInProgress) return;
    const cell = getCellFromClick(e);
    if (!cell) return;
    const idx = cell.row * totalCols + cell.col;
    revealCell(idx, cell.row, cell.col);
}

function startGame() {
    if (!currentUserId) { alert('سجل الدخول'); return; }
    chosenDifficulty = document.getElementById('difficultySelect').value;
    const diff = difficulties[chosenDifficulty];
    currentBet = parseFloat(document.getElementById('climbBet').value) || 0;
    useFreeRound = document.getElementById('useFreeRound').checked;

    if (!useFreeRound) {
        const casinoBal = parseFloat(document.getElementById('headerCasinoBalance').innerText);
        if (casinoBal < currentBet || currentBet <= 0) { alert('رصيد كازينو غير كافٍ أو مبلغ خاطئ'); return; }
    } else {
        const freeRounds = parseInt(document.getElementById('headerFreeRounds').innerText);
        if (freeRounds <= 0) { alert('لا جولات مجانية'); return; }
    }

    // خصم الرهان (لغير المجانية) عبر API
    if (!useFreeRound) {
        fetch('/api/casino/bet', {
            method: 'POST',
            headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`},
            body: JSON.stringify({ betAmount: currentBet, useFreeRound: false })
        }).then(res => res.json()).then(data => {
            if (!data.success) alert(data.message);
            else {
                document.getElementById('headerCasinoBalance').innerText = (parseFloat(document.getElementById('headerCasinoBalance').innerText) - currentBet).toFixed(2);
            }
        });
    } else {
        fetch('/api/casino/bet', {
            method: 'POST',
            headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`},
            body: JSON.stringify({ betAmount: 0, useFreeRound: true })
        });
        const fr = parseInt(document.getElementById('headerFreeRounds').innerText);
        document.getElementById('headerFreeRounds').innerText = fr - 1;
    }

    gameInProgress = true;
    gameSteps = 0;
    gameMultiplier = diff.base;
    bombCells = [];
    while (bombCells.length < diff.bombs) {
        const rand = Math.floor(Math.random() * (totalRows * totalCols));
        if (!bombCells.includes(rand)) bombCells.push(rand);
    }
    document.getElementById('cashoutBtn').disabled = false;
    document.getElementById('gameMessage').innerHTML = '';
    document.getElementById('climbMultiplier').innerText = `${gameMultiplier.toFixed(2)}x`;
    drawGrid();
}

function revealCell(idx, row, col) {
    const x = col * cellSize, y = row * cellSize;
    if (bombCells.includes(idx)) {
        // Bomb
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x, y, cellSize-2, cellSize-2);
        ctx.fillStyle = '#fff';
        ctx.font = '30px Arial';
        ctx.fillText('💣', x+20, y+45);
        gameInProgress = false;
        document.getElementById('cashoutBtn').disabled = true;
        document.getElementById('gameMessage').innerHTML = '<span style="color:#e74c3c;">خسرت الجولة</span>';
        // لو مش جولة مجانية، الرصيد خُصم بالفعل عند البداية
        if (!useFreeRound) {
            fetch('/api/casino/lose', {
                method: 'POST',
                headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`},
                body: JSON.stringify({ betAmount: currentBet })
            });
        }
    } else {
        // Safe
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(x, y, cellSize-2, cellSize-2);
        ctx.fillStyle = '#fff';
        ctx.font = '30px Arial';
        ctx.fillText('🍗', x+20, y+45);
        gameSteps++;
        const diff = difficulties[chosenDifficulty];
        gameMultiplier = diff.base + (gameSteps * diff.inc);
        document.getElementById('climbMultiplier').innerText = `${gameMultiplier.toFixed(2)}x`;

        // إذا كشف كل الخلايا الآمنة (ما تبقى خلايا آمنة = 0) -> فوز تلقائي
        const safeCells = totalRows*totalCols - diff.bombs;
        if (gameSteps >= safeCells) {
            gameInProgress = false;
            document.getElementById('cashoutBtn').disabled = true;
            document.getElementById('gameMessage').innerHTML = '<span style="color:#2ecc71;">فزت! جميع الخلايا الآمنة</span>';
            processWin();
        }
    }
}

function cashout() {
    if (!gameInProgress) return;
    gameInProgress = false;
    document.getElementById('cashoutBtn').disabled = true;
    const winnings = useFreeRound ? currentBet * gameMultiplier : currentBet * gameMultiplier;
    document.getElementById('gameMessage').innerHTML = `<span style="color:#2ecc71;">سحبت ${winnings.toFixed(4)} USDT</span>`;
    processWin();
}

async function processWin() {
    try {
        const res = await fetch('/api/casino/win', {
            method: 'POST',
            headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`},
            body: JSON.stringify({ multiplier: gameMultiplier, betAmount: currentBet, useFreeRound })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('headerCasinoBalance').innerText = data.user.casinoBalance.toFixed(2);
            document.getElementById('walletCasinoBalance').innerText = data.user.casinoBalance.toFixed(2);
            if (data.user.freeRounds !== undefined) {
                document.getElementById('headerFreeRounds').innerText = data.user.freeRounds;
            }
        }
    } catch (err) {}
}

function updateDifficultyDisplay() {
    const diff = difficulties[document.getElementById('difficultySelect').value];
    document.getElementById('climbMultiplier').innerText = `${diff.base.toFixed(2)}x`;
    // إظهار عدد القنابل في مكان ما (لم نضفه بشكل منفصل لكن يمكن عبر console)
}

// ========== Ads ==========
function setupAdListeners() {
    document.getElementById('adTargetViews').addEventListener('input', function() {
        document.getElementById('adCostDisplay').innerText = (this.value * 0.001).toFixed(2);
    });
}

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
                <small>${ad.currentViews}/${ad.targetViews} مشاهدة</small>
                <button class="btn btn-gold" onclick="viewAd('${ad._id}')" ${ad.currentViews >= ad.targetViews ? 'disabled' : ''}>مشاهدة (+0.5 نقطة)</button>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p>لا توجد إعلانات نشطة</p>';
    }
}

async function viewAd(adId) {
    if (!currentUserId) return;
    const res = await fetch('/api/ads/view', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`},
        body: JSON.stringify({ adId })
    });
    const data = await res.json();
    if (data.success) {
        document.getElementById('adMessage').innerHTML = '✅ +0.5 نقطة';
        if (data.freeRoundAwarded) {
            document.getElementById('headerFreeRounds').innerText = parseInt(document.getElementById('headerFreeRounds').innerText) + 1;
            document.getElementById('adMessage').innerHTML += ' | 🎁 جولة مجانية';
        }
        fetchActiveAds(); // تحديث القائمة
    } else {
        document.getElementById('adMessage').innerHTML = `⚠️ ${data.message}`;
    }
}

async function submitAd() {
    if (!currentUserId) return;
    const title = document.getElementById('adTitle').value.trim();
    const content = document.getElementById('adContent').value.trim();
    const targetViews = parseInt(document.getElementById('adTargetViews').value);
    if (!title || !targetViews) return alert('املأ الحقول');
    const res = await fetch('/api/ads/create', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`},
        body: JSON.stringify({ title, content, targetViews })
    });
    const data = await res.json();
    if (data.success) {
        alert('تم إرسال الإعلان للمراجعة');
        document.getElementById('adTitle').value = '';
        document.getElementById('adContent').value = '';
    } else alert(data.message);
}

// ========== Market & Agent ==========
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
    if (!currentUserId) return;
    const sell = parseFloat(document.getElementById('agentSellPrice').value);
    const buy = parseFloat(document.getElementById('agentBuyPrice').value);
    const res = await fetch('/api/agent/set-prices', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`},
        body: JSON.stringify({ sellPrice: sell, buyPrice: buy })
    });
    const data = await res.json();
    alert(data.message);
}

async function requestAgent() {
    if (!currentUserId) return;
    const res = await fetch('/api/agent/request', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${userToken}`}
    });
    const data = await res.json();
    document.getElementById('agentRequestStatus').innerText = data.message;
}

// ========== Admin ==========
async function showAdminLogin() {
    const password = prompt('أدخل كلمة مرور الإدارة:');
    if (!password) return;
    const res = await fetch('/api/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password }) });
    const data = await res.json();
    if (data.success) {
        localStorage.setItem('admin_token', data.token);
        document.getElementById('adminNavItem').style.display = 'block';
        navigateTo('admin');
    } else alert(data.message);
}

async function loadAdminPanel() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const res = await fetch('/api/admin/stats', { headers: {'Authorization':`Bearer ${token}`} });
    const data = await res.json();
    if (data.success) {
        document.getElementById('adminStats').innerHTML = `
            <span>👥 المستخدمين: ${data.totalUsers}</span>
            <span>📢 الإعلانات: ${data.totalAds}</span>
            <span>⏳ إعلانات معلقة: ${data.pendingAds}</span>
            <span>🤝 طلبات وكالة: ${data.pendingAgents}</span>
        `;
    }
}

async function toggleWithdrawal() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const res = await fetch('/api/admin/toggle-withdrawal', { method: 'POST', headers: {'Authorization':`Bearer ${token}`, 'Content-Type':'application/json'} });
    const data = await res.json();
    alert(data.message);
}

// ========== Misc ==========
window.navigateTo = navigateTo;
window.toggleSidebar = toggleSidebar;
window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;
window.viewAd = viewAd;
window.submitAd = submitAd;
window.copyAddress = copyAddress;
window.transferToCasino = transferToCasino;
window.requestWithdraw = requestWithdraw;
window.requestAgent = requestAgent;
window.updateAgentPrices = updateAgentPrices;
window.showAdminLogin = showAdminLogin;
window.updateDifficultyDisplay = updateDifficultyDisplay;
window.startGame = startGame;
window.cashout = cashout;
