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

// ==========================================
// قاعدة البيانات المؤقتة للمستخدمين (في الذاكرة)
// ==========================================
let usersDatabase = {};

// طلبات الإيداع والسحب والإعلانات المعلقة
let pendingRequests = [];
let availableAds = [];

// محفظة المنصة الرسمية (تم إزالة TON وإضافة TRC20 فقط كما طلبت)
const OFFICIAL_WALLETS = {
    trc20: "TY7c1x9pAWRmNqE2vSdBtK6uZ8yLmX4h9Q",
    platform: "TPlatformWalletAddress123456789" // عنوان المنصة الرئيسي للإيداع
};

// ==========================================
// 1. منظومة الحسابات (مع تفعيل البريد الإلكتروني)
// ==========================================

// تسجيل حساب جديد مع إرسال رمز التحقق (محاكاة)
app.post('/api/auth/register', (req, res) => {
    const { name, phone, email, password, telegramId } = req.body;
    
    if (!name || !phone || !email || !password) {
        return res.json({ success: false, message: "يرجى ملء جميع الحقول المطلوبة!" });
    }

    if (usersDatabase[email]) {
        return res.json({ success: false, message: "هذا البريد الإلكتروني مسجل بالفعل!" });
    }

    // توليد رمز تحقق عشوائي (6 أرقام)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // إنشاء الحساب مع جميع الحقول الجديدة
    usersDatabase[email] = {
        name,
        phone,
        email,
        password,
        telegramId: telegramId || "Not Connected",
        usdBalance: 0.00,
        casinoBalance: 0.00,          // رصيد الكازينو الجديد
        watchedAdsCount: 0,            // عداد الإعلانات المكتملة
        lastAdTime: 0,                 // للحماية من البوتات
        vipPlanLevel: 1,
        miningEnergy: 1000,
        freeCasinoSpins: 0,
        language: "ar",
        verified: false,
        verificationCode: verificationCode,
        tokenRequests: [],             // طلبات العملات المفتوحة
        dailyBonusClaimed: false,
        lastDailyClaimDate: null
    };

    // عرض رمز التحقق في الرد (لأننا لا نملك SMTP حقيقياً، سنعرضه للمطور)
    console.log(`🔑 رمز التحقق للمستخدم ${email}: ${verificationCode}`);

    res.json({
        success: true,
        message: "تم إنشاء الحساب! يرجى التحقق من بريدك الإلكتروني (الرمز ظهر في وحدة تحكم السيرفر) وأدخل رمز التفعيل.",
        email: email,
        verificationCode: verificationCode // نرسله مؤقتاً للتجربة، لكن في الإنتاج يحذف
    });
});

// تأكيد البريد الإلكتروني
app.post('/api/auth/verify-email', (req, res) => {
    const { email, code } = req.body;
    const user = usersDatabase[email];

    if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });
    if (user.verified) return res.json({ success: false, message: "الحساب مفعل مسبقاً" });
    if (user.verificationCode !== code) return res.json({ success: false, message: "رمز التأكيد غير صحيح" });

    user.verified = true;
    user.verificationCode = null;
    // منح جولتين مجانيتين كمكافأة
    user.freeCasinoSpins = 2;

    res.json({ success: true, message: "تم تأكيد البريد بنجاح! تم منحك جولتين مجانيتين في الكازينو." });
});

// تسجيل الدخول (يتطلب التفعيل)
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = usersDatabase[email];

    if (!user || user.password !== password) {
        return res.json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة!" });
    }

    if (!user.verified) {
        return res.json({ success: false, message: "الحساب غير مفعل، يرجى التحقق من بريدك الإلكتروني." });
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

    res.json({ success: true, message: `تم التحقق بنجاح! كلمة المرور الخاصة بك هي: ${user.password}` });
});


// ==========================================
// 2. جلب بيانات المستخدم (بما فيها رصيد الكازينو)
// ==========================================
app.post('/api/user-data', (req, res) => {
    const { email } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ error: "المستخدم غير موجود" });

    res.json({
        usdBalance: user.usdBalance,
        casinoBalance: user.casinoBalance,
        watchedAdsCount: user.watchedAdsCount,
        freeSpins: user.freeCasinoSpins,
        name: user.name
    });
});


// ==========================================
// 3. المكافأة اليومية (تمنح جولة كازينو مجانية)
// ==========================================
app.post('/api/bonus/daily-claim', (req, res) => {
    const { email } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

    const now = Date.now();
    const lastClaim = user.lastDailyClaimDate || 0;
    const hoursDiff = (now - lastClaim) / (1000 * 60 * 60);

    if (hoursDiff < 24) {
        const remaining = Math.ceil(24 - hoursDiff);
        return res.json({ success: false, message: `لا يزال متبقي ${remaining} ساعة للمطالبة التالية` });
    }

    user.freeCasinoSpins += 1;
    user.lastDailyClaimDate = now;

    res.json({ success: true, message: "تم منحك جولة مجانية في الكازينو!", freeSpins: user.freeCasinoSpins });
});


// ==========================================
// 4. نظام الإعلانات الممولة (المشاهدة لحصد النقاط)
// ==========================================
const ADS_FOR_POINT = 15;
const POINT_VALUE = 0.01;

app.post('/api/ads/watch', (req, res) => {
    const { email } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

    // حماية البوتات: 10 ثوانٍ بين الإعلانات
    const now = Date.now();
    if (now - user.lastAdTime < 10000) {
        return res.json({ success: false, message: "يرجى الانتظار 10 ثوانٍ بين كل إعلان وآخر." });
    }
    user.lastAdTime = now;

    // التحقق من وجود إعلانات متاحة
    if (availableAds.length === 0) {
        return res.json({ success: false, message: "لا توجد إعلانات حالياً، حاول لاحقاً." });
    }

    // زيادة العداد
    user.watchedAdsCount += 1;
    let pointEarned = false;
    let newCasinoBalance = user.casinoBalance;

    // إذا وصل للعدد المطلوب، نمنح نقطة كازينو
    if (user.watchedAdsCount >= ADS_FOR_POINT) {
        user.casinoBalance += POINT_VALUE;
        newCasinoBalance = user.casinoBalance;
        user.watchedAdsCount = 0;
        pointEarned = true;
    }

    res.json({
        success: true,
        message: pointEarned ? `🎉 أكملت ${ADS_FOR_POINT} إعلاناً وحصلت على ${POINT_VALUE}$ في رصيد الكازينو!` : `✅ تم احتساب الإعلان. تبقى ${ADS_FOR_POINT - user.watchedAdsCount} إعلاناً للنقطة القادمة.`,
        watchedAdsCount: user.watchedAdsCount,
        casinoBalance: newCasinoBalance,
        pointEarned
    });
});


// ==========================================
// 5. لعبة الكازينو (تستخدم رصيد الكازينو فقط)
// ==========================================
app.post('/api/casino/margin', (req, res) => {
    const { email, amount, chosenPercentage } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

    if (user.casinoBalance < amount) {
        return res.json({ success: false, message: "رصيد الكازينو غير كافٍ! شاهد إعلانات للحصول على نقاط." });
    }

    // خصم المبلغ من رصيد الكازينو
    user.casinoBalance -= amount;

    // توليد رقم عشوائي (1-100)
    const rollResult = Math.floor(Math.random() * 100) + 1;
    let win = false;
    let profit = 0;

    // منطق الفوز بناءً على النسبة المختارة مع خوارزمية الانعكاس الذكية
    // نطبق عمولة 5% لصالح المنصة (نسبة الفوز الفعلية أقل قليلاً)
    const effectivePercentage = chosenPercentage * 0.95; 
    if (rollResult <= effectivePercentage) {
        win = true;
        profit = amount * (effectivePercentage / 100);
        user.casinoBalance += profit; // إضافة الربح (مع الاحتفاظ بأصل الرهان)
    } else {
        win = false;
        profit = -amount; // خسارة المبلغ بالكامل
    }

    res.json({
        success: true,
        win,
        rollResult,
        profit,
        newBalance: user.casinoBalance,
        message: win ? `فوز! ربحت ${profit.toFixed(2)}$` : `خسارة! خسرت ${amount.toFixed(2)}$`
    });
});


// ==========================================
// 6. صنع العملة (الدفع من الرصيد الأساسي)
// ==========================================
app.post('/api/tokens/pay-from-balance', (req, res) => {
    const { email, tokenName, tokenSymbol, funding } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

    const totalFees = 10 + (parseFloat(funding) || 0);
    if (user.usdBalance < totalFees) {
        return res.json({ success: false, message: `رصيدك الأساسي غير كافٍ! الرصيد: ${user.usdBalance.toFixed(2)}، المطلوب: ${totalFees.toFixed(2)}` });
    }

    // خصم الرسوم
    user.usdBalance -= totalFees;

    // تسجيل طلب العملة
    const tokenRequest = {
        id: "tok_" + Date.now(),
        name: tokenName,
        symbol: tokenSymbol,
        funding: funding || 0,
        totalFees,
        date: new Date().toISOString(),
        status: "تم الدفع وجاري الإنشاء"
    };
    user.tokenRequests.push(tokenRequest);
    pendingRequests.push({ 
        id: tokenRequest.id, 
        email, 
        type: 'طلب عملة', 
        amount: totalFees, 
        txHash: `دفع من الرصيد`, 
        status: 'جاري الإنشاء' 
    });

    res.json({
        success: true,
        message: `✅ تم خصم ${totalFees.toFixed(2)} USDT من رصيدك الأساسي. جاري إنشاء العملة ${tokenName} (${tokenSymbol}).`,
        newBalance: user.usdBalance
    });
});

// صنع العملة بالإثبات (الطريقة القديمة)
app.post('/api/tokens/create', (req, res) => {
    const { email, tokenName, tokenSymbol, funding, paymentProof } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

    const totalFees = 10 + (parseFloat(funding) || 0);
    const tokenRequest = {
        id: "tok_" + Date.now(),
        name: tokenName,
        symbol: tokenSymbol,
        funding: funding || 0,
        totalFees,
        paymentProof,
        date: new Date().toISOString(),
        status: "معلق بانتظار التحقق"
    };
    user.tokenRequests.push(tokenRequest);
    pendingRequests.push({ 
        id: tokenRequest.id, 
        email, 
        type: 'طلب عملة (إثبات)', 
        amount: totalFees, 
        txHash: paymentProof, 
        status: 'معلق' 
    });

    res.json({
        success: true,
        message: `تم استلام طلبك للعملة ${tokenName} مع الإثبات. سيتم مراجعته من الإدارة.`
    });
});


// ==========================================
// 7. الإعلانات الممولة (نشر حملة)
// ==========================================
app.post('/api/ads/create', (req, res) => {
    const { email, link, platform, views } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

    const cost = views * 0.005; // 0.005$ لكل مشاهدة
    if (user.usdBalance < cost) {
        return res.json({ success: false, message: `رصيدك الأساسي غير كافٍ! التكلفة: ${cost.toFixed(2)} USDT، رصيدك: ${user.usdBalance.toFixed(2)} USDT` });
    }

    // خصم التكلفة
    user.usdBalance -= cost;

    // إضافة الإعلان لقائمة الإعلانات المتاحة
    const adId = "ad_" + Date.now();
    availableAds.push({ _id: adId, link, platform, views, email, cost, status: 'نشط' });

    // تسجيل الطلب في المعلقات
    pendingRequests.push({ 
        id: adId, 
        email, 
        type: 'إعلان ممول', 
        amount: cost, 
        txHash: link, 
        status: 'نشط' 
    });

    res.json({
        success: true,
        message: `✅ تم تفعيل حملتك الإعلانية بنجاح! سيتم عرض رابطك للمستخدمين.`,
        newBalance: user.usdBalance
    });
});


// ==========================================
// 8. نقاط النهاية القديمة (محفوظة كما هي مع تعديلات طفيفة)
// ==========================================

// جلب عناوين المحافظ الرسمية
app.get('/api/wallets/info', (req, res) => {
    res.json(OFFICIAL_WALLETS);
});

// مشاهدة الإعلانات (الطريقة القديمة - تمنح جولة مجانية)
app.post('/api/watch-ad', (req, res) => {
    const { email } = req.body;
    const user = usersDatabase[email];
    if (!user) return res.json({ success: false, message: "يرجى تسجيل الدخول أولاً!" });

    if (availableAds.length === 0) {
        return res.json({ success: false, message: "الإعلانات غير متوفرة حالياً!" });
    }

    user.freeCasinoSpins += 1;
    res.json({ success: true, message: "تم منحك جولة كازينو مجانية!", freeSpinsLeft: user.freeCasinoSpins });
});

// النقر والتعدين اليدوي
app.post('/api/mining/click', (req, res) => {
    const { email } = req.body;
    const user = usersDatabase[email];
    if (user && user.miningEnergy >= 20) {
        user.miningEnergy -= 20;
        user.usdBalance += 0.01;
        return res.json({ success: true, newBalance: user.usdBalance, energy: user.miningEnergy });
    }
    res.json({ success: false, message: "طاقة التعدين نفدت أو الحساب غير موجود!" });
});

// تشغيل ألعاب الكازينو (العجلة - تبقى كما هي)
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

// طلب سحب الأرباح
app.post('/api/withdraw/submit', (req, res) => {
    const { email, amount } = req.body;
    const user = usersDatabase[email];
    if(!user || user.usdBalance < amount) return res.json({ success: false, message: "الرصيد غير كافٍ!" });
    
    user.usdBalance -= parseFloat(amount);
    pendingRequests.push({ id: "req_" + Date.now(), email, type: 'سحب أرباح', amount, txHash: 'تحويل يدوي معلق', status: 'معلق' });
    res.json({ success: true, message: "تم تسجيل طلب السحب. المعالجة تتم مرتين أسبوعياً." });
});

// إضافة إعلان مدفوع (الطريقة القديمة)
app.post('/api/ads/submit', (req, res) => {
    const { email, link, cost } = req.body;
    const newId = "ad_" + Date.now();
    availableAds.push({ _id: newId, link: link });
    pendingRequests.push({ id: newId, email, type: 'إعلان ممول', amount: cost, txHash: link, status: 'نشط' });
    res.json({ success: true, message: "تم تفعيل حملتك الإعلانية!" });
});


// ==========================================
// 9. لوحة التحكم الإدارية (Admin Dashboard)
// ==========================================
app.get('/api/admin/dashboard-data', (req, res) => {
    res.json({
        requests: pendingRequests,
        usersCount: Object.keys(usersDatabase).length,
        users: Object.values(usersDatabase).map(u => ({ 
            name: u.name, 
            email: u.email, 
            balance: u.usdBalance,
            casinoBalance: u.casinoBalance,
            phone: u.phone,
            verified: u.verified
        }))
    });
});

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
        pendingRequests.splice(index, 1);
        return res.json({ success: true, message: "تم تحديث الطلب." });
    }
    res.json({ success: false, message: "الطلب غير موجود." });
});

app.post('/api/admin/modify-balance', (req, res) => {
    const { email, newBalance } = req.body;
    if (usersDatabase[email]) {
        usersDatabase[email].usdBalance = parseFloat(newBalance);
        return res.json({ success: true, message: "تم تحديث رصيد الحساب." });
    }
    res.json({ success: false, message: "المستخدم غير موجود." });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 السيرفر يعمل على بورت ${PORT}`));
