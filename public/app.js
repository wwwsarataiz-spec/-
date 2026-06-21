// ==========================================
// public/app.js - كود الواجهة الأمامية
// ==========================================

console.log('✅ Nexora app.js loaded successfully');

// ==========================================
// دوال تسجيل الدخول والتسجيل
// ==========================================

function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    alert('✅ Login attempt: ' + email);
}

function handleRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    alert('✅ Register attempt: ' + email);
}

function handleForgot() {
    const email = document.getElementById('forgotEmail').value;
    alert('✅ Forgot password for: ' + email);
}

function toggleAuthForm(form) {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('forgotForm').classList.add('hidden');
    document.getElementById(form).classList.remove('hidden');
}

// ربط الأزرار بالدوال عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM loaded, binding buttons...');
    
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.onclick = handleLogin;
        console.log('✅ Login button bound');
    }
    
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.onclick = handleRegister;
        console.log('✅ Register button bound');
    }
    
    const forgotBtn = document.getElementById('forgotBtn');
    if (forgotBtn) {
        forgotBtn.onclick = handleForgot;
        console.log('✅ Forgot button bound');
    }
    
    // أزرار التنقل
    document.getElementById('showRegister').onclick = function() { toggleAuthForm('registerForm'); };
    document.getElementById('showForgot').onclick = function() { toggleAuthForm('forgotForm'); };
    document.getElementById('backToLogin').onclick = function() { toggleAuthForm('loginForm'); };
    document.getElementById('backToLogin2').onclick = function() { toggleAuthForm('loginForm'); };
});
