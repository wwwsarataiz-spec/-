// ==========================================
// public/app.js - كود الواجهة الأمامية
// ==========================================

const API_URL = window.location.origin || 'https://nexora-backend-ko1u.onrender.com';
let currentUser = null;
let authToken = localStorage.getItem('nexora_token');

// ==========================================
// دوال الاتصال بالخادم
// ==========================================
async function callApi(endpoint, data = {}, method = 'POST') {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
    };
    const options = { method, headers, body: method !== 'GET' ? JSON.stringify(data) : undefined };
    try {
        const res = await fetch(`${API_URL}${endpoint}`, options);
        return await res.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
}

// ==========================================
// تسجيل الدخول الدائم
// ==========================================
function saveLogin(token, user) {
    localStorage.setItem('nexora_token', token);
    localStorage.setItem('nexora_user', JSON.stringify(user));
    authToken = token;
}

function loadSavedLogin() {
    const token = localStorage.getItem('nexora_token');
    const user = JSON.parse(localStorage.getItem('nexora_user') || 'null');
    if (token && user) {
        authToken = token;
        currentUser = user;
        return true;
    }
    return false;
}

function clearLogin() {
    localStorage.removeItem('nexora_token');
    localStorage.removeItem('nexora_user');
    authToken = null;
    currentUser = null;
}

// ==========================================
// دوال شاشة الدخول
// ==========================================
function showAuthMsg(text, type) {
    const el = document.getElementById('authMessage');
    el.textContent = text;
    el.className = 'message ' + type;
}

function showAuthForm(form) {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('forgotForm').classList.add('hidden');
    document.getElementById(form).classList.remove('hidden');
    document.getElementById('authMessage').className = 'message';
}

document.getElementById('showRegister').onclick = () => showAuthForm('registerForm');
document.getElementById('showForgot').onclick = () => showAuthForm('forgotForm');
document.getElementById('backToLogin').onclick = () => showAuthForm('loginForm');
document.getElementById('backToLogin2').onclick = () => showAuthForm('loginForm');

// ==========================================
// التسجيل
// ==========================================
document.getElementById('registerBtn').onclick = async function() {
    const username = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const telegram = document.getElementById('regTelegram').value.trim();
    const referralCode = document.getElementById('regReferral').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!username || !email || !password) {
        showAuthMsg('❌ جميع الحقول المطلوبة', 'error');
        return;
    }
    if (password.length < 6) {
        showAuthMsg('❌ كلمة المرور 6 أحرف على الأقل', 'error');
        return;
    }

    const data = await callApi('/api/auth/register', { username, email, password, phone, telegram, referralCode });
    if (data.success) {
        showAuthMsg('✅ تم إنشاء الحساب!', 'success');
        saveLogin(data.token, data.user);
        currentUser = data.user;
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appScreen').classList.remove('hidden');
        loadUserData();
    } else {
        showAuthMsg(data.message || '❌ فشل التسجيل', 'error');
    }
};

// ==========================================
// تسجيل الدخول
// ==========================================
document.getElementById('loginBtn').onclick = async function() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showAuthMsg('❌ البريد وكلمة المرور مطلوبة', 'error');
        return;
    }

    const data = await callApi('/api/auth/login', { email, password });
    if (data.success) {
        showAuthMsg('✅ تم تسجيل الدخول', 'success');
        saveLogin(data.token, data.user);
        currentUser = data.user;
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appScreen').classList.remove('hidden');
        loadUserData();
    } else {
        showAuthMsg(data.message || '❌ بيانات غير صحيحة', 'error');
    }
};

// ==========================================
// الخروج
// ==========================================
function logout() {
    clearLogin();
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('authScreen').style.display = 'flex';
    showAuthForm('loginForm');
    document.getElementById('adminTabBtn').classList.add('hidden');
}

// ==========================================
// تحميل بيانات المستخدم
// ==========================================
function loadUserData() {
    if (!currentUser) return;
    document.getElementById('userBadge').textContent = '👤 ' + currentUser.username;
    document.getElementById('mainBalance').textContent = (currentUser.balance || 0).toFixed(2);
    document.getElementById('casinoBalance').textContent = (currentUser.casinoBalance || 0).toFixed(2);
    document.getElementById('giftPoints').textContent = currentUser.giftPoints || 0;
    document.getElementById('freeSpinsBadge').textContent = currentUser.freeSpins || 2;
    const isAdmin = ['admin', 'super', 'finance', 'support', 'monitor'].includes(currentUser.role);
    document.getElementById('roleBadge').textContent = isAdmin ? '👑 مشرف' : 'مستخدم';
    document.getElementById('roleBadge').className = isAdmin ? 'role-badge admin' : 'role-badge user';
    if (isAdmin) document.getElementById('adminTabBtn').classList.remove('hidden');
    else document.getElementById('adminTabBtn').classList.add('hidden');
}

// ==========================================
// التبويبات
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tabs button[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (tabId === 'tabAdmin') loadAdminPanel();
    if (tabId === 'tabMarket') loadMarket();
    if (tabId === 'tabChat') loadChat();
    if (tabId === 'tabMining') loadInvestments();
}

document.querySelectorAll('.tabs button').forEach(btn => {
    btn.onclick = function() {
        const tabId = this.dataset.tab;
        if (tabId === 'tabAdmin' && (!currentUser || !['admin','super','finance','support','monitor'].includes(currentUser.role))) {
            openAdminPanel();
            return;
        }
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        if (tabId === 'tabAdmin') loadAdminPanel();
        if (tabId === 'tabMarket') loadMarket();
        if (tabId === 'tabChat') loadChat();
        if (tabId === 'tabMining') loadInvestments();
    };
});

// ==========================================
// دوال مؤقتة (سيتم استبدالها لاحقاً)
// ==========================================
function toggleLanguage() {
    const isAr = document.documentElement.lang === 'ar';
    document.documentElement.lang = isAr ? 'en' : 'ar';
    document.documentElement.dir = isAr ? 'ltr' : 'rtl';
    document.getElementById('langToggle').textContent = isAr ? '🇸🇦 عربي' : '🇬🇧 EN';
}

function rechargeEnergy() { alert('🔄 تم تجديد الطاقة'); }
function startInvestment() { alert('🚀 تم بدء الاستثمار'); }
function transferToCasino() { alert('⬆️ تم التحويل للكازينو'); }
function spinWheel() { alert('🎡 جاري دوران العجلة'); }
function spinWheelFree() { alert('🎟️ جولة مجانية'); }
function rollDice() { alert('🎲 جاري رمي النرد'); }
function startCrash() { alert('🚀 بدء لعبة Crash'); }
function cashoutCrash() { alert('💰 تم السحب'); }
function connectWallet() { alert('🔗 جاري ربط المحفظة'); }
function createToken() { alert('💎 تم إنشاء العملة'); }
function listPoints() { alert('📊 تم عرض النقاط'); }
function sendChat() { alert('💬 تم إرسال الرسالة'); }
function copyAddress() { alert('📋 تم نسخ العنوان'); }
function submitDeposit() { alert('📤 تم إرسال الإثبات'); }
function submitWithdraw() { alert('📥 تم إرسال طلب السحب'); }
function openAdminPanel() { alert('🔐 فتح لوحة الإدارة'); }
function adminSendGift() { alert('🎁 تم إرسال الهدية'); }
function adminModifyBalance() { alert('💾 تم تعديل الرصيد'); }
function saveCasinoSettings() { alert('💾 تم حفظ الإعدادات'); }
function adminToggleBan(ban) { alert(ban ? '🚫 تم التعطيل' : '✅ تم التفعيل'); }
function validateTokenSymbol(input) { 
    const val = input.value.toUpperCase();
    const error = document.getElementById('symbolError');
    if (val.length < 3 || val.length > 5 || !/^[A-Z]+$/.test(val)) {
        error.style.display = 'block';
        input.style.borderColor = '#ff6b6b';
    } else {
        error.style.display = 'none';
        input.style.borderColor = 'rgba(255,255,255,0.08)';
    }
    input.value = val;
}
function handleTokenImage(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('tokenImagePreview').innerHTML = `<img src="${event.target.result}" class="preview-img">`;
        };
        reader.readAsDataURL(file);
    }
}
function handleReceiptImage(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('receiptPreview').innerHTML = `<img src="${event.target.result}" style="max-width:70px;max-height:70px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">`;
        };
        reader.readAsDataURL(file);
    }
}
function loadChat() { document.getElementById('chatMessages').innerHTML = '<div style="text-align:center;color:#636e72;font-size:12px;padding:16px;">لا توجد رسائل</div>'; }
function loadMarket() { document.getElementById('marketListings').innerHTML = '<p style="color:#636e72;font-size:12px;">لا توجد عروض</p>'; }
function loadInvestments() { document.getElementById('investList').innerHTML = '<p style="color:#636e72;font-size:12px;">لا توجد استثمارات</p>'; }
function loadAdminPanel() { document.getElementById('adminUserCount').textContent = '0'; }

function drawWheel(angle) { 
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = 180, ch = 180, cx = 90, cy = 90, r = 80;
    ctx.clearRect(0, 0, cw, ch);
    const segments = [
        { label: '×0', color: '#ff6b6b' }, { label: '×1', color: '#fdcb6e' },
        { label: '×1.5', color: '#74b9ff' }, { label: '×2', color: '#00b894' },
        { label: '×0', color: '#ff6b6b' }, { label: '×3', color: '#0984e3' },
        { label: '×0', color: '#ff6b6b' }, { label: '×5', color: '#ffd700' }
    ];
    const segAngle = (2 * Math.PI) / segments.length;
    segments.forEach((seg, i) => {
        const start = angle + i * segAngle;
        const end = start + segAngle;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
        const mid = start + segAngle/2;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(seg.label, cx + r * 0.65 * Math.cos(mid), cy + r * 0.65 * Math.sin(mid));
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, 2*Math.PI);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
}

// ==========================================
// تشغيل عند التحميل
// ==========================================
window.onload = function() {
    if (loadSavedLogin()) {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appScreen').classList.remove('hidden');
        loadUserData();
        loadChat();
        loadMarket();
        loadInvestments();
        loadAdminPanel();
        drawWheel(0);
    } else {
        document.getElementById('authScreen').style.display = 'flex';
    }
};
