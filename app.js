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

// ================================================================
// 2. تسجيل الدخول (مع الاتصال بالخادم)
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
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('liveBalance').innerHTML = data.user.balance.toFixed(6) + ' <small>USDT</small>';
        currentBalance = data.user.balance;
        casinoBalance = data.user.casinoBalance || 5.000000;
        document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
        points = data.user.points || 0;
        document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
        if (typeof loadUserPlans === 'function') loadUserPlans(data.user);
        // إضافة المستخدم إلى قائمة users المحلية (للاستخدام الداخلي)
        if (!users.find(u => u._id === data.user._id)) {
          users.push(data.user);
        }
      } else {
        errorEl.textContent = '❌ ' + (data.message || 'بيانات خاطئة');
      }
    } catch (e) {
      errorEl.textContent = '❌ خطأ في الشبكة';
    }
  } else {
    // تسجيل جديد
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
        // إضافة المستخدم إلى قائمة pendingUsers للموافقة عليه
        const newUser = {
          _id: 'user_' + Date.now(),
          fullName,
          email,
          phone,
          password,
          balance: 0.000660,
          casinoBalance: 5.000000,
          points: 0,
          approved: false
        };
        users.push(newUser);
        pendingUsers.push(newUser);
      } else {
        errorEl.textContent = '❌ ' + (data.message || 'فشل التسجيل');
      }
    } catch (e) {
      errorEl.textContent = '❌ خطأ في الشبكة';
    }
  }
}

// ================================================================
// باقي الكود (نفسه) - التنقل، المحفظة، الإدارة، إلخ.
// ================================================================
// ... (جميع الدوال الأخرى موجودة في الملف)
