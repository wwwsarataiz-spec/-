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
        
        // تحديث الرصيد
        document.getElementById('liveBalance').innerHTML = data.user.balance.toFixed(6) + ' <small>USDT</small>';
        currentBalance = data.user.balance;
        casinoBalance = data.user.casinoBalance || 5.000000;
        document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
        points = data.user.points || 0;
        document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
        
        // إظهار الواجهة الرئيسية
        if (typeof navigateTo === 'function') {
          navigateTo('dashboard');
        } else {
          // في حال لم تكن navigateTo معرّفة بعد
          document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
          const dashboard = document.getElementById('section-dashboard');
          if (dashboard) dashboard.classList.add('active');
        }

        if (typeof loadUserPlans === 'function') loadUserPlans(data.user);
        // إضافة المستخدم إلى قائمة users المحلية
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
        // إضافة المستخدم إلى قائمة pendingUsers
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
// 3. التنقل بين الأقسام
// ================================================================
function navigateTo(section) {
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('section-' + section);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.section === section) item.classList.add('active');
  });
  if (section === 'casino') {
    setTimeout(() => { if (typeof initThreeJS === 'function') initThreeJS(); }, 200);
  }
  if (section === 'admin') {
    if (typeof refreshAdminData === 'function') refreshAdminData();
  }
}

// ================================================================
// 4. التعدين التلقائي
// ================================================================
setInterval(() => {
  currentBalance += 0.000015;
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  if (currentUser) {
    currentUser.balance = currentBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
}, 1000);

// ================================================================
// 5. المحفظة والتبادل (نفسها)
// ================================================================
function copyAddress() {
  const a = document.getElementById('walletAddress');
  a.select();
  document.execCommand('copy');
  alert('✅ تم نسخ العنوان');
}

function submitWithdraw() {
  const address = document.getElementById('withdrawAddress').value.trim();
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  if (!address || address.length < 10) { alert('⚠️ عنوان صحيح'); return; }
  if (!amount || amount < 10) { alert('⚠️ الحد الأدنى 10 USDT'); return; }
  if (currentBalance < amount) { alert('⚠️ رصيد غير كاف'); return; }
  currentBalance = Math.max(0, currentBalance - amount);
  withdrawals.push({ user: currentUser ? currentUser.fullName : 'Guest', amount, address, status: 'pending' });
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  alert(`✅ تم تقديم طلب سحب ${amount.toFixed(2)} USDT إلى ${address}`);
  document.getElementById('withdrawAddress').value = '';
  document.getElementById('withdrawAmount').value = '';
  if (typeof refreshAdminData === 'function') refreshAdminData();
}

function sellPoints() {
  const pts = parseFloat(document.getElementById('pointsToSell').value);
  if (!pts || pts <= 0) { alert('⚠️ أدخل عدد النقاط'); return; }
  if (pts > points) { alert('⚠️ نقاط غير كافية'); return; }
  const usdt = pts / 1000 * exchangeRate;
  points -= pts;
  currentBalance += usdt;
  document.getElementById('pointsBalanceDisplay').textContent = `نقاطك: ${points}`;
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  alert(`✅ تم بيع ${pts} نقطة مقابل ${usdt.toFixed(4)} USDT`);
  document.getElementById('pointsToSell').value = '';
  if (currentUser) {
    currentUser.points = points;
    currentUser.balance = currentBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
}

// ================================================================
// 6. الإدارة الأساسية (نفسها)
// ================================================================
function refreshAdminData() {
  document.getElementById('adminTotalUsers').textContent = users.filter(u => u.approved !== false).length;
  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0) + currentBalance;
  document.getElementById('adminTotalBalance').textContent = totalBalance.toFixed(2);
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  document.getElementById('adminTotalWithdrawals').textContent = totalWithdrawals.toFixed(2);
  document.getElementById('adminTotalRevenue').textContent = adminRevenue.toFixed(2);

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

  const adList = document.getElementById('pendingAdsList');
  if (pendingAds.length === 0) {
    adList.innerHTML = '<p style="color:#8a7fa0; font-size:clamp(12px,2.5vw,14px);">لا توجد إعلانات معلقة</p>';
  } else {
    adList.innerHTML = pendingAds.map(ad => `
      <div class="pending-user">
        <span><i class="fas fa-ad"></i> ${ad.title}</span>
        <div class="actions">
          <button onclick="approveAd('${ad.userId}')"><i class="fas fa-check"></i></button>
          <button class="reject" onclick="rejectAd('${ad.userId}')"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `).join('');
  }

  const revenueLog = document.getElementById('revenueLog');
  revenueLog.innerHTML = `
    <p><i class="fas fa-coins"></i> إجمالي أرباح الإدارة: ${adminRevenue.toFixed(2)} USDT</p>
    <p style="font-size:clamp(10px,2vw,12px); color:#6a5f7a;">آخر تحديث: ${new Date().toLocaleString()}</p>
  `;
  if (typeof renderAdminPlans === 'function') renderAdminPlans();
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

function approveAd(userId) {
  const ad = pendingAds.find(a => a.userId === userId);
  if (ad) {
    ad.status = 'approved';
    pendingAds = pendingAds.filter(a => a.userId !== userId);
    alert(`✅ تم قبول الإعلان: ${ad.title}`);
    refreshAdminData();
  }
}

function rejectAd(userId) {
  const ad = pendingAds.find(a => a.userId === userId);
  if (ad) {
    pendingAds = pendingAds.filter(a => a.userId !== userId);
    alert(`❌ تم رفض الإعلان: ${ad.title}`);
    refreshAdminData();
  }
}

// ================================================================
// 7. التحكم بالكازينو (نفسها)
// ================================================================
function updateHouseEdge() {
  const val = parseFloat(document.getElementById('houseEdgeInput').value);
  if (isNaN(val) || val < 0 || val > 20) {
    alert('⚠️ أدخل نسبة بين 0 و 20');
    return;
  }
  houseEdge = val;
  alert(`✅ تم تحديث نسبة الربح إلى ${houseEdge}%`);
}

function emergencyStop() {
  if (!confirm('⚠️ تحذير: سيتم إيقاف جميع الألعاب فوراً. هل أنت متأكد؟')) return;
  alert('🛑 تم إيقاف الطوارئ. جميع الألعاب متوقفة مؤقتاً.');
}

function resetCasino() {
  if (!confirm('⚠️ سيتم إعادة تعيين جميع إعدادات الكازينو. هل تتابع؟')) return;
  houseEdge = 5;
  document.getElementById('houseEdgeInput').value = 5;
  alert('✅ تم إعادة تعيين الكازينو');
}

// ================================================================
// 8. إرسال النقاط (نفسها)
// ================================================================
function sendReward() {
  const email = document.getElementById('rewardUserEmail').value.trim();
  const pts = parseFloat(document.getElementById('rewardPoints').value);
  if (!email || !pts || pts <= 0) {
    document.getElementById('rewardStatus').textContent = '⚠️ أدخل بريداً إلكترونياً وعدد نقاط صحيح';
    document.getElementById('rewardStatus').style.color = '#e74c3c';
    return;
  }
  const user = users.find(u => u.email === email);
  if (!user) {
    document.getElementById('rewardStatus').textContent = '❌ المستخدم غير موجود';
    document.getElementById('rewardStatus').style.color = '#e74c3c';
    return;
  }
  user.points = (user.points || 0) + pts;
  document.getElementById('rewardStatus').textContent = `✅ تم إرسال ${pts} نقطة إلى ${user.fullName}`;
  document.getElementById('rewardStatus').style.color = '#2ecc71';
  document.getElementById('rewardUserEmail').value = '';
  document.getElementById('rewardPoints').value = '';
  refreshAdminData();
}

// ================================================================
// 9. شريط التحذير (نفسه)
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
    const msg = messages[idx % messages.length];
    ticker.innerHTML = `<span>🔄</span> ${msg} <span>💰</span> ` + ticker.innerHTML;
    idx++;
  }, 5000);
}
