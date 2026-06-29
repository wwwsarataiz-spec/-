// ===== app.js - عميل Nexora =====

const API_BASE = 'http://localhost:3000/api'; // غيّر إلى رابط السيرفر في الإنتاج

// عناصر الـ DOM
const loginOverlay = document.getElementById('loginOverlay');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarBalance = document.getElementById('sidebarBalance');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');

// ===== دوال مساعدة =====

// تخزين بيانات الجلسة
function setSession(token, user) {
  localStorage.setItem('nexora_token', token);
  localStorage.setItem('nexora_user', JSON.stringify(user));
}

// إنهاء الجلسة (تسجيل الخروج)
function clearSession() {
  localStorage.removeItem('nexora_token');
  localStorage.removeItem('nexora_user');
  loginOverlay.style.display = 'flex';
  sidebarUsername.textContent = 'زائر';
  sidebarBalance.textContent = '٠';
}

// تحديث الواجهة الجانبية وعرض اسم المستخدم
function updateSidebar(user) {
  if (user && user.name) {
    sidebarUsername.textContent = user.name;
    sidebarBalance.textContent = user.balance || 0;
  } else {
    sidebarUsername.textContent = 'زائر';
    sidebarBalance.textContent = '٠';
  }
}

// فتح نافذة تسجيل الدخول (إظهار الـ overlay)
function showLoginOverlay() {
  loginOverlay.style.display = 'flex';
}

// إخفاء نافذة تسجيل الدخول
function hideLoginOverlay() {
  loginOverlay.style.display = 'none';
}

// ===== التحقق من الجلسة عند بدء التشغيل =====

function initApp() {
  const token = localStorage.getItem('nexora_token');
  const storedUser = localStorage.getItem('nexora_user');

  if (token && storedUser) {
    try {
      const user = JSON.parse(storedUser);
      // يمكننا التحقق من صحة التوكن عبر طلب /api/user (اختياري)
      // لكن سنكتفي بالبيانات المخزنة حالياً
      updateSidebar(user);
      hideLoginOverlay();
    } catch (e) {
      clearSession();
    }
  } else {
    showLoginOverlay();
  }
}

// ===== دوال تسجيل الدخول والتسجيل =====

// تسجيل الدخول
async function loginUser(email, password) {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'فشل تسجيل الدخول');
    }

    // نجاح
    setSession(data.token, data.user);
    updateSidebar(data.user);
    hideLoginOverlay();
    loginError.textContent = '';
    return true;
  } catch (error) {
    loginError.textContent = error.message;
    return false;
  }
}

// إنشاء حساب جديد
async function registerUser(name, phone, email, password) {
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'فشل إنشاء الحساب');
    }

    // تسجيل دخول تلقائي بعد التسجيل
    setSession(data.token, data.user);
    updateSidebar(data.user);
    hideLoginOverlay();
    signupError.textContent = '';
    return true;
  } catch (error) {
    signupError.textContent = error.message;
    return false;
  }
}

// ===== ربط الأحداث =====

// نموذج تسجيل الدخول
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

// نموذج إنشاء الحساب
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

// التبديل بين التبويبات (لا حاجة لإضافات، لأننا نستخدم الـ radio buttons)

// زر تسجيل الخروج (يمكن إضافته في الـ Sidebar)
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  clearSession();
});

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initApp);
