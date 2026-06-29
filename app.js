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

// عناصر التعدين والمحفظة ... (كما هي سابقاً)

// ===== إدارة الجلسة =====

// حفظ التوكن وبيانات المستخدم
function setSession(token, user) {
    localStorage.setItem('nexora_token', token);
    localStorage.setItem('nexora_user', JSON.stringify(user));
}

// حذف الجلسة (تسجيل الخروج)
function clearSession() {
    localStorage.removeItem('nexora_token');
    localStorage.removeItem('nexora_user');
    // إعادة تعيين الواجهة
    loginOverlay.style.display = 'flex';
    sidebarUsername.textContent = 'زائر';
    sidebarBalance.textContent = '٠';
    sidebarCasinoBalance.textContent = '٠';
    // إعادة تعيين البطاقات
    updateSidebar(null);
    updateWalletUI(null);
    updateMiningUI(null);
    transactionsList.innerHTML = `<li style="color:#6a5f4e; text-align:center; justify-content:center;">لا توجد معاملات</li>`;
    // إيقاف العداد إن كان يعمل
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
    }
    mineBtn.disabled = false;
    mineBtn.textContent = '⛏️ تعدين (يدوي)';
}

// التحقق من التوكن المخزن وتوجيه المستخدم تلقائياً
async function checkAutoLogin() {
    const token = localStorage.getItem('nexora_token');
    const storedUser = localStorage.getItem('nexora_user');
    if (!token || !storedUser) {
        // لا توجد جلسة، نظهر overlay
        showLoginOverlay();
        return false;
    }
    try {
        // محاولة جلب البيانات من السيرفر للتحقق من صحة التوكن
        const response = await fetch('/api/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            // التوكن غير صالح، نمسح الجلسة
            clearSession();
            showLoginOverlay();
            return false;
        }
        const user = await response.json();
        // تحديث التخزين المحلي بالبيانات الجديدة
        localStorage.setItem('nexora_user', JSON.stringify(user));
        // تحديث الواجهة
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        hideLoginOverlay();
        loadTransactions();
        // جلب حالة التعدين (المهلة)
        const status = await fetchMiningStatus();
        if (status) updateMiningUIFromStatus(status);
        return true;
    } catch (error) {
        console.error('خطأ في التحقق من الجلسة:', error);
        clearSession();
        showLoginOverlay();
        return false;
    }
}

// ===== دوال تسجيل الدخول والتسجيل (معدلة) =====

// تسجيل الدخول
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
        // حفظ الجلسة
        setSession(data.token, data.user);
        // تحديث الواجهة
        const user = data.user;
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        hideLoginOverlay();
        loginError.textContent = '';
        loadTransactions();
        // جلب حالة التعدين
        const status = await fetchMiningStatus();
        if (status) updateMiningUIFromStatus(status);
        return true;
    } catch (error) {
        loginError.textContent = error.message;
        return false;
    }
}

// التسجيل (يعيد رسالة نجاح فقط، لا يدخل تلقائياً)
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
        // نعرض رسالة نجاح ونطلب من المستخدم تسجيل الدخول
        signupError.textContent = '✅ ' + data.message + '، يرجى تسجيل الدخول الآن';
        signupError.style.color = '#2ecc71';
        // ننقل التبويب إلى تسجيل الدخول
        document.getElementById('tabLogin').checked = true;
        // نملأ البريد تلقائياً ليسهل عليه
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = '';
        return true;
    } catch (error) {
        signupError.textContent = error.message;
        signupError.style.color = '#e74c3c';
        return false;
    }
}

// ===== تهيئة التطبيق =====

async function initApp() {
    // أولاً، نتحقق من وجود جلسة مخزنة
    const loggedIn = await checkAutoLogin();
    if (!loggedIn) {
        // إذا لم يكن هناك جلسة، نظهر overlay
        showLoginOverlay();
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
        signupError.style.color = '#e74c3c';
        return;
    }
    await registerUser(name, phone, email, password);
});

// زر تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    showLoginOverlay();
});

// ===== باقي الدوال (تعدين، محفظة، ألعاب) تبقى كما هي =====
// ... (جميع الدوال السابقة مثل handleMine, handleHarvest, transferToCasino, إلخ تبقى دون تغيير) ...

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', initApp);
