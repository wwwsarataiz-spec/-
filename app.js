// ===== app.js - عميل Nexora =====

// عناصر DOM الأساسية
const loginOverlay = document.getElementById('loginOverlay');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarBalance = document.getElementById('sidebarBalance');
const sidebarCasinoBalance = document.getElementById('sidebarCasinoBalance');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// عناصر التعدين
const miningCounterDisplay = document.getElementById('miningCounterDisplay');
const miningEarningsDisplay = document.getElementById('miningEarningsDisplay');
const mineBtn = document.getElementById('mineBtn');
const harvestBtn = document.getElementById('harvestBtn');
const miningMessage = document.getElementById('miningMessage');

// عناصر المحفظة
const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
const casinoBalanceDisplay = document.getElementById('casinoBalanceDisplay');
const transferAmount = document.getElementById('transferAmount');
const transferBtn = document.getElementById('transferBtn');
const withdrawAddress = document.getElementById('withdrawAddress');
const withdrawAmount = document.getElementById('withdrawAmount');
const withdrawBtn = document.getElementById('withdrawBtn');
const walletStatus = document.getElementById('walletStatus');
const depositTxId = document.getElementById('depositTxId');
const depositBtn = document.getElementById('depositBtn');
const depositStatus = document.getElementById('depositStatus');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const transactionsList = document.getElementById('transactionsList');

// عنوان الإيداع الثابت
const DEPOSIT_ADDRESS = '0x2975dc1f8188c30b2a4be0ec27e33494da66cb46';

// ===== دوال مساعدة =====

function setSession(token, user) {
  localStorage.setItem('nexora_token', token);
  localStorage.setItem('nexora_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('nexora_token');
  localStorage.removeItem('nexora_user');
  loginOverlay.style.display = 'flex';
  sidebarUsername.textContent = 'زائر';
  sidebarBalance.textContent = '٠';
  sidebarCasinoBalance.textContent = '٠';
  // إخفاء البطاقات (سيتم إعادة تعبئتها عند تسجيل الدخول)
}

function updateSidebar(user) {
  if (user && user.name) {
    sidebarUsername.textContent = user.name;
    sidebarBalance.textContent = (user.balance || 0).toFixed(4);
    sidebarCasinoBalance.textContent = (user.casinoBalance || 0).toFixed(4);
  } else {
    sidebarUsername.textContent = 'زائر';
    sidebarBalance.textContent = '٠';
    sidebarCasinoBalance.textContent = '٠';
  }
}

function updateWalletUI(user) {
  if (!user) return;
  walletBalanceDisplay.textContent = (user.balance || 0).toFixed(4);
  casinoBalanceDisplay.textContent = (user.casinoBalance || 0).toFixed(4);
}

function updateMiningUI(user) {
  if (!user) return;
  miningCounterDisplay.textContent = user.miningCounter || 0;
  miningEarningsDisplay.textContent = (user.miningEarnings || 0).toFixed(4);
}

function showLoginOverlay() { loginOverlay.style.display = 'flex'; }
function hideLoginOverlay() { loginOverlay.style.display = 'none'; }

// ===== دوال التعدين =====

async function handleMine() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  try {
    const response = await fetch('/api/mine', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (!response.ok) {
      miningMessage.textContent = data.message || 'فشل التعدين';
      miningMessage.style.color = '#e74c3c';
      return;
    }
    // تحديث الواجهة
    const user = {
      balance: data.balance,
      casinoBalance: data.casinoBalance,
      miningCounter: data.miningCounter,
      miningEarnings: data.miningEarnings
    };
    updateSidebar(user);
    updateWalletUI(user);
    updateMiningUI(user);
    miningMessage.textContent = '✅ ' + data.message;
    miningMessage.style.color = '#2ecc71';
    // حفظ في localStorage
    const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    Object.assign(stored, user);
    localStorage.setItem('nexora_user', JSON.stringify(stored));
  } catch (error) {
    miningMessage.textContent = 'خطأ في الاتصال';
    miningMessage.style.color = '#e74c3c';
  }
}

async function handleHarvest() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  try {
    const response = await fetch('/api/harvest', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (!response.ok) {
      miningMessage.textContent = data.message || 'فشل الحصاد';
      miningMessage.style.color = '#e74c3c';
      return;
    }
    const user = {
      balance: data.balance,
      casinoBalance: data.casinoBalance,
      miningCounter: data.miningCounter,
      miningEarnings: data.miningEarnings
    };
    updateSidebar(user);
    updateWalletUI(user);
    updateMiningUI(user);
    miningMessage.textContent = '✅ ' + data.message;
    miningMessage.style.color = '#2ecc71';
    // تحديث المعاملات
    loadTransactions();
    // حفظ localStorage
    const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    Object.assign(stored, user);
    stored.transactions = data.transactions || [];
    localStorage.setItem('nexora_user', JSON.stringify(stored));
  } catch (error) {
    miningMessage.textContent = 'خطأ في الاتصال';
    miningMessage.style.color = '#e74c3c';
  }
}

// ===== دوال المحفظة =====

// التحويل إلى الكازينو
async function transferToCasino() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  const amount = parseFloat(transferAmount.value);
  if (!amount || amount <= 0) {
    walletStatus.textContent = 'أدخل مبلغاً صحيحاً';
    walletStatus.style.color = '#e74c3c';
    return;
  }
  try {
    const response = await fetch('/api/wallet/transfer-to-casino', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    const data = await response.json();
    if (!response.ok) {
      walletStatus.textContent = data.message || 'فشل التحويل';
      walletStatus.style.color = '#e74c3c';
      return;
    }
    const user = { balance: data.balance, casinoBalance: data.casinoBalance };
    updateSidebar(user);
    updateWalletUI(user);
    walletStatus.textContent = '✅ ' + data.message;
    walletStatus.style.color = '#2ecc71';
    transferAmount.value = '';
    loadTransactions();
    // حفظ localStorage
    const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    stored.balance = data.balance;
    stored.casinoBalance = data.casinoBalance;
    stored.transactions = data.transactions || [];
    localStorage.setItem('nexora_user', JSON.stringify(stored));
  } catch (error) {
    walletStatus.textContent = 'خطأ في الاتصال';
    walletStatus.style.color = '#e74c3c';
  }
}

// طلب السحب
async function requestWithdraw() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  const address = withdrawAddress.value.trim();
  const amount = parseFloat(withdrawAmount.value);
  if (!address) {
    walletStatus.textContent = 'أدخل عنوان المحفظة';
    walletStatus.style.color = '#e74c3c';
    return;
  }
  if (!amount || amount < 4) {
    walletStatus.textContent = 'الحد الأدنى للسحب 4 USDT';
    walletStatus.style.color = '#e74c3c';
    return;
  }
  try {
    const response = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address, amount })
    });
    const data = await response.json();
    if (!response.ok) {
      walletStatus.textContent = data.message || 'فشل السحب';
      walletStatus.style.color = '#e74c3c';
      return;
    }
    const user = { balance: data.balance, casinoBalance: data.casinoBalance };
    updateSidebar(user);
    updateWalletUI(user);
    walletStatus.textContent = '✅ ' + data.message;
    walletStatus.style.color = '#2ecc71';
    withdrawAddress.value = '';
    withdrawAmount.value = '';
    loadTransactions();
    const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    stored.balance = data.balance;
    stored.casinoBalance = data.casinoBalance;
    stored.transactions = data.transactions || [];
    localStorage.setItem('nexora_user', JSON.stringify(stored));
  } catch (error) {
    walletStatus.textContent = 'خطأ في الاتصال';
    walletStatus.style.color = '#e74c3c';
  }
}

// الإيداع اليدوي (إرسال TxID)
async function submitDeposit() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  const txid = depositTxId.value.trim();
  if (!txid) {
    depositStatus.textContent = 'الرجاء إدخال رقم العملية';
    depositStatus.style.color = '#e74c3c';
    return;
  }
  try {
    const response = await fetch('/api/wallet/deposit', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ txid })
    });
    const data = await response.json();
    if (!response.ok) {
      depositStatus.textContent = data.message || 'فشل تسجيل الإيداع';
      depositStatus.style.color = '#e74c3c';
      return;
    }
    depositStatus.textContent = '✅ ' + data.message;
    depositStatus.style.color = '#2ecc71';
    depositTxId.value = '';
    // نحدّث المعاملات (قد تظهر كمعاملة معلقة)
    loadTransactions();
  } catch (error) {
    depositStatus.textContent = 'خطأ في الاتصال';
    depositStatus.style.color = '#e74c3c';
  }
}

// نسخ عنوان الإيداع
function copyAddress() {
  navigator.clipboard.writeText(DEPOSIT_ADDRESS).then(() => {
    depositStatus.textContent = '✅ تم نسخ العنوان';
    depositStatus.style.color = '#2ecc71';
    setTimeout(() => { depositStatus.textContent = ''; }, 3000);
  }).catch(() => {
    depositStatus.textContent = '⚠️ فشل النسخ، حاول يدوياً';
    depositStatus.style.color = '#e67e22';
  });
}

// تحميل قائمة المعاملات
async function loadTransactions() {
  const token = localStorage.getItem('nexora_token');
  if (!token) return;
  try {
    const response = await fetch('/api/wallet/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return;
    const data = await response.json();
    renderTransactions(data.transactions || []);
  } catch (error) {
    console.error('خطأ في تحميل المعاملات');
  }
}

function renderTransactions(transactions) {
  if (!transactionsList) return;
  if (!transactions || transactions.length === 0) {
    transactionsList.innerHTML = `<li style="color:#6a5f4e; text-align:center; justify-content:center;">لا توجد معاملات</li>`;
    return;
  }
  let html = '';
  transactions.slice(0, 10).forEach(tx => {
    let statusClass = '';
    let statusText = '';
    if (tx.status === 'pending') { statusClass = 'tx-status-pending'; statusText = 'قيد الانتظار'; }
    else if (tx.status === 'completed') { statusClass = 'tx-status-completed'; statusText = 'مكتمل'; }
    else { statusClass = 'tx-status-failed'; statusText = 'فشل'; }
    const typeMap = {
      'transfer_to_casino': 'تحويل للكازينو',
      'withdraw': 'سحب',
      'harvest': 'حصاد',
      'deposit': 'إيداع'
    };
    const typeText = typeMap[tx.type] || tx.type;
    html += `
      <li>
        <span>${typeText}</span>
        <span style="color:#d4af37;">${(tx.amount || 0).toFixed(4)} USDT</span>
        <span class="${statusClass}">${statusText}</span>
        <span style="color:#6a5f4e; font-size:0.7rem;">${new Date(tx.timestamp).toLocaleString()}</span>
      </li>
    `;
  });
  transactionsList.innerHTML = html;
}

// ===== دوال تسجيل الدخول والتسجيل =====

async function loginUser(email, password) {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'فشل تسجيل الدخول');
    setSession(data.token, data.user);
    const user = data.user;
    updateSidebar(user);
    updateWalletUI(user);
    updateMiningUI(user);
    hideLoginOverlay();
    loginError.textContent = '';
    loadTransactions();
    return true;
  } catch (error) {
    loginError.textContent = error.message;
    return false;
  }
}

async function registerUser(name, phone, email, password) {
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'فشل إنشاء الحساب');
    setSession(data.token, data.user);
    const user = data.user;
    updateSidebar(user);
    updateWalletUI(user);
    updateMiningUI(user);
    hideLoginOverlay();
    signupError.textContent = '';
    loadTransactions();
    return true;
  } catch (error) {
    signupError.textContent = error.message;
    return false;
  }
}

// ===== ربط الأحداث =====

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!email || !password) {
    loginError.textContent = 'يرجى ملء جميع الحقول';
    return;
  }
  await loginUser(email, password);
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();
  if (!name || !phone || !email || !password) {
    signupError.textContent = 'يرجى ملء جميع الحقول';
    return;
  }
  await registerUser(name, phone, email, password);
});

mineBtn.addEventListener('click', handleMine);
harvestBtn.addEventListener('click', handleHarvest);
transferBtn.addEventListener('click', transferToCasino);
withdrawBtn.addEventListener('click', requestWithdraw);
depositBtn.addEventListener('click', submitDeposit);
copyAddressBtn.addEventListener('click', copyAddress);

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearSession();
  // إعادة تعيين الشاشة
  updateSidebar(null);
  updateWalletUI(null);
  updateMiningUI(null);
  transactionsList.innerHTML = `<li style="color:#6a5f4e; text-align:center; justify-content:center;">لا توجد معاملات</li>`;
});

// ===== التهيئة =====
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('nexora_token');
  const storedUser = localStorage.getItem('nexora_user');
  if (token && storedUser) {
    try {
      const user = JSON.parse(storedUser);
      updateSidebar(user);
      updateWalletUI(user);
      updateMiningUI(user);
      hideLoginOverlay();
      loadTransactions();
    } catch (e) {
      clearSession();
    }
  } else {
    showLoginOverlay();
  }
});
