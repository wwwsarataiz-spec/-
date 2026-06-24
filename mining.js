// ================================================================
// 1. التعدين المجاني
// ================================================================
let lastFreeMining = 0;
let freeMiningAccumulated = 0;

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
// 2. التعدين المدفوع المرن
// ================================================================
function updateInvestmentCalc() {
  const slider = document.getElementById('investSlider');
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
  if (typeof refreshAdminData === 'function') refreshAdminData();
}

// ================================================================
// 3. خطط الترقية
// ================================================================
let plans = [
  { name: 'VIP 1', min: 10, max: 50, profit: 2.0, duration: 30 },
  { name: 'VIP 2', min: 51, max: 200, profit: 3.0, duration: 45 },
  { name: 'VIP 3', min: 201, max: 500, profit: 4.0, duration: 50 }
];

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
  if (typeof refreshAdminData === 'function') refreshAdminData();
}

function loadUserPlans(user) {
  const plan = miningPlans.find(p => p.userId === user._id);
  if (plan) {
    document.getElementById('miningPlanStatus').innerHTML = `⛏️ ${plan.planName}: اليوم ${plan.day}/${plan.duration} | أرباح اليوم: ${plan.dailyProfit.toFixed(2)} USDT`;
  }
  const flexPlan = flexMiningPlans.find(p => p.userId === user._id);
  if (flexPlan) {
    document.getElementById('flexMiningStatus').textContent = `⛏️ خطة مرنة: اليوم ${flexPlan.day}/${flexPlan.duration} | أرباح اليوم: ${flexPlan.dailyProfit.toFixed(2)} USDT`;
  }
}

// ================================================================
// 4. إدارة الخطط (الإضافة والحذف)
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
  document.getElementById('addPlanForm').style.display = 'block';
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
