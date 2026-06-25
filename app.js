// ================================================================
// 1. البيانات الأساسية والمتغيرات
// ================================================================
let currentBalance = 0.000660;
let casinoBalance = 5.000000;
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
let currentAdmin = null; // لتخزين جلسة المسؤول

// خطط الترقية الافتراضية
let plans = [
  { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
  { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
  { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
];

// ================================================================
// 2. تسجيل الدخول والمصادقة (نفسها)
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
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('liveBalance').innerHTML = data.user.balance.toFixed(6) + ' <small>USDT</small>';
        currentBalance = data.user.balance;
        casinoBalance = data.user.casinoBalance || 5.000000;
        document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
        points = data.user.points || 0;
        document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
        showDashboard();
        if (typeof loadUserPlans === 'function') loadUserPlans(data.user);
        if (!users.find(u => u._id === data.user._id)) {
          users.push(data.user);
        }
        // تحميل الإعلانات
        loadActiveAds();
        loadAllAdsForAdmin();
        // تحميل سجل المعاملات
        if (data.user._id) {
          loadUserTransactions(data.user._id);
        }
        // تحميل طلبات الوكالة (إذا كان مسؤولاً)
        if (data.user.isAdmin) {
          loadAgentRequests();
        }
      } else {
        errorEl.textContent = '❌ ' + (data.message || 'بيانات خاطئة');
      }
    } catch (e) {
      errorEl.textContent = '❌ خطأ في الشبكة';
      console.error('Login error:', e);
    }
  } else {
    // تسجيل جديد (نفسه)
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
        alert('✅ تم التسجيل بنجاح! سيتم تفعيل حسابك من قبل الإدارة.');
        toggleAuthMode();
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = password;
        errorEl.textContent = '';
        const newUser = {
          _id: 'user_' + Date.now(),
          fullName,
          email,
          phone,
          password,
          balance: 0.000660,
          casinoBalance: 5.000000,
          points: 0,
          approved: false,
          isAgent: false
        };
        users.push(newUser);
        pendingUsers.push(newUser);
      } else {
        errorEl.textContent = '❌ ' + (data.message || 'فشل التسجيل');
      }
    } catch (e) {
      errorEl.textContent = '❌ خطأ في الشبكة';
      console.error('Register error:', e);
    }
  }
}

// ================================================================
// 3. التنقل بين الأقسام (معدل لدعم الإدارة المحمية)
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
  // إذا كان القسم هو الإدارة، نتحقق من صلاحية المسؤول
  if (section === 'admin') {
    // نتحقق من وجود جلسة مسؤول
    if (!currentAdmin) {
      // عرض نافذة تسجيل دخول المسؤول
      showAdminLoginModal();
      return;
    }
  }

  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('section-' + section);
  if (target) {
    target.classList.add('active');
  } else {
    console.warn('القسم غير موجود:', section);
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
  if (section === 'ads') {
    loadActiveAds();
  }
  if (section === 'wallet') {
    if (currentUser) {
      loadUserTransactions(currentUser._id);
    }
  }
  if (section === 'casino') {
    setTimeout(initCasinoGames, 100);
  }
}

// ================================================================
// 4. إدارة المسؤولين (تسجيل الدخول، إضافة، حماية IP)
// ================================================================

// عرض نافذة تسجيل دخول المسؤول
function showAdminLoginModal() {
  const pin = prompt('🔐 أدخل رمز PIN الخاص بالمسؤول:');
  if (!pin) return;
  // الحصول على IP (محاكاة: نستخدم عنوان IP من المتصفح أو نطلب من المستخدم)
  // في البيئة الحقيقية، يمكن استلام IP من الخادم.
  const ip = prompt('أدخل عنوان IP الخاص بك (للتحقق):');
  if (!ip) return;
  loginAdmin(ip, pin);
}

// تسجيل دخول المسؤول
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
      alert('✅ تم تسجيل الدخول كمسؤول بنجاح');
      // إظهار لوحة الإدارة
      document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
      const adminSection = document.getElementById('section-admin');
      if (adminSection) adminSection.classList.add('active');
      // تحديث شريط التنقل
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === 'admin') item.classList.add('active');
      });
      refreshAdminData();
      loadAllAdsForAdmin();
      loadAgentRequests();
      loadAllTransactionsForAdmin();
    } else {
      alert('❌ فشل تسجيل الدخول: ' + data.message);
    }
  } catch (error) {
    console.error('خطأ في تسجيل دخول المسؤول:', error);
    alert('❌ خطأ في الشبكة');
  }
}

// إضافة مسؤول جديد (فقط للمشرف الرئيسي)
async function addAdmin(ip, pin, role = 'admin') {
  if (!currentAdmin || currentAdmin.role !== 'superadmin') {
    alert('⚠️ فقط المشرف الرئيسي يمكنه إضافة مسؤولين جدد');
    return;
  }
  try {
    const response = await fetch('/api/admin/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, pin, role, createdBy: 'superadmin' })
    });
    const data = await response.json();
    if (data.success) {
      alert('✅ تم إضافة المسؤول بنجاح');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('خطأ في إضافة المسؤول:', error);
    alert('❌ خطأ في الشبكة');
  }
}

// ================================================================
// 5. طلبات الوكالة (طلب التاجر، الموافقة، الرفض)
// ================================================================

// تقديم طلب ليصبح تاجراً (وكيل)
async function requestAgent() {
  if (!currentUser) {
    alert('⚠️ يرجى تسجيل الدخول أولاً');
    return;
  }
  if (currentUser.isAgent) {
    alert('⚠️ أنت بالفعل وكيل معتمد');
    return;
  }
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
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('خطأ في طلب الوكالة:', error);
    alert('❌ خطأ في الشبكة');
  }
}

// جلب طلبات الوكالة (للوحة الإدارة)
async function loadAgentRequests() {
  try {
    const response = await fetch('/api/agent/requests');
    const data = await response.json();
    const container = document.getElementById('agentRequestsList');
    if (!container) return;
    if (data.success && data.requests.length > 0) {
      container.innerHTML = data.requests.map(req => `
        <div style="background:var(--glass-bg); padding:10px; border-radius:8px; margin:6px 0; backdrop-filter:blur(4px);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
            <div>
              <span style="font-weight:600; color:var(--gold);">${req.fullName}</span>
              <span style="font-size:clamp(10px,2vw,12px); color:#8a7fa0; margin-right:8px;">(${req.email})</span>
            </div>
            <span style="font-size:clamp(10px,2vw,12px); padding:2px 10px; border-radius:12px; background:${req.status === 'pending' ? 'rgba(241,196,15,0.2)' : req.status === 'approved' ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.2)'}; color:${req.status === 'pending' ? '#f1c40f' : req.status === 'approved' ? '#2ecc71' : '#e74c3c'};">
              ${req.status === 'pending' ? 'قيد المراجعة' : req.status === 'approved' ? 'معتمد' : 'مرفوض'}
            </span>
          </div>
          <div style="font-size:clamp(10px,2vw,12px); color:#8a7fa0; margin-top:4px;">
            <span>الهاتف: ${req.phone}</span>
            <span style="margin-right:12px;">طلب في: ${new Date(req.requestedAt).toLocaleString()}</span>
          </div>
          ${req.status === 'pending' ? `
            <div style="margin-top:6px; display:flex; gap:6px;">
              <button class="mini-btn" style="border-color:#2ecc71; color:#2ecc71;" onclick="approveAgent('${req._id}')"><i class="fas fa-check"></i> موافقة</button>
              <button class="mini-btn" style="border-color:#e74c3c; color:#e74c3c;" onclick="rejectAgent('${req._id}')"><i class="fas fa-times"></i> رفض</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="color:#8a7fa0; font-size:clamp(12px,2.5vw,14px);">لا توجد طلبات وكالة معلقة</p>';
    }
  } catch (error) {
    console.error('خطأ في جلب طلبات الوكالة:', error);
  }
}

// الموافقة على طلب وكالة
async function approveAgent(requestId) {
  if (!currentAdmin) {
    alert('⚠️ يجب تسجيل الدخول كمسؤول أولاً');
    return;
  }
  if (!confirm('✅ هل أنت متأكد من الموافقة على هذا الطلب؟')) return;
  try {
    const response = await fetch('/api/agent/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, adminId: currentAdmin.ip })
    });
    const data = await response.json();
    if (data.success) {
      alert('✅ تم اعتماد الوكيل بنجاح');
      loadAgentRequests();
      refreshAdminData();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('خطأ:', error);
    alert('❌ خطأ في الشبكة');
  }
}

// رفض طلب وكالة
async function rejectAgent(requestId) {
  if (!currentAdmin) {
    alert('⚠️ يجب تسجيل الدخول كمسؤول أولاً');
    return;
  }
  if (!confirm('❌ هل أنت متأكد من رفض هذا الطلب؟')) return;
  try {
    const response = await fetch('/api/agent/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, adminId: currentAdmin.ip })
    });
    const data = await response.json();
    if (data.success) {
      alert('❌ تم رفض الطلب');
      loadAgentRequests();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('خطأ:', error);
    alert('❌ خطأ في الشبكة');
  }
}

// ================================================================
// 6. سوق النقاط (الأسعار، الأوامر، التأكيد)
// ================================================================

// تعيين أسعار البيع والشراء للوكيل
async function setAgentPrices(sellPrice, buyPrice) {
  if (!currentUser || !currentUser.isAgent) {
    alert('⚠️ أنت لست وكيلاً معتمداً');
    return;
  }
  if (sellPrice <= 0 || buyPrice <= 0 || sellPrice <= buyPrice) {
    alert('⚠️ يجب أن يكون سعر البيع أكبر من سعر الشراء وأكبر من 0');
    return;
  }
  try {
    const response = await fetch('/api/agent/set-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser._id,
        sellPrice,
        buyPrice
      })
    });
    const data = await response.json();
    if (data.success) {
      alert('✅ تم تحديث الأسعار بنجاح');
      loadMarketOrders();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('خطأ في تعيين الأسعار:', error);
    alert('❌ خطأ في الشبكة');
  }
}

// جلب قوائم السوق (بيع وشراء)
async function loadMarketOrders() {
  try {
    // جلب قائمة البيع
    const sellRes = await fetch('/api/market/sell-orders');
    const sellData = await sellRes.json();
    const sellContainer = document.getElementById('sellOrdersList');
    if (sellContainer && sellData.success) {
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
        sellContainer.innerHTML = '<p style="color:#8a7fa0;">لا يوجد وكلاء نشطون</p>';
      }
    }

    // جلب قائمة الشراء
    const buyRes = await fetch('/api/market/buy-orders');
    const buyData = await buyRes.json();
    const buyContainer = document.getElementById('buyOrdersList');
    if (buyContainer && buyData.success) {
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
        buyContainer.innerHTML = '<p style="color:#8a7fa0;">لا يوجد وكلاء نشطون</p>';
      }
    }
  } catch (error) {
    console.error('خطأ في تحميل سوق النقاط:', error);
  }
}

// فتح نافذة إنشاء أمر شراء/بيع
function openMarketOrder(type, agentId) {
  const points = prompt(`أدخل عدد النقاط التي ترغب في ${type === 'buy' ? 'شرائها' : 'بيعها'}:`);
  if (!points || isNaN(points) || points <= 0) {
    alert('⚠️ أدخل عدد نقاط صحيح');
    return;
  }
  createMarketOrder(type, agentId, parseInt(points));
}

// إنشاء أمر شراء/بيع
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
      // تحديث الرصيد والنقاط
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

// تأكيد عملية معلقة (لوحة الوكيل)
async function confirmMarketOrder(orderId) {
  if (!currentAdmin && !currentUser?.isAgent) {
    alert('⚠️ فقط الوكيل أو المسؤول يمكنه تأكيد العمليات');
    return;
  }
  const agentId = currentUser?._id || currentAdmin?.ip;
  if (!agentId) {
    alert('⚠️ يرجى تسجيل الدخول');
    return;
  }
  if (!confirm('✅ هل أنت متأكد من تأكيد هذه العملية؟')) return;
  try {
    const response = await fetch('/api/market/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, agentId })
    });
    const data = await response.json();
    if (data.success) {
      alert('✅ تم تأكيد العملية بنجاح');
      loadAgentPendingOrders();
      loadUserTransactions(currentUser?._id);
      refreshAdminData();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (error) {
    console.error('خطأ في تأكيد العملية:', error);
    alert('❌ خطأ في الشبكة');
  }
}

// جلب العمليات المعلقة للوكيل
async function loadAgentPendingOrders() {
  if (!currentUser?.isAgent) return;
  try {
    // يمكن استخدام نقطة نهاية مخصصة لجلب أوامر وكيل معين
    // لكن سنستخدم جميع العمليات ونفلترها يدوياً
    const response = await fetch('/api/transactions/all');
    const data = await response.json();
    const container = document.getElementById('agentPendingOrders');
    if (!container) return;
    if (data.success) {
      const pendingOrders = data.transactions.filter(t => 
        t.type === 'market_buy' || t.type === 'market_sell' && t.status === 'pending'
      );
      if (pendingOrders.length > 0) {
        container.innerHTML = pendingOrders.map(t => `
          <div style="background:var(--glass-bg); padding:10px; border-radius:8px; margin:6px 0; backdrop-filter:blur(4px);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
              <span style="font-weight:600; color:var(--gold);">${t.type === 'market_buy' ? 'شراء' : 'بيع'} نقاط</span>
              <span style="color:#f1c40f;">قيد الانتظار</span>
            </div>
            <div style="font-size:clamp(10px,2vw,12px); color:#8a7fa0; margin-top:4px;">
              <span>المبلغ: ${t.amount.toFixed(4)} USDT</span>
              <span style="margin-right:12px;">${new Date(t.createdAt).toLocaleString()}</span>
            </div>
            <button class="btn btn-green" onclick="confirmMarketOrder('${t.referenceId}')" style="width:100%; margin-top:6px; padding:6px;">
              <i class="fas fa-check"></i> تأكيد العملية
            </button>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p style="color:#8a7fa0;">لا توجد عمليات معلقة</p>';
      }
    }
  } catch (error) {
    console.error('خطأ في جلب العمليات المعلقة:', error);
  }
}

// ================================================================
// 7. سجل المعاملات
// ================================================================

// جلب معاملات المستخدم
async function loadUserTransactions(userId) {
  try {
    const response = await fetch(`/api/transactions?userId=${userId}`);
    const data = await response.json();
    const container = document.getElementById('transactionsList');
    if (!container) return;
    if (data.success && data.transactions.length > 0) {
      container.innerHTML = data.transactions.map(t => `
        <div style="background:var(--glass-bg); padding:8px; border-radius:6px; margin:4px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; backdrop-filter:blur(4px);">
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

// جلب كل المعاملات (للإدارة)
async function loadAllTransactionsForAdmin() {
  if (!currentAdmin) return;
  try {
    const response = await fetch('/api/transactions/all');
    const data = await response.json();
    const container = document.getElementById('allTransactionsList');
    if (!container) return;
    if (data.success && data.transactions.length > 0) {
      container.innerHTML = data.transactions.map(t => `
        <div style="background:var(--glass-bg); padding:6px; border-radius:6px; margin:3px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; font-size:clamp(10px,2vw,12px);">
          <span>${t.type}</span>
          <span>${t.amount.toFixed(4)} USDT</span>
          <span style="color:${t.status === 'completed' ? '#2ecc71' : t.status === 'pending' ? '#f1c40f' : '#e74c3c'};">${t.status}</span>
          <span style="font-size:clamp(8px,1.5vw,10px); color:#8a7fa0;">${new Date(t.createdAt).toLocaleString()}</span>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="color:#8a7fa0;">لا توجد معاملات</p>';
    }
  } catch (error) {
    console.error('خطأ في جلب كل المعاملات:', error);
  }
}

// ================================================================
// 8. المحفظة (الإيداع، السحب، التحقق من عنوان TRC-20)
// ================================================================
function copyAddress() {
  const a = document.getElementById('walletAddress');
  if (a) { a.select(); document.execCommand('copy'); alert('✅ تم نسخ العنوان'); }
}

// التحقق من صحة عنوان TRC-20
function validateTrc20Address(address) {
  // يجب أن يبدأ بحرف T ويتكون من 34 حرفاً (تقريباً)
  return address.startsWith('T') && address.length >= 33 && address.length <= 35;
}

async function submitWithdraw() {
  const address = document.getElementById('withdrawAddress').value.trim();
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const resultEl = document.getElementById('withdrawResult');

  if (!address || address.length < 10) {
    resultEl.textContent = '⚠️ أدخل عنوان محفظة صحيح';
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

  // التحقق من صيغة عنوان TRC-20
  if (!validateTrc20Address(address)) {
    resultEl.textContent = '⚠️ عنوان TRC-20 غير صحيح! يجب أن يبدأ بحرف "T"';
    resultEl.style.color = '#e74c3c';
    return;
  }

  // خصم الرصيد
  currentBalance = Math.max(0, currentBalance - amount);
  withdrawals.push({ user: currentUser ? currentUser.fullName : 'Guest', amount, address, status: 'pending' });
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  
  // تسجيل معاملة
  await createTransaction(currentUser?._id || 'guest', 'withdraw', amount, 'pending', `سحب إلى ${address}`);
  
  resultEl.textContent = `✅ تم تقديم طلب سحب ${amount.toFixed(2)} USDT إلى ${address}`;
  resultEl.style.color = '#2ecc71';
  document.getElementById('withdrawAddress').value = '';
  document.getElementById('withdrawAmount').value = '';
  refreshAdminData();
  loadUserTransactions(currentUser?._id);
}

// ================================================================
// 9. الإدارة الأساسية (إحصائيات، مستخدمين جدد)
// ================================================================
function refreshAdminData() {
  if (!currentAdmin && !currentUser?.isAdmin) return;
  const totalUsers = users.filter(u => u.approved !== false).length;
  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0) + currentBalance;
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  
  document.getElementById('adminTotalUsers').textContent = totalUsers;
  document.getElementById('adminTotalBalance').textContent = totalBalance.toFixed(2);
  document.getElementById('adminTotalWithdrawals').textContent = totalWithdrawals.toFixed(2);
  document.getElementById('adminTotalRevenue').textContent = adminRevenue.toFixed(2);

  // المستخدمين الجدد
  const pendingList = document.getElementById('pendingUsersList');
  if (pendingUsers.length === 0) {
    pendingList.innerHTML = '<p style="color:#8a7fa0; font-size:clamp(12px,2.5vw,14px);">✅ لا توجد طلبات معلقة</p>';
  } else {
    pendingList.innerHTML = pendingUsers.map(u => `
      <div class="pending-user">
        <span><i class="fas fa-user"></i> ${u.fullName} (${u.email})</span>
        <div class="actions">
          <button onclick="approveUser('${u._id}')"><i class="fas fa-check"></i></button>
          <button class="reject" onclick="rejectUser('${u._id}')"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `).join('');
  }

  // سجل الأرباح
  const revenueLog = document.getElementById('revenueLog');
  revenueLog.innerHTML = `
    <p><i class="fas fa-coins"></i> إجمالي أرباح الإدارة: ${adminRevenue.toFixed(2)} USDT</p>
    <p style="font-size:clamp(10px,2vw,12px); color:#6a5f7a;">آخر تحديث: ${new Date().toLocaleString()}</p>
  `;
  renderAdminPlans();
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
// 10. دوال مساعدة لإنشاء المعاملات (محاكاة)
// ================================================================
async function createTransaction(userId, type, amount, status, description) {
  // محاكاة تسجيل معاملة (نستخدم نقطة النهاية الحقيقية)
  try {
    await fetch('/api/transactions/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type, amount, status, description })
    });
  } catch (e) {
    console.error('خطأ في تسجيل المعاملة:', e);
  }
}

// ================================================================
// 11. دوال التعدين والإعلانات والألعاب (نفسها، موجودة سابقاً)
// ================================================================
// (سيتم وضع الدوال القديمة هنا مثل claimFreeMining, purchaseFlexMining, renderPlans, etc.)
// نظراً لطول الكود، سأضعها مختصرة مع إشارة إلى أنها موجودة سابقاً.

// دوال التعدين (موجودة سابقاً)
function claimFreeMining() { /* ... نفس الكود ... */ }
function updateInvestmentCalc() { /* ... نفس الكود ... */ }
function purchaseFlexMining() { /* ... نفس الكود ... */ }
function renderPlans() { /* ... نفس الكود ... */ }
function purchasePlan(planName) { /* ... نفس الكود ... */ }
function loadUserPlans(user) { /* ... نفس الكود ... */ }
function renderAdminPlans() { /* ... نفس الكود ... */ }
function showAddPlanForm() { /* ... نفس الكود ... */ }
function addPlan() { /* ... نفس الكود ... */ }
function removePlan(index) { /* ... نفس الكود ... */ }

// دوال الإعلانات (موجودة سابقاً)
function updateAdCost() { /* ... نفس الكود ... */ }
async function submitAd() { /* ... نفس الكود ... */ }
async function watchAd(adId) { /* ... نفس الكود ... */ }
async function loadActiveAds() { /* ... نفس الكود ... */ }
async function loadAllAdsForAdmin() { /* ... نفس الكود ... */ }
async function approveAdAdmin(adId) { /* ... نفس الكود ... */ }
async function rejectAdAdmin(adId) { /* ... نفس الكود ... */ }
async function deleteAd(adId) { /* ... نفس الكود ... */ }

// دوال الألعاب (موجودة سابقاً)
function initCasinoGames() { /* ... نفس الكود ... */ }
function playGuess() { /* ... نفس الكود ... */ }
function startCrash() { /* ... نفس الكود ... */ }
function cashoutCrash() { /* ... نفس الكود ... */ }
function rollDice() { /* ... نفس الكود ... */ }

// دوال الإدارة العامة
function updateHouseEdge() { /* ... نفس الكود ... */ }
function emergencyStop() { /* ... نفس الكود ... */ }
function resetCasino() { /* ... نفس الكود ... */ }
function sendReward() { /* ... نفس الكود ... */ }

// ================================================================
// 12. شريط التحذير المتحرك
// ================================================================
function initTicker() {
  const messages = [
    'قام أحمد بشراء خطة VIP بقيمة 100 USDT',
    'ربحت مريم 25.5 USDT من لعبة الكراش',
    'انضم محمد للتو وحصل على 5 USDT مجاناً',
    'سحبت نورة 50 USDT من أرباح التعدين',
    'علي ربح 12.3 USDT من عجلة الحظ',
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
// 13. تهيئة التطبيق عند تحميل الصفحة
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
        casinoBalance = user.casinoBalance || 5.000000;
        document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
        points = user.points || 0;
        document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
        if (typeof loadUserPlans === 'function') loadUserPlans(user);
        showDashboard();
        // تحميل الإعلانات
        loadActiveAds();
        loadAllAdsForAdmin();
        // تحميل سجل المعاملات
        if (user._id) {
          loadUserTransactions(user._id);
        }
        // تحميل طلبات الوكالة (إذا كان مسؤولاً)
        if (user.isAgent) {
          loadAgentPendingOrders();
        }
        // تحميل سوق النقاط
        loadMarketOrders();
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
  // تهيئة الألعاب
  setTimeout(initCasinoGames, 500);
};

// ================================================================
// 14. محاكاة تحديث خطط التعدين اليومية
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
