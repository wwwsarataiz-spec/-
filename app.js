// ===== app.js - عميل Nexora =====

// ... (جميع المتغيرات والدوال السابقة تبقى كما هي) ...

// ===== إضافة عناصر إدارة التعدين =====
const mineBtn = document.getElementById('mineBtn');
const harvestBtn = document.getElementById('harvestBtn');
const miningMessage = document.getElementById('miningMessage');
let cooldownInterval = null;

// دالة لجلب حالة التعدين من السيرفر
async function fetchMiningStatus() {
    const token = localStorage.getItem('nexora_token');
    if (!token) return null;
    try {
        const response = await fetch('/api/mining-status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('فشل جلب حالة التعدين');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('خطأ في جلب حالة التعدين:', error);
        return null;
    }
}

// دالة تحديث واجهة التعدين (العداد والزر)
function updateMiningUIFromStatus(status) {
    if (!status) return;
    // تحديث الأرباح المعروضة
    if (miningEarningsDisplay) {
        miningEarningsDisplay.textContent = (status.miningEarnings || 0).toFixed(4);
    }
    if (status.canMine) {
        // التعدين متاح
        mineBtn.disabled = false;
        mineBtn.textContent = '⛏️ تعدين (يدوي)';
        // إيقاف العداد إن كان يعمل
        if (cooldownInterval) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
        }
        // إزالة أي رسوم عداد من الزر
        miningMessage.textContent = '';
    } else {
        // التعدين محظور، نعرض العداد
        mineBtn.disabled = true;
        const remaining = status.cooldownRemaining || 0;
        updateCooldownButton(remaining);
        // بدء العداد التنازلي
        if (cooldownInterval) clearInterval(cooldownInterval);
        let remainingSeconds = remaining;
        cooldownInterval = setInterval(async () => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
                // إعادة التحقق من الحالة
                const newStatus = await fetchMiningStatus();
                if (newStatus) updateMiningUIFromStatus(newStatus);
                return;
            }
            updateCooldownButton(remainingSeconds);
        }, 1000);
    }
}

// دالة لتحديث نص الزر بالعداد
function updateCooldownButton(seconds) {
    if (!mineBtn) return;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    mineBtn.textContent = `⏳ متبقي ${timeStr}`;
}

// تعديل دالة handleMine لتحديث الحالة بعد كل نقرة
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
            // إذا كان الخطأ بسبب المهلة، نحدّث الحالة
            if (response.status === 403 && data.cooldownRemaining) {
                miningMessage.textContent = data.message || 'في مهلة الانتظار';
                miningMessage.style.color = '#f1c40f';
                // تحديث حالة التعدين من السيرفر
                const status = await fetchMiningStatus();
                if (status) updateMiningUIFromStatus(status);
                return;
            }
            miningMessage.textContent = data.message || 'فشل التعدين';
            miningMessage.style.color = '#e74c3c';
            return;
        }
        // نجاح التعدين
        const user = {
            balance: data.balance,
            casinoBalance: data.casinoBalance,
            miningEarnings: data.miningEarnings
        };
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        miningMessage.textContent = '✅ ' + data.message;
        miningMessage.style.color = '#2ecc71';
        // تحديث localStorage
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        localStorage.setItem('nexora_user', JSON.stringify(stored));
        // إعادة جلب حالة التعدين (للتأكد من عدم وجود مهلة)
        const status = await fetchMiningStatus();
        if (status) updateMiningUIFromStatus(status);
    } catch (error) {
        miningMessage.textContent = 'خطأ في الاتصال';
        miningMessage.style.color = '#e74c3c';
    }
}

// تعديل دالة handleHarvest لتحديث الحالة بعد الحصاد
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
            miningEarnings: data.miningEarnings
        };
        updateSidebar(user);
        updateWalletUI(user);
        updateMiningUI(user);
        miningMessage.textContent = '✅ ' + data.message;
        miningMessage.style.color = '#2ecc71';
        // تحديث المعاملات
        loadTransactions();
        // تحديث localStorage
        const stored = JSON.parse(localStorage.getItem('nexora_user') || '{}');
        Object.assign(stored, user);
        stored.transactions = data.transactions || [];
        stored.lastHarvestTime = data.lastHarvestTime;
        localStorage.setItem('nexora_user', JSON.stringify(stored));
        // جلب حالة التعدين الجديدة (ستظهر المهلة)
        const status = await fetchMiningStatus();
        if (status) updateMiningUIFromStatus(status);
    } catch (error) {
        miningMessage.textContent = 'خطأ في الاتصال';
        miningMessage.style.color = '#e74c3c';
    }
}

// ===== تهيئة التطبيق (مع إضافة استدعاء حالة التعدين) =====
async function initApp() {
    const token = localStorage.getItem('nexora_token');
    const storedUser = localStorage.getItem('nexora_user');

    if (token && storedUser) {
        try {
            const user = await fetchUserData();
            if (user) {
                updateSidebar(user);
                updateWalletUI(user);
                updateMiningUI(user);
                hideLoginOverlay();
                loadTransactions();
                // جلب حالة التعدين لتحديث العداد
                const status = await fetchMiningStatus();
                if (status) updateMiningUIFromStatus(status);
                return;
            }
        } catch (e) {
            try {
                const user = JSON.parse(storedUser);
                updateSidebar(user);
                updateWalletUI(user);
                updateMiningUI(user);
                hideLoginOverlay();
                loadTransactions();
                const status = await fetchMiningStatus();
                if (status) updateMiningUIFromStatus(status);
                return;
            } catch (err) {
                clearSession();
            }
        }
    }
    showLoginOverlay();
}

// ... (باقي الكود كما هو) ...
