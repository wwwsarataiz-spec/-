// ===== app.js - عميل Nexora =====

// استخدام المسار النسبي تلقائياً (يعمل على localhost و Render)
const API_BASE = '';  // سيتم إضافة '/api/...' تلقائياً

// عناصر الـ DOM الأساسية
const loginOverlay = document.getElementById('loginOverlay');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarBalance = document.getElementById('sidebarBalance');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// ===== عناصر واجهة التعدين (سيتم إنشاؤها ديناميكياً) =====
let miningContainer = null;
let miningCounterDisplay = null;
let miningEarningsDisplay = null;
let mineBtn = null;
let harvestBtn = null;
let miningMessage = null;

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
  // إخفاء واجهة التعدين إن وجدت
  if (miningContainer) {
    miningContainer.style.display = 'none';
  }
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

// ===== إنشاء واجهة التعدين =====
function createMiningUI() {
  if (miningContainer) return; // موجود مسبقاً

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

  // ربط العناصر بالمتغيرات
  miningCounterDisplay = document.getElementById('miningCounter');
  miningEarningsDisplay = document.getElementById('miningEarnings');
  mineBtn = document.getElementById('mineBtn');
  harvestBtn = document.getElementById('harvestBtn');
  miningMessage = document.getElementById('miningMessage');

  // إضافة مستمعي الأحداث
  mineBtn.addEventListener('click', handleMine);
  harvestBtn.addEventListener('click', handleHarvest);
}

// ===== تحديث واجهة التعدين =====
function updateMiningUI(user) {
  if (!miningCounterDisplay || !miningEarningsDisplay) return;
  if (user) {
    miningCounterDisplay.textContent = user.miningCounter || 0;
    miningEarningsDisplay.textContent = (user.miningEarnings || 0).toFixed(4);
  }
}

// ===== دوال التعدين =====

async function handleMine() {
  const token = localStorage.getItem('nexora_token');
  if (!token) {
    showLoginOverlay();
    return;
  }

  try {
    const response = await fetch('/api/mine', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      miningMessage.textContent = data.message || 'فشل التعدين';
      miningMessage.style.color = '#e74c3c';
      return;
    }

    // تحديث الواجهة
    const userData = {
      balance: data.balance,
      miningCounter: data.miningCounter,
      miningEarnings: data.miningEarnings,
    };
    // تحديث الرصيد في الـ sidebar
    sidebarBalance.textContent = data.balance?.toFixed(4) || '0';
    // تحديث الـ mining UI
    updateMiningUI(userData);
    miningMessage.textContent = '✅ ' + data.message;
    miningMessage.style.color = '#2ecc71';

    // حفظ البيانات المحدثة في localStorage
    const storedUser = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    storedUser.balance = data.balance;
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
  if (!token) {
    showLoginOverlay();
    return;
  }

  try {
    const response = await fetch('/api/harvest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      miningMessage.textContent = data.message || 'فشل الحصاد';
      miningMessage.style.color = '#e74c3c';
      return;
    }

    // تحديث الواجهة
    sidebarBalance.textContent = data.balance?.toFixed(4) || '0';
    updateMiningUI({
      miningCounter: data.miningCounter,
      miningEarnings: data.miningEarnings,
    });
    miningMessage.textContent = '✅ ' + data.message;
    miningMessage.style.color = '#2ecc71';

    // تحديث localStorage
    const storedUser = JSON.parse(localStorage.getItem('nexora_user') || '{}');
    storedUser.balance = data.balance;
    storedUser.miningCounter = data.miningCounter;
    storedUser.miningEarnings = data.miningEarnings;
    localStorage.setItem('nexora_user', JSON.stringify(storedUser));

  } catch (error) {
    miningMessage.textContent = 'خطأ في الاتصال بالسيرفر';
    miningMessage.style.color = '#e74c3c';
  }
}

// ===== دوال تسجيل الدخول والتسجيل (معدلة لتحديث واجهة التعدين) =====

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
    // إنشاء واجهة التعدين وتحديثها
    createMiningUI();
    updateMiningUI(data.user);
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
  // إخفاء واجهة التعدين
  if (miningContainer) {
    miningContainer.style.display = 'none';
  }
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
    } catch (e) {
      clearSession();
    }
  } else {
    showLoginOverlay();
  }
});
