const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// تشغيل وقراءة الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../public')));

// مسار الدخول الرئيسي للمنصة
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// قاعدة البيانات المؤقتة للمستخدمين (تبدأ خالية تماماً لتسجيل حقيقي وأرصدة صفرية)
let usersDatabase = {};

// طلبات الإيداع والسحب والإعلانات المعلقة
let pendingRequests = [];
let availableAds = []; 

// محفظة المنصة الرسمية الخاصة بك تلقائياً
const OFFICIAL_WALLETS = {
    trc20: "TY7c1x9pAWRmNqE2vSdBtK6uZ8yLmX4h9Q", 
    ton: "EQBvD8uUXp1W_mR1vN8LpM5xY7O3d8J7V9kR4eG6b2mN" 
};

// ==========================================
// 1. منظومة الحسابات (تسجيل، دخول، استعادة)
// ==========================================

// تسجيل حساب جديد
app.post('/api/auth/register', (req, res) => {
    const { name, phone, email, password, telegramId } = req.body;
    
    if (!name || !phone || !email || !password) {
        return res.json({ success: false, message: "يرجى ملء جميع الحقول المطلوبة!" });
    }

    // التحقق من عدم تكرار الحساب
    if (usersDatabase[email]) {
        return res.json({ success: false, message: "هذا البريد الإلكتروني مسجل بالفعل!" });
    }

    // إنشاء الحساب برصيد صفر تماماً وطاقة كاملة
    usersDatabase[email] = {
        name,
        phone,
        email,
        password,
        telegramId: telegramId || "Not Connected",
        usdBalance: 0.00,
        vipPlanLevel: 1,
        miningEnergy: 1000,
        freeCasinoSpins: 0,
        language: "ar"
    };

    res.json({ success: true, message: "تم إنشاء حسابك بنجاح! يمكنك الآن تسجيل الدخول.", user: usersDatabase[email] });
});

// تسجيل الدخول
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = usersDatabase[email];

    if (!user || user.password !== password) {
        return res.json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة!" });
    }

    res.json({ success: true, message: "مرحباً بعودتك!", user });
});

// استعادة الحساب
app.post('/api/auth/recover', (req, res) => {
    const { email, phone } = req.body;
    const user = usersDatabase[email];

    if (!user || user.phone !== phone) {
        return res.json({ success: false, message: "البيانات المدخلة لا تطابق أي حساب مسجل لدينا!" });
    }

    // عرض كلمة المرور للمستخدم (سيتم تشفيرها وحمايتها في مرحلة الأمان التالية)
    res.json({ success: true, message: `تم التحقق بنجاح! كلمة المرور الخاصة بك هي: ${user.password}` });
});


// ==========================================
// 2. وظائف المنصة الأساسية (تعدين، كازينو، إعلانات)
// ==========================================

// جلب عناوين المحافظ الرسمية
app.get('/api/wallets/info', (req, res) => {
    res.json(OFFICIAL_WALLETS);
});

// مشاهدة الإعلانات والتحقق الذكي من توفرها
app.post('/api/watch-ad', (req, res) => {
    const { email } = req.body;
    const user = usersDatabase[email];

    if (!user) return res.json({ success: false, message: "يرجى تسجيل الدخول أولاً!" });

    // التحقق الصارم من وجود إعلان حقيقي
    if (availableAds.length === 0) {
        return res.json({ 
            success: false, 
            message: "الجمهور العزيز، الإعلانات غير متوفرة حالياً! المدراء يعملون على جلب حملات جديدة." 
        });
    }

    // منح جولة مجانية في الكازينو
    user.freeCasinoSpins += 1; 
    res.json({ 
        success: true, 
        message: "تمت مشاهدة الإعلان بنجاح! تم منحك جولة كازينو مجانية واحدة.",
        freeSpinsLeft: user.freeCasinoSpins
    });
});

// النقر والتعدين اليدوي
app.post('/api/mining/click', (req, res) => {
    const { email } = req.body;
    const user = usersDatabase[email];
    
    if (user && user.miningEnergy >= 20) {
        user.miningEnergy -= 20;
        user.usdBalance += 0.01; // يبدأ الاحتساب من الصفر والربح تصاعدي حقيقي
        return res.json({ success: true, newBalance: user.usdBalance, energy: user.miningEnergy });
    }
    res.json({ success: false, message: "طاقة التعدين نفدت أو الحساب غير موجود!" });
});

// تشغيل ألعاب الكازينو الثلاثة
app.post('/api/casino/play-game', (req, res) => {
    const { email, betAmount, riskLevel } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ success: false, message: "خطأ في الحساب" });

    if (betAmount === 0) {
        if (user.freeCasinoSpins <= 0) return res.json({ success: false, message: "لا تملك جولات مجانية" });
        user.freeCasinoSpins -= 1;
    } else {
        if (user.usdBalance < betAmount) return res.json({ success: false, message: "الرصيد الحالي غير كافٍ" });
        user.usdBalance -= betAmount;
    }

    let winChance = riskLevel === 'low' ? 0.65 : 0.30;
    const isWin = Math.random() < winChance;
    let prize = 0;

    if (isWin) {
        prize = betAmount === 0 ? 0.20 : betAmount * 2;
        user.usdBalance += prize;
    }

    res.json({
        success: true,
        isWin,
        prize,
        newBalance: user.usdBalance,
        freeSpinsLeft: user.freeCasinoSpins
    });
});

// استقبال إشعارات الإيداع اليدوي
app.post('/api/deposit-notify', (req, res) => {
    const { email, amount, txHash } = req.body;
    pendingRequests.push({ id: "req_" + Date.now(), email, type: 'شحن رصيد', amount, txHash, status: 'معلق' });
    res.json({ success: true, message: "تم إرسال إثبات الإيداع، وسيتم مراجعته من الإدارة فوراً." });
});

// طلب سحب الأرباح (حد أقصى مرتين في الأسبوع)
app.post('/api/withdraw/submit', (req, res) => {
    const { email, amount } = req.body;
    const user = usersDatabase[email];
    if(!user || user.usdBalance < amount) return res.json({ success: false, message: "الرصيد غير كافٍ!" });
    
    user.usdBalance -= parseFloat(amount);
    pendingRequests.push({ id: "req_" + Date.now(), email, type: 'سحب أرباح', amount, txHash: 'تحويل يدوي معلق', status: 'معلق' });
    res.json({ success: true, message: "تم تسجيل طلب السحب. المعالجة تتم مرتين أسبوعياً للمحافظة على سيولة المنصة." });
});

// إضافة إعلان مدفوع من معلن
app.post('/api/ads/submit', (req, res) => {
    const { email, link, cost } = req.body;
    const newId = "ad_" + Date.now();
    
    availableAds.push({ _id: newId, link: link });
    pendingRequests.push({ id: newId, email, type: 'إعلان ممول', amount: cost, txHash: link, status: 'نشط' });
    res.json({ success: true, message: "تم تفعيل حملتك الإعلانية وتوفيرها للمستخدمين بنجاح!" });
});


// ==========================================
// 3. لوحة التحكم الإدارية المتكاملة (Admin Dashboard)
// ==========================================

// جلب كل الطلبات المعلقة وحسابات المستخدمين للإدارة
app.get('/api/admin/dashboard-data', (req, res) => {
    res.json({
        requests: pendingRequests,
        usersCount: Object.keys(usersDatabase).length,
        users: Object.values(usersDatabase).map(u => ({ name: u.name, email: u.email, balance: u.usdBalance, phone: u.phone }))
    });
});

// التحكم بالطلبات (موافقة / رفض)
app.post('/api/admin/process-request', (req, res) => {
    const { requestId, action } = req.body;
    const index = pendingRequests.findIndex(r => r.id === requestId);
    
    if (index !== -1) {
        const request = pendingRequests[index];
        if (action === 'approve' && request.type === 'شحن رصيد') {
            if (usersDatabase[request.email]) {
                usersDatabase[request.email].usdBalance += parseFloat(request.amount);
            }
        }
        request.status = action === 'approve' ? 'تم القبول' : 'مرفوض';
        // إزالة الطلب من المعلقين بعد المعالجة
        pendingRequests.splice(index, 1);
        return res.json({ success: true, message: "تم تحديث الطلب وتعديل بيانات الحساب فوراً." });
    }
    res.json({ success: false, message: "الطلب غير موجود." });
});

// تعديل رصيد مستخدم مباشرة من الإدارة
app.post('/api/admin/modify-balance', (req, res) => {
    const { email, newBalance } = req.body;
    if (usersDatabase[email]) {
        usersDatabase[email].usdBalance = parseFloat(newBalance);
        return res.json({ success: true, message: "تم تحديث رصيد الحساب بنجاح." });
    }
    res.json({ success: false, message: "المستخدم غير موجود." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`السيرفر مستقر ويعمل على بورت ${PORT}`));
