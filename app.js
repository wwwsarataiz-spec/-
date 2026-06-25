// ================================================================
// 1. البيانات الأساسية والمتغيرات
// ================================================================
let currentBalance = 0.000660;
let casinoBalance = 0; // أصبح 0 بدلاً من 5
let users = [];
let pendingUsers = [];
let withdrawals = [];
let adminRevenue = 0;
let miningPlans = [];
let flexMiningPlans = [];
let points = 0;
let exchangeRate = 1.00;
let houseEdge = 5;
let pendingAds = [];
let currentUser = null;
let isLoginMode = true;
let adViews = 0;
let lastFreeMining = 0;
let currentAdmin = null;
let withdrawalBlocked = false; // حالة السحب

// خطط الترقية الافتراضية
let plans = [
  { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
  { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
  { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
];

// ================================================================
// 2. تسجيل الدخول والمصادقة (معدلة لدعم الدخول التلقائي)
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
    // تسجيل الدخول
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
    // تسجيل جديد (مع الدخول التلقائي)
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
        // تسجيل الدخول التلقائي
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

// دالة ما بعد تسجيل الدخول
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
  
  // رسالة الترحيب
  const welcomeEl = document.getElementById('welcomeMessage');
  if (welcomeEl) welcomeEl.textContent = `مرحباً، ${user.fullName}`;
  
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
  // التحقق من حالة السحب
  checkWithdrawalStatus();
}

// ================================================================
// 3. التنقل بين الأقسام (معدل)
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
  if (section === 'admin') {
    if (!currentAdmin) {
      showAdminLoginModal();
      return;
    }
  }

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
  if (section === 'admin') {
    refreshAdminData();
    loadAllAdsForAdmin();
    loadAgentRequests();
    loadAllTransactionsForAdmin();
  }
  if (section === 'ads') loadActiveAds();
  if (section === 'wallet') {
    if (currentUser) loadUserTransactions(currentUser._id);
    checkWithdrawalStatus();
  }
  if (section === 'casino') setTimeout(initCasinoGames, 100);
  if (section === 'market') loadMarketOrders();
}

// ================================================================
// 4. الإعدادات (أيقونة الترس)
// ================================================================
function openSettings() {
  if (!currentUser) {
    alert('⚠️ يرجى تسجيل الدخول أولاً');
    return;
  }
  // عرض نافذة الإعدادات (مودال)
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
      // تغيير اتجاه الصفحة حسب اللغة
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
// 5. التحقق من حالة السحب
// ================================================================
async function checkWithdrawalStatus() {
  try {
    const res = await fetch('/api/admin/withdrawal-status');
    const data = await res.json();
    if (data.success) {
      withdrawalBlocked = data.blocked;
      const statusEl = document.getElementById('withdrawalStatus');
      if (statusEl) {
        statusEl.textContent = withdrawalBlocked ? '⛔ السحب متوقف مؤقتاً' : '✅ السحب متاح';
        statusEl.style.color = withdrawalBlocked ? '#e74c3c' : '#2ecc71';
      }
    }
  } catch (e) {
    console.error('خطأ في التحقق من حالة السحب:', e);
  }
}

// ================================================================
// 6. تحويل الرصيد من المحفظة إلى الكازينو
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
// 7. إدارة المسؤولين
// ================================================================
function showAdminLoginModal() {
  const ip = prompt('🔐 أدخل عنوان IP الخاص بك:');
  if (!ip) return;
  const pin = prompt('🔐 أدخل كلمة مرور الإدارة:');
  if (!pin) return;
  loginAdmin(ip, pin);
}

async function loginAdmin(ip, pin) {
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, pin })
    });
    const data = await response.json();
    if (data.success) {
      currentAdmin = { ip, role: data.role };
      withdrawalBlocked = data.withdrawalBlocked || false;
      alert('✅ تم تسجيل الدخول كمسؤول بنجاح');
      document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
      const adminSection = document.getElementById('section-admin');
      if (adminSection) adminSection.classList.add('active');
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === 'admin') item.classList.add('active');
      });
      refreshAdminData();
      loadAllAdsForAdmin();
      loadAgentRequests();
      loadAllTransactionsForAdmin();
      document.getElementById('adminWithdrawalToggle').checked = withdrawalBlocked;
    } else {
      alert('❌ فشل تسجيل الدخول: ' + data.message);
    }
  } catch (error) {
    console.error('خطأ في تسجيل دخول المسؤول:', error);
    alert('❌ خطأ في الشبكة');
  }
}

// تبديل حالة السحب (من لوحة الإدارة)
async function toggleWithdrawal() {
  if (!currentAdmin) {
    alert('⚠️ يرجى تسجيل الدخول كمسؤول أولاً');
    return;
  }
  const blocked = document.getElementById('adminWithdrawalToggle').checked;
  try {
    const res = await fetch('/api/admin/toggle-withdrawal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked })
    });
    const data = await res.json();
    if (data.success) {
      withdrawalBlocked = blocked;
      alert(`✅ تم ${blocked ? 'إيقاف' : 'تفعيل'} السحب مؤقتاً`);
      checkWithdrawalStatus();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (e) {
    console.error('خطأ في تبديل حالة السحب:', e);
    alert('❌ خطأ في الشبكة');
  }
}

// ================================================================
// 8. طلبات الوكالة (معدلة لمنع الضغط المتكرر)
// ================================================================
async function requestAgent() {
  if (!currentUser) {
    alert('⚠️ يرجى تسجيل الدخول أولاً');
    return;
  }
  if (currentUser.isAgent) {
    alert('⚠️ أنت بالفعل وكيل معتمد');
    return;
  }
  // تعطيل الزر مؤقتاً لمنع الضغط المتكرر
  const btn = document.querySelector('.btn-purple[onclick="requestAgent()"]');
  if (btn) btn.disabled = true;

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
        // عرض نافذة مخصصة للرسالة المطلوبة
        alert('عزيزي المستخدم، نود إفادتك بأن طلب الانضمام الخاص بك كتاجر لا يزال تحت الدراسة. لا يتطلب منك اتخاذ أي إجراء إضافي حالياً.');
      } else {
        alert('❌ ' + data.message);
      }
    }
  } catch (error) {
    console.error('خطأ في طلب الوكالة:', error);
    alert('❌ خطأ في الشبكة');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ================================================================
// 9. باقي الدوال (التعدين، الإعلانات، الألعاب، الإدارة، سوق النقاط، المعاملات)
// ================================================================
// (جميع الدوال السابقة موجودة هنا، لكني سأختصرها لأنها طويلة جداً)
// سأضع دوال رئيسية فقط، والبقية كما هي من الكود السابق.

// دوال التعدين
function claimFreeMining() { /* ... */ }
function updateInvestmentCalc() { /* ... */ }
function purchaseFlexMining() { /* ... */ }
function renderPlans() { /* ... */ }
function purchasePlan(planName) { /* ... */ }
function loadUserPlans(user) { /* ... */ }
function renderAdminPlans() { /* ... */ }
function showAddPlanForm() { /* ... */ }
function addPlan() { /* ... */ }
function removePlan(index) { /* ... */ }

// دوال الإعلانات
function updateAdCost() { /* ... */ }
async function submitAd() { /* ... */ }
async function watchAd(adId) { /* ... */ }
async function loadActiveAds() { /* ... */ }
async function loadAllAdsForAdmin() { /* ... */ }
async function approveAdAdmin(adId) { /* ... */ }
async function rejectAdAdmin(adId) { /* ... */ }
async function deleteAd(adId) { /* ... */ }

// دوال الألعاب
function initCasinoGames() { /* ... */ }
function playGuess() { /* ... */ }
function startCrash() { /* ... */ }
function cashoutCrash() { /* ... */ }
function rollDice() { /* ... */ }

// دوال الإدارة العامة
function refreshAdminData() { /* ... */ }
function approveUser(userId) { /* ... */ }
function rejectUser(userId) { /* ... */ }
function updateHouseEdge() { /* ... */ }
function emergencyStop() { /* ... */ }
function resetCasino() { /* ... */ }
function sendReward() { /* ... */ }

// دوال سوق النقاط
async function setAgentPrices(sellPrice, buyPrice) { /* ... */ }
async function loadMarketOrders() { /* ... */ }
function openMarketOrder(type, agentId) { /* ... */ }
async function createMarketOrder(type, agentId, points) { /* ... */ }
async function confirmMarketOrder(orderId) { /* ... */ }
async function loadAgentPendingOrders() { /* ... */ }

// دوال سجل المعاملات
async function loadUserTransactions(userId) { /* ... */ }
async function loadAllTransactionsForAdmin() { /* ... */ }
async function createTransaction(userId, type, amount, status, description) { /* ... */ }

// دوال المحفظة
function copyAddress() { /* ... */ }
async function submitWithdraw() {
  // التحقق من حالة السحب
  if (withdrawalBlocked) {
    alert('⛔ السحب متوقف مؤقتاً من قبل الإدارة');
    return;
  }
  // باقي الكود...
}
function sellPoints() { /* ... */ }

// دوال شريط التحذير
function initTicker() { /* ... */ }

// ================================================================
// 10. تهيئة التطبيق عند تحميل الصفحة
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
      }
    } catch(e) {
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
};

// ================================================================
// 11. محاكاة تحديث خطط التعدين اليومية
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
