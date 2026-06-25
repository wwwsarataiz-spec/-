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

// خطط الترقية الافتراضية
let plans = [
  { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
  { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
  { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
];

// ================================================================
// 2. تسجيل الدخول والمصادقة
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
        showDashboard();

        if (typeof loadUserPlans === 'function') loadUserPlans(data.user);
        if (!users.find(u => u._id === data.user._id)) {
          users.push(data.user);
        }
      } else {
        errorEl.textContent = '❌ ' + (data.message || 'بيانات خاطئة');
      }
    } catch (e) {
      errorEl.textContent = '❌ خطأ في الشبكة';
      console.error('Login error:', e);
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
      console.error('Register error:', e);
    }
  }
}

// ================================================================
// 3. التنقل بين الأقسام
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
  }
}

// ================================================================
// 4. التعدين التلقائي (زيادة الرصيد كل ثانية)
// ================================================================
setInterval(() => {
  currentBalance += 0.000015;
  const balanceEl = document.getElementById('liveBalance');
  if (balanceEl) balanceEl.innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  if (currentUser) {
    currentUser.balance = currentBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
}, 1000);

// ================================================================
// 5. التعدين المجاني
// ================================================================
function claimFreeMining() {
  const now = Date.now();
  if (now - lastFreeMining < 86400000) {
    const remaining = Math.ceil((86400000 - (now - lastFreeMining)) / 3600000);
    document.getElementById('freeMiningStatus').textContent = `⏳ انتظر ${remaining} ساعة`;
    return;
  }
  const reward = 0.005;
  currentBalance += reward;
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  lastFreeMining = now;
  document.getElementById('freeMiningStatus').textContent = `✅ تم إضافة ${reward.toFixed(4)} USDT`;
  document.getElementById('freeMiningCounter').textContent = `${reward.toFixed(4)} USDT`;
  if (currentUser) {
    currentUser.balance = currentBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
  setTimeout(() => {
    document.getElementById('freeMiningStatus').textContent = '';
  }, 5000);
}

// ================================================================
// 6. التعدين المدفوع المرن
// ================================================================
function updateInvestmentCalc() {
  const slider = document.getElementById('investSlider');
  if (!slider) return;
  const val = parseFloat(slider.value);
  document.getElementById('investAmountDisplay').textContent = val.toFixed(2);
  let dailyRate = 0.03;
  if (val > 30) dailyRate = 0.04;
  const daily = val * dailyRate;
  const total = daily * 50;
  document.getElementById('dailyProfitDisplay').textContent = daily.toFixed(2) + ' USDT';
  document.getElementById('totalProfitDisplay').textContent = total.toFixed(2) + ' USDT';
}

function purchaseFlexMining() {
  if (!currentUser) { alert('⚠️ يرجى تسجيل الدخول'); return; }
  const amount = parseFloat(document.getElementById('investSlider').value);
  if (amount < 3) { alert('⚠️ الحد الأدنى 3 USDT'); return; }
  if (currentBalance < amount) { alert('❌ رصيد غير كاف'); return; }
  if (flexMiningPlans.find(p => p.userId === currentUser._id)) {
    alert('⚠️ لديك خطة نشطة بالفعل');
    return;
  }
  if (!confirm(`سيتم خصم ${amount} USDT لبدء خطة مدتها 50 يوماً. هل تتابع؟`)) return;
  currentBalance = Math.max(0, currentBalance - amount);
  const dailyRate = amount > 30 ? 0.04 : 0.03;
  const dailyProfit = amount * dailyRate;
  flexMiningPlans.push({
    userId: currentUser._id,
    capital: amount,
    dailyProfit: dailyProfit,
    day: 0,
    duration: 50,
    startDate: new Date().toISOString()
  });
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  document.getElementById('flexMiningStatus').textContent = `✅ تم تفعيل الخطة! الأرباح اليومية: ${dailyProfit.toFixed(2)} USDT`;
  if (currentUser) {
    currentUser.balance = currentBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
  refreshAdminData();
}

// ================================================================
// 7. خطط الترقية (VIP)
// ================================================================
function renderPlans() {
  const container = document.getElementById('plansContainer');
  if (!container) return;
  container.innerHTML = plans.map(p => `
    <div style="background:var(--glass-bg); padding:10px; border-radius:8px; margin:6px 0; backdrop-filter:blur(4px);">
      <div style="font-weight:700; color:var(--gold); font-size:clamp(14px,3vw,17px);">${p.name}</div>
      <div style="font-size:clamp(11px,2.5vw,13px); color:#8a7fa0;">
        المبلغ: ${p.min} - ${p.max} USDT | الربح: ${p.profit}% | المدة: ${p.duration} يوم
      </div>
      <button class="mini-btn" style="border-color:var(--gold); color:var(--gold);" onclick="purchasePlan('${p.name}')">
        <i class="fas fa-play"></i> تفعيل
      </button>
    </div>
  `).join('');
}

function purchasePlan(planName) {
  if (!currentUser) { alert('⚠️ يرجى تسجيل الدخول'); return; }
  const plan = plans.find(p => p.name === planName);
  if (!plan) return;
  const amount = plan.min;
  if (currentBalance < amount) { alert(`❌ تحتاج ${amount} USDT`); return; }
  if (miningPlans.find(p => p.userId === currentUser._id)) {
    alert('⚠️ لديك خطة نشطة');
    return;
  }
  if (!confirm(`سيتم خصم ${amount} USDT لتفعيل ${planName}. هل تتابع؟`)) return;
  currentBalance = Math.max(0, currentBalance - amount);
  const dailyProfit = amount * (plan.profit / 100);
  miningPlans.push({
    userId: currentUser._id,
    capital: amount,
    dailyProfit: dailyProfit,
    day: 0,
    duration: plan.duration,
    planName: plan.name
  });
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  alert(`✅ تم تفعيل ${planName}`);
  if (currentUser) {
    currentUser.balance = currentBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
  refreshAdminData();
}

function loadUserPlans(user) {
  const plan = miningPlans.find(p => p.userId === user._id);
  if (plan) {
    const statusEl = document.getElementById('miningPlanStatus');
    if (statusEl) statusEl.innerHTML = `⛏️ ${plan.planName}: اليوم ${plan.day}/${plan.duration} | أرباح اليوم: ${plan.dailyProfit.toFixed(2)} USDT`;
  }
  const flexPlan = flexMiningPlans.find(p => p.userId === user._id);
  if (flexPlan) {
    const statusEl = document.getElementById('flexMiningStatus');
    if (statusEl) statusEl.textContent = `⛏️ خطة مرنة: اليوم ${flexPlan.day}/${flexPlan.duration} | أرباح اليوم: ${flexPlan.dailyProfit.toFixed(2)} USDT`;
  }
}

// ================================================================
// 8. إدارة خطط التعدين (في لوحة الإدارة)
// ================================================================
function renderAdminPlans() {
  const container = document.getElementById('adminPlansList');
  if (!container) return;
  container.innerHTML = plans.map((p, idx) => `
    <div style="background:var(--glass-bg); padding:8px; border-radius:8px; margin:4px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; backdrop-filter:blur(4px);">
      <span style="font-weight:600; color:var(--gold);">${p.name}</span>
      <span style="font-size:clamp(11px,2vw,13px); color:#8a7fa0;">${p.min}-${p.max} USDT | ${p.profit}% | ${p.duration} يوم</span>
      <button class="mini-btn" style="border-color:#e74c3c; color:#e74c3c;" onclick="removePlan(${idx})"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

function showAddPlanForm() {
  const form = document.getElementById('addPlanForm');
  if (form) form.style.display = 'block';
}

function addPlan() {
  const name = document.getElementById('planName').value.trim();
  const min = parseFloat(document.getElementById('planMin').value);
  const max = parseFloat(document.getElementById('planMax').value);
  const profit = parseFloat(document.getElementById('planProfit').value);
  const duration = parseInt(document.getElementById('planDuration').value);
  if (!name || isNaN(min) || isNaN(max) || isNaN(profit) || isNaN(duration)) {
    alert('⚠️ املأ جميع الحقول بشكل صحيح');
    return;
  }
  plans.push({ name, min, max, profit, duration });
  document.getElementById('addPlanForm').style.display = 'none';
  document.getElementById('planName').value = '';
  document.getElementById('planMin').value = '';
  document.getElementById('planMax').value = '';
  document.getElementById('planProfit').value = '';
  document.getElementById('planDuration').value = '';
  renderPlans();
  renderAdminPlans();
  alert('✅ تم إضافة الخطة بنجاح');
}

function removePlan(index) {
  if (!confirm('⚠️ هل أنت متأكد من حذف هذه الخطة؟')) return;
  plans.splice(index, 1);
  renderPlans();
  renderAdminPlans();
}

// ================================================================
// 9. المحفظة (الإيداع، السحب، النقاط)
// ================================================================
function copyAddress() {
  const a = document.getElementById('walletAddress');
  if (a) { a.select(); document.execCommand('copy'); alert('✅ تم نسخ العنوان'); }
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
  refreshAdminData();
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
// 10. الإدارة الأساسية (التحكم والإحصائيات)
// ================================================================
function refreshAdminData() {
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

  // الإعلانات المعلقة
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
// 11. التحكم بالكازينو (House Edge والطوارئ)
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
// 12. إرسال النقاط (مكافآت)
// ================================================================
function sendReward() {
  const email = document.getElementById('rewardUserEmail').value.trim();
  const pts = parseFloat(document.getElementById('rewardPoints').value);
  if (!email || !pts || pts <= 0) {
    document.getElementById('rewardStatus').textContent = '⚠️ أدخل بريداً وعدد نقاط صحيح';
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
// 13. الإعلانات (المشاهدة والنشر)
// ================================================================
function watchAd() {
  if (adViews >= 20) {
    document.getElementById('adMessage').textContent = '✅ لديك فرصة مجانية! استخدمها في الكازينو.';
    document.getElementById('adMessage').style.color = '#2ecc71';
    return;
  }
  adViews++;
  document.getElementById('adViews').textContent = adViews;
  const progress = (adViews / 20) * 100;
  document.getElementById('adProgressFill').style.width = progress + '%';
  document.getElementById('adMessage').textContent = `📺 شاهدت إعلاناً (${adViews}/20)`;
  document.getElementById('adMessage').style.color = '#8a7fa0';
  if (adViews >= 20) {
    document.getElementById('adMessage').textContent = '🎉 أكملت 20 مشاهدة! لديك فرصة مجانية في الكازينو.';
    document.getElementById('adMessage').style.color = '#2ecc71';
    casinoBalance += 2.0;
    document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
    if (currentUser) {
      currentUser.casinoBalance = casinoBalance;
      localStorage.setItem('nexora_user', JSON.stringify(currentUser));
    }
  }
}

function submitAd() {
  if (!currentUser) { alert('⚠️ يرجى تسجيل الدخول'); return; }
  const title = document.getElementById('adTitle').value.trim();
  const content = document.getElementById('adContent').value.trim();
  const link = document.getElementById('adLink').value.trim();
  if (!title || !content || !link) { alert('⚠️ املأ جميع الحقول'); return; }
  if (currentBalance < 10) { alert('❌ رصيد غير كافٍ (10 USDT)'); return; }
  if (!confirm(`سيتم خصم 10 USDT لنشر الإعلان. هل تتابع؟`)) return;
  currentBalance = Math.max(0, currentBalance - 10);
  document.getElementById('liveBalance').innerHTML = currentBalance.toFixed(6) + ' <small>USDT</small>';
  pendingAds.push({
    userId: currentUser._id,
    title,
    content,
    link,
    status: 'pending'
  });
  document.getElementById('adSubmitStatus').textContent = '✅ تم إرسال الإعلان للمراجعة';
  document.getElementById('adTitle').value = '';
  document.getElementById('adContent').value = '';
  document.getElementById('adLink').value = '';
  if (currentUser) {
    currentUser.balance = currentBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
  refreshAdminData();
}

// ================================================================
// 14. شريط التحذير المتحرك (Ticker)
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
// 15. ألعاب الكازينو المبسطة (بدون Three.js)
// ================================================================

// دالة مساعدة لحساب نسبة الفوز (لصالح المنصة)
function getWinProbability(riskLevel, baseChance) {
  const maxProb = { low: 0.80, medium: 0.70, high: 0.40 };
  const max = maxProb[riskLevel] || 0.70;
  return Math.min(baseChance, max);
}

// دالة مساعدة لتسجيل الخسائر للإدارة
function sendLossToAdmin(amount, gameType) {
  adminRevenue += amount;
  fetch('/api/admin/loss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, game: gameType, userId: currentUser ? currentUser._id : 'guest' })
  }).catch(e => console.error(e));
}

// 15.1 لعبة تخمين الرقم
function playGuess() {
  const bet = parseFloat(document.getElementById('guessBet').value);
  const guess = parseInt(document.getElementById('guessNumber').value);
  const resultEl = document.getElementById('guessResult');
  
  if (!bet || bet < 0.3) {
    resultEl.textContent = '⚠️ الحد الأدنى 0.3 USDT';
    resultEl.style.color = '#f39c12';
    return;
  }
  if (isNaN(guess) || guess < 1 || guess > 10) {
    resultEl.textContent = '⚠️ اختر رقماً بين 1 و 10';
    resultEl.style.color = '#f39c12';
    return;
  }
  if (casinoBalance < bet) {
    resultEl.textContent = '⚠️ رصيد الكازينو غير كافٍ';
    resultEl.style.color = '#f39c12';
    return;
  }

  const roll = Math.floor(Math.random() * 10) + 1;
  const isWin = (guess === roll);
  
  // خوارزمية لصالح المنصة (تقليل فرصة الفوز)
  let winChance = 0.1; // 10% أساسية
  if (isWin && Math.random() < winChance) {
    // فوز حقيقي
    const profit = bet * 10; // مضاعف 10x
    casinoBalance += profit;
    resultEl.textContent = `🎉 فوز! الرقم كان ${roll} | ربحت ${profit.toFixed(4)} USDT`;
    resultEl.style.color = '#2ecc71';
  } else {
    // خسارة
    casinoBalance = Math.max(0, casinoBalance - bet);
    resultEl.textContent = `😢 خسارة! الرقم كان ${roll}`;
    resultEl.style.color = '#e74c3c';
    adminRevenue += bet;
    sendLossToAdmin(bet, 'guess');
  }
  
  document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
  if (currentUser) {
    currentUser.casinoBalance = casinoBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
  refreshAdminData();
}

// 15.2 لعبة الكراش (توقف تلقائي)
let crashActive = false;
let crashMultiplier = 1.00;
let crashIntervalId = null;
let crashBetAmount = 0;
let crashCashedOut = false;

function startCrash() {
  if (crashActive) return;
  const bet = parseFloat(document.getElementById('crashBet').value);
  const resultEl = document.getElementById('crashResult');
  if (!bet || bet < 0.3) {
    resultEl.textContent = '⚠️ الحد الأدنى 0.3 USDT';
    resultEl.style.color = '#f39c12';
    return;
  }
  if (casinoBalance < bet) {
    resultEl.textContent = '⚠️ رصيد الكازينو غير كافٍ';
    resultEl.style.color = '#f39c12';
    return;
  }
  
  crashBetAmount = bet;
  crashMultiplier = 1.00;
  crashActive = true;
  crashCashedOut = false;
  document.getElementById('crashMultiplier').textContent = '1.00x';
  document.getElementById('crashProgress').style.width = '0%';
  document.getElementById('crashResult').textContent = '';
  document.getElementById('crashExplosion').style.display = 'none';
  document.getElementById('crashCashoutBtn').disabled = false;
  document.getElementById('crashMultiplier').style.color = '#2ecc71';
  
  const maxCrash = 2.5 + Math.random() * 1.5;
  const crashPoint = Math.min(maxCrash, 4.0);
  
  if (crashIntervalId) clearInterval(crashIntervalId);
  crashIntervalId = setInterval(() => {
    crashMultiplier += 0.04 + Math.random() * 0.06;
    crashMultiplier = Math.round(crashMultiplier * 100) / 100;
    document.getElementById('crashMultiplier').textContent = crashMultiplier.toFixed(2) + 'x';
    const progress = Math.min((crashMultiplier / 4.0) * 100, 100);
    document.getElementById('crashProgress').style.width = progress + '%';
    
    if (crashMultiplier > 2.0) document.getElementById('crashMultiplier').style.color = '#f1c40f';
    if (crashMultiplier > 3.0) document.getElementById('crashMultiplier').style.color = '#e74c3c';
    
    if (crashMultiplier >= crashPoint && !crashCashedOut) {
      clearInterval(crashIntervalId);
      crashActive = false;
      document.getElementById('crashCashoutBtn').disabled = true;
      
      const explosion = document.getElementById('crashExplosion');
      explosion.style.display = 'block';
      explosion.textContent = '💥';
      explosion.style.fontSize = '60px';
      explosion.style.animation = 'explode 0.6s ease-out';
      setTimeout(() => {
        explosion.style.display = 'none';
        explosion.style.animation = 'none';
      }, 1000);
      
      casinoBalance = Math.max(0, casinoBalance - crashBetAmount);
      document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
      document.getElementById('crashResult').textContent = `💥 انهارت عند ${crashMultiplier.toFixed(2)}x | خسرت ${crashBetAmount.toFixed(4)} USDT`;
      document.getElementById('crashResult').style.color = '#e74c3c';
      adminRevenue += crashBetAmount;
      sendLossToAdmin(crashBetAmount, 'crash');
      if (currentUser) {
        currentUser.casinoBalance = casinoBalance;
        localStorage.setItem('nexora_user', JSON.stringify(currentUser));
      }
      refreshAdminData();
    }
  }, 120);
}

function cashoutCrash() {
  if (!crashActive || crashCashedOut) return;
  crashCashedOut = true;
  clearInterval(crashIntervalId);
  crashActive = false;
  document.getElementById('crashCashoutBtn').disabled = true;
  const win = crashBetAmount * crashMultiplier;
  casinoBalance += win;
  document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
  document.getElementById('crashResult').textContent = `🎉 سحبت عند ${crashMultiplier.toFixed(2)}x | ربحت ${win.toFixed(4)} USDT`;
  document.getElementById('crashResult').style.color = '#2ecc71';
  if (currentUser) {
    currentUser.casinoBalance = casinoBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
}

// 15.3 لعبة النرد (زوجي/فردي)
function rollDice() {
  const bet = parseFloat(document.getElementById('diceBet').value);
  const guess = document.getElementById('diceGuess').value;
  const resultEl = document.getElementById('diceResult');
  
  if (!bet || bet < 0.3) {
    resultEl.textContent = '⚠️ الحد الأدنى 0.3 USDT';
    resultEl.style.color = '#f39c12';
    return;
  }
  if (casinoBalance < bet) {
    resultEl.textContent = '⚠️ رصيد الكازينو غير كافٍ';
    resultEl.style.color = '#f39c12';
    return;
  }
  
  const roll = Math.floor(Math.random() * 6) + 1;
  const isWin = (guess === 'even' && roll % 2 === 0) || (guess === 'odd' && roll % 2 !== 0);
  
  // خوارزمية لصالح المنصة
  let winChance = 0.45; // 45% فقط بدلاً من 50%
  let actualWin = false;
  if (isWin && Math.random() < winChance) {
    actualWin = true;
  }
  
  let profit = 0;
  if (actualWin) {
    profit = bet * 2;
    casinoBalance += profit;
    resultEl.textContent = `🎉 فوز! الرقم: ${roll} | ربحت ${profit.toFixed(4)} USDT`;
    resultEl.style.color = '#2ecc71';
  } else {
    profit = -bet;
    casinoBalance = Math.max(0, casinoBalance - bet);
    resultEl.textContent = `😢 خسارة! الرقم: ${roll}`;
    resultEl.style.color = '#e74c3c';
    adminRevenue += bet;
    sendLossToAdmin(bet, 'dice');
  }
  
  document.getElementById('casinoBalance').innerHTML = casinoBalance.toFixed(6) + ' <small>USDT</small>';
  if (currentUser) {
    currentUser.casinoBalance = casinoBalance;
    localStorage.setItem('nexora_user', JSON.stringify(currentUser));
  }
  refreshAdminData();
}

// ================================================================
// 16. تهيئة التطبيق عند تحميل الصفحة
// ================================================================
window.onload = function() {
  // استعادة جلسة المستخدم
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
        // إظهار الرئيسية
        showDashboard();
      }
    } catch(e) {
      localStorage.removeItem('nexora_user');
    }
  }
  
  // تهيئة المكونات
  initTicker();
  renderPlans();
  renderAdminPlans();
  refreshAdminData();
  updateInvestmentCalc();
};

// ================================================================
// 17. محاكاة تحديث خطط التعدين اليومية (كل 15 ثانية لمحاكاة يوم)
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
