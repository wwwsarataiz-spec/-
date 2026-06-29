// ===== app.js - عميل Nexora =====

// استخدام المسار النسبي تلقائياً
const API_BASE = '';

// عناصر الـ DOM الأساسية
const loginOverlay = document.getElementById('loginOverlay');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarBalance = document.getElementById('sidebarBalance');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// ===== عناصر واجهة التعدين =====
let miningContainer = null;
let miningCounterDisplay = null;
let miningEarningsDisplay = null;
let mineBtn = null;
let harvestBtn = null;
let miningMessage = null;

// ===== عناصر واجهة المحفظة =====
let walletContainer = null;
let walletBalanceDisplay = null;
let casinoBalanceDisplay = null;
let transferAmountInput = null;
let transferBtn = null;
let withdrawAmountInput = null;
let withdrawAddressInput = null;
let withdrawBtn = null;
let copyAddressBtn = null;
let withdrawStatus = null;
let transactionsList = null;

// عنوان الإيداع الثابت (يمكن تغييره)
const DEPOSIT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

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
  if (miningContainer) miningContainer.style.display = 'none';
  if (walletContainer) walletContainer.style.display = 'none';
}

function updateSidebar(user) {
  if (user && user.name) {
    sidebarUsername.textContent = user.name;
    sidebarBalance.textContent = user.balance?.toFixed(4) || '0';
  } else {
    sidebarUsername.textContent = 'زائر';
    sidebarBalance.textContent = '٠';
  }
}

function showLoginOverlay() {
  loginOverlay.style.display = 'flex';
}

function hideLoginOverlay() {
  loginOverlay.style.display = 'none';
}

// ===== إنشاء واجهة التعدين (نفس الكود السابق) =====
function createMiningUI() {
  if (miningContainer) return;
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  miningContainer = document.createElement('div');
  miningContainer.id = 'miningSection';
  miningContainer.style.cssText = `
    margin-top: 2rem;
    background: rgba(255,255,255,0.03);
    border-radius: 1.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(212, 175, 55, 0.15);
    display: block;
  `;
  miningContainer.innerHTML = `
    <h3 style="color: #d4af37; font-weight: 300; margin-bottom: 1rem;">⛏️ نظام التعدين</h3>
    <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
      <div style="flex: 1; min-width: 120px;">
        <p style="color: #a3947a; font-size: 0.85rem;">عدد النقرات</p>
        <p id="miningCounter" style="font-size: 1.8rem; color: #f5e6c8; font-weight: 600;">0</p>
      </div>
      <div style="flex: 1; min-width: 120px;">
        <p style="color: #a3947a; font-size: 0.85rem;">الأرباح المتراكمة</p>
        <p id="miningEarnings" style="font-size: 1.8rem; color: #d4af37; font-weight: 600;">0.0000</p>
      </div>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 1rem;">
      <button id="mineBtn" style="
        flex: 1;
        background: linear-gradient(135deg, #d4af37, #b8962e);
        border: none;
        border-radius: 2rem;
        padding: 0.8rem 1.5rem;
        font-weight: 600;
        color: #0d0b0a;
        cursor: pointer;
        transition: 0.2s;
        font-size: 1rem;
        min-width: 120px;
      ">⛏️ تعدين</button>
      <button id="harvestBtn" style="
        flex: 1;
        background: rgba(212, 175, 55, 0.15);
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 2rem;
        padding: 0.8rem 1.5rem;
        font-weight: 600;
        color: #d4af37;
        cursor: pointer;
        transition: 0.2s;
        font-size: 1rem;
        min-width: 120px;
      ">💰 حصاد</button>
    </div>
    <div id="miningMessage" style="margin-top: 0.8rem; color: #b0a48a; font-size: 0.9rem; min-height: 1.5rem;"></div>
  `;
  mainContent.appendChild(miningContainer);

  miningCounterDisplay = document.getElementById('miningCounter');
  miningEarningsDisplay = document.getElementById('miningEarnings');
  mineBtn = document.getElementById('mineBtn');
  harvestBtn = document.getElementById('harvestBtn');
  miningMessage = document.getElementById('miningMessage');

  mineBtn.addEventListener('click', handleMine);
  harvestBtn.addEventListener('click', handleHarvest);
}

function updateMiningUI(user) {
  if (!miningCounterDisplay || !miningEarningsDisplay) return;
  if (user) {
    miningCounterDisplay.textContent = user.miningCounter || 0;
    miningEarningsDisplay.textContent = (user.miningEarnings || 0).toFixed(4);
  }
}

// ===== إنشاء واجهة المحفظة =====
function createWalletUI() {
  if (walletContainer) return;
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  walletContainer = document.createElement('div');
  walletContainer.id = 'walletSection';
  walletContainer.style.cssText = `
    margin-top: 2rem;
    background: rgba(255,255,255,0.03);
    border-radius: 1.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(212, 175, 55, 0.15);
    display: block;
  `;
  walletContainer.innerHTML = `
    <h3 style="color: #d4af37; font-weight: 300; margin-bottom: 1rem;">💰 المحفظة والتحويلات</h3>
    <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between;">
      <div style="flex: 1; min-width: 150px;">
        <p style="color: #a3947a; font-size: 0.85rem;">الرصيد الرئيسي (USDT)</p>
        <p id="walletBalance" style="font-size: 1.8rem; color: #f5e6c8; font-weight: 600;">0.0000</p>
      </div>
      <div style="flex: 1; min-width: 150px;">
        <p style="color: #a3947a; font-size: 0.85rem;">رصيد الكازينو</p>
        <p id="casinoBalance" style="font-size: 1.8rem; color: #d4af37; font-weight: 600;">0.0000</p>
      </div>
    </div>

    <hr style="border-color: rgba(212,175,55,0.2); margin: 1.2rem 0;" />

    <div style="display: flex; flex-wrap: wrap; gap: 1.5rem;">
      <!-- تحويل إلى الكازينو -->
      <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.03); border-radius: 1rem; padding: 1rem;">
        <h4 style="color: #f5e6c8; margin-bottom: 0.5rem;">تحويل إلى الكازينو</h4>
        <input type="number" id="transferAmount" placeholder="المبلغ" style="
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 2rem;
          padding: 0.6rem 1rem;
          color: #f0e6d5;
          margin-bottom: 0.5rem;
          outline: none;
        " step="0.0001" min="0.0001" />
        <button id="transferBtn" style="
          width: 100%;
          background: linear-gradient(135deg, #d4af37, #b8962e);
          border: none;
          border-radius: 2rem;
          padding: 0.7rem;
          font-weight: 600;
          color: #0d0b0a;
          cursor: pointer;
          transition: 0.2s;
        ">تحويل</button>
      </div>

      <!-- سحب -->
      <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.03); border-radius: 1rem; padding: 1rem;">
        <h4 style="color: #f5e6c8; margin-bottom: 0.5rem;">طلب سحب (الحد الأدنى 4 USDT)</h4>
        <input type="text" id="withdrawAddress" placeholder="عنوان المحفظة" style="
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 2rem;
          padding: 0.6rem 1rem;
          color: #f0e6d5;
          margin-bottom: 0.5rem;
          outline: none;
        " />
        <input type="number" id="withdrawAmount" placeholder="المبلغ (USDT)" style="
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 2rem;
          padding: 0.6rem 1rem;
          color: #f0e6d5;
          margin-bottom: 0.5rem;
          outline: none;
        " step="0.0001" min="4" />
        <button id="withdrawBtn" style="
          width: 100%;
          background: rgba(212, 175, 55, 0.15);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 2rem;
          padding: 0.7rem;
          font-weight: 600;
          color: #d4af37;
          cursor: pointer;
          transition: 0.2s;
        ">طلب السحب</button>
        <div id="withdrawStatus" style="margin-top: 0.5rem; color: #b0a48a; font-size: 0.85rem; min-height: 1.2rem;"></div>
      </div>
    </div>

    <hr style="border-color: rgba(212,175,55,0.2); margin: 1.2rem 0;" />

    <!-- عنوان الإيداع ونسخ -->
    <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;">
      <div style="flex: 1; min-width: 200px;">
        <p style="color: #a3947a; font-size: 0.85rem;">عنوان الإيداع (USDT)</p>
        <code id="depositAddress" style="
          background: rgba(0,0,0,0.3);
          padding: 0.3rem 0.8rem;
          border-radius: 1.5rem;
          color: #d4af37;
          font-size: 0.9rem;
          word-break: break-all;
        ">${DEPOSIT_ADDRESS}</code>
      </div>
      <button id="copyAddressBtn" style="
        background: rgba(212, 175, 55, 0.1);
        border: 1px solid rgba(212, 175, 55, 0.2);
        border-radius: 2rem;
        padding: 0.5rem 1.2rem;
        color: #d4af37;
        cursor: pointer;
        transition: 0.2s;
      ">📋 نسخ العنوان</button>
    </div>

    <hr style="border-color: rgba(212,175,55,0.2); margin: 1.2rem 0;" />

    <!-- آخر المعاملات -->
    <div>
      <h4 style="color: #f5e6c8; margin-bottom: 0.8rem;">📜 آخر المعاملات</h4>
      <ul id="transactionsList" style="
        list-style: none;
        padding: 0;
        max-height: 200px;
        overflow-y: auto;
        background: rgba(0,0,0,0.2);
        border-radius: 1rem;
        padding: 0.5rem;
      ">
        <li style="color: #6a5f4e; text-align: center; padding: 0.5rem;">لا توجد معاملات بعد</li>
      </ul>
    </div>
  `;
  mainContent.appendChild(walletContainer);

  // ربط العناصر
  walletBalanceDisplay = document.getElementById('walletBalance');
  casinoBalanceDisplay = document.getElementById('casinoBalance');
  transferAmountInput = document.getElementById('transferAmount');
  transferBtn = document.getElementById('transferBtn');
  withdrawAmountInput = document.getElementById('withdrawAmount');
  withdrawAddressInput = document.getElementById('withdrawAddress');
  withdrawBtn = document.getElementById('withdrawBtn');
  copyAddressBtn = document.getElementById('copyAddressBtn');
  withdrawStatus = document.getElementById('withdrawStatus');
  transactionsList = document.getElementById('transactionsList');

  // ربط الأحداث
  transferBtn.addEventListener('click', transferToCasino);
  withdrawBtn.addEventListener('click', requestWithdraw);
  copyAddressBtn.addEventListener('click', copyAddress);
}

function updateWalletUI(user) {
  if (!walletBalanceDisplay || !casinoBalanceDisplay) return;
  if (user) {
    walletBalanceDisplay.textContent = (user.balance || 0).toFixed(4);
    casinoBalanceDisplay.textContent = (user.casinoBalance || 0).toFixed(4);
  }
}

// ===== دوال التعدين =====
async function handleMine() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  try {
    const response = await fetch('/api/mine', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      miningMessage.textContent = data.message || 'فشل التعدين';
      miningMessage.style.color = '#e74c3c';
      return;
    }
    sidebarBalance.textContent = data.balance?.toFixed(4) || '0';
    updateMiningUI({ miningCounter: data.miningCounter, miningEarnings: data.miningEarnings });
    updateWalletUI({ balance: data.balance, casinoBalance: data.casinoBalance });
    miningMessage.textContent = '✅ ' + data.message;
    miningMessage.style.color = '#2ecc71';
    // تحديث localStorage
    const storedUser = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    storedUser.balance = data.balance;
    storedUser.casinoBalance = data.casinoBalance;
    storedUser.miningCounter = data.miningCounter;
    storedUser.miningEarnings = data.miningEarnings;
    localStorage.setItem('nexora_user', JSON.stringify(storedUser));
  } catch (error) {
    miningMessage.textContent = 'خطأ في الاتصال بالسيرفر';
    miningMessage.style.color = '#e74c3c';
  }
}

async function handleHarvest() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  try {
    const response = await fetch('/api/harvest', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      miningMessage.textContent = data.message || 'فشل الحصاد';
      miningMessage.style.color = '#e74c3c';
      return;
    }
    sidebarBalance.textContent = data.balance?.toFixed(4) || '0';
    updateMiningUI({ miningCounter: data.miningCounter, miningEarnings: data.miningEarnings });
    updateWalletUI({ balance: data.balance, casinoBalance: data.casinoBalance });
    miningMessage.textContent = '✅ ' + data.message;
    miningMessage.style.color = '#2ecc71';
    // تحديث قائمة المعاملات
    loadTransactions();
    // تحديث localStorage
    const storedUser = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    storedUser.balance = data.balance;
    storedUser.casinoBalance = data.casinoBalance;
    storedUser.miningCounter = data.miningCounter;
    storedUser.miningEarnings = data.miningEarnings;
    storedUser.transactions = data.transactions || [];
    localStorage.setItem('nexora_user', JSON.stringify(storedUser));
  } catch (error) {
    miningMessage.textContent = 'خطأ في الاتصال بالسيرفر';
    miningMessage.style.color = '#e74c3c';
  }
}

// ===== دوال المحفظة =====

// 1. التحويل إلى الكازينو
async function transferToCasino() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  const amount = parseFloat(transferAmountInput.value);
  if (!amount || amount <= 0) {
    withdrawStatus.textContent = 'الرجاء إدخال مبلغ صحيح';
    withdrawStatus.style.color = '#e74c3c';
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
      withdrawStatus.textContent = data.message || 'فشل التحويل';
      withdrawStatus.style.color = '#e74c3c';
      return;
    }
    // تحديث الواجهة
    updateWalletUI({ balance: data.balance, casinoBalance: data.casinoBalance });
    sidebarBalance.textContent = data.balance?.toFixed(4) || '0';
    withdrawStatus.textContent = '✅ ' + data.message;
    withdrawStatus.style.color = '#2ecc71';
    transferAmountInput.value = '';
    // تحديث المعاملات
    loadTransactions();
    // تحديث localStorage
    const storedUser = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    storedUser.balance = data.balance;
    storedUser.casinoBalance = data.casinoBalance;
    storedUser.transactions = data.transactions || [];
    localStorage.setItem('nexora_user', JSON.stringify(storedUser));
  } catch (error) {
    withdrawStatus.textContent = 'خطأ في الاتصال بالسيرفر';
    withdrawStatus.style.color = '#e74c3c';
  }
}

// 2. طلب السحب
async function requestWithdraw() {
  const token = localStorage.getItem('nexora_token');
  if (!token) { showLoginOverlay(); return; }
  const address = withdrawAddressInput.value.trim();
  const amount = parseFloat(withdrawAmountInput.value);
  if (!address) {
    withdrawStatus.textContent = 'الرجاء إدخال عنوان المحفظة';
    withdrawStatus.style.color = '#e74c3c';
    return;
  }
  if (!amount || amount <= 0 || amount < 4) {
    withdrawStatus.textContent = 'الحد الأدنى للسحب 4 USDT';
    withdrawStatus.style.color = '#e74c3c';
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
      withdrawStatus.textContent = data.message || 'فشل طلب السحب';
      withdrawStatus.style.color = '#e74c3c';
      return;
    }
    updateWalletUI({ balance: data.balance, casinoBalance: data.casinoBalance });
    sidebarBalance.textContent = data.balance?.toFixed(4) || '0';
    withdrawStatus.textContent = '✅ ' + data.message;
    withdrawStatus.style.color = '#2ecc71';
    withdrawAddressInput.value = '';
    withdrawAmountInput.value = '';
    loadTransactions();
    // تحديث localStorage
    const storedUser = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    storedUser.balance = data.balance;
    storedUser.casinoBalance = data.casinoBalance;
    storedUser.transactions = data.transactions || [];
    localStorage.setItem('nexora_user', JSON.stringify(storedUser));
  } catch (error) {
    withdrawStatus.textContent = 'خطأ في الاتصال بالسيرفر';
    withdrawStatus.style.color = '#e74c3c';
  }
}

// 3. نسخ عنوان الإيداع
function copyAddress() {
  const address = document.getElementById('depositAddress')?.innerText || DEPOSIT_ADDRESS;
  navigator.clipboard.writeText(address).then(() => {
    withdrawStatus.textContent = '✅ تم نسخ عنوان الإيداع';
    withdrawStatus.style.color = '#2ecc71';
    setTimeout(() => { withdrawStatus.textContent = ''; }, 3000);
  }).catch(() => {
    withdrawStatus.textContent = '⚠️ فشل النسخ، حاول يدوياً';
    withdrawStatus.style.color = '#e67e22';
  });
}

// 4. تحميل قائمة المعاملات
async function loadTransactions() {
  const token = localStorage.getItem('nexora_token');
  if (!token) return;
  try {
    const response = await fetch('/api/wallet/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      console.error('فشل جلب المعاملات');
      return;
    }
    const data = await response.json();
    renderTransactions(data.transactions || []);
  } catch (error) {
    console.error('خطأ في تحميل المعاملات', error);
  }
}

function renderTransactions(transactions) {
  if (!transactionsList) return;
  if (!transactions || transactions.length === 0) {
    transactionsList.innerHTML = `<li style="color:#6a5f4e; text-align:center; padding:0.5rem;">لا توجد معاملات بعد</li>`;
    return;
  }
  let html = '';
  transactions.slice(0, 10).forEach(tx => {
    const statusColor = tx.status === 'pending' ? '#f1c40f' : (tx.status === 'completed' ? '#2ecc71' : '#e74c3c');
    html += `
      <li style="
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0.8rem;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        color: #f0e6d5;
        font-size: 0.9rem;
      ">
        <span>${tx.type === 'transfer_to_casino' ? 'تحويل للكازينو' : (tx.type === 'withdraw' ? 'سحب' : 'حصاد')}</span>
        <span style="color: #d4af37;">${tx.amount.toFixed(4)} USDT</span>
        <span style="color: ${statusColor};">${tx.status === 'pending' ? 'قيد الانتظار' : (tx.status === 'completed' ? 'مكتمل' : 'فشل')}</span>
        <span style="color: #6a5f4e; font-size: 0.7rem;">${new Date(tx.timestamp).toLocaleString()}</span>
      </li>
    `;
  });
  transactionsList.innerHTML = html;
}

// ===== دوال تسجيل الدخول والتسجيل (معدلة) =====

async function loginUser(email, password) {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'فشل تسجيل الدخول');
    }
    setSession(data.token, data.user);
    updateSidebar(data.user);
    hideLoginOverlay();
    loginError.textContent = '';
    // إنشاء واجهات التعدين والمحفظة
    createMiningUI();
    updateMiningUI(data.user);
    createWalletUI();
    updateWalletUI(data.user);
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
    if (!response.ok) {
      throw new Error(data.message || 'فشل إنشاء الحساب');
    }
    setSession(data.token, data.user);
    updateSidebar(data.user);
    hideLoginOverlay();
    signupError.textContent = '';
    createMiningUI();
    updateMiningUI(data.user);
    createWalletUI();
    updateWalletUI(data.user);
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

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  clearSession();
  if (miningContainer) miningContainer.style.display = 'none';
  if (walletContainer) walletContainer.style.display = 'none';
});

// ===== التهيئة عند تحميل الصفحة =====
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('nexora_token');
  const storedUser = localStorage.getItem('nexora_user');
  if (token && storedUser) {
    try {
      const user = JSON.parse(storedUser);
      updateSidebar(user);
      hideLoginOverlay();
      createMiningUI();
      updateMiningUI(user);
      createWalletUI();
      updateWalletUI(user);
      loadTransactions();
    } catch (e) {
      clearSession();
    }
  } else {
    showLoginOverlay();
  }
});
