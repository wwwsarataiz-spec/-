const express = require('express');
const path = require('path');
const app = express();

// تفعيل قراءة البيانات القادمة بصيغة JSON
app.use(express.json());

// تشغيل وقراءة الملفات الثابتة من مجلد public بشكل صحيح ومباشر
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../public')));

// مسار أساسي لضمان عرض صفحة index.html فوراً عند فتح الرابط الرئيسي ومقاومة خطأ Cannot GET /
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.resolve(__dirname, '../public', 'index.html'), (err2) => {
                if (err2) {
                    res.status(500).send("ملف index.html غير موجود في مجلد public، يرجى التأكد من مساره في السيرفر!");
                }
            });
        }
    });
});

// قاعدة بيانات وهمية مؤقتة لحين ربط السيرفر بالكامل
let usersDatabase = {
    "7018561132": {
        usdBalance: 0.00,
        vipPlanLevel: 1,
        miningEnergy: 1000,
        freeCasinoSpins: 0
    }
};

let pendingRequests = [];
let availableAds = [
    { _id: "ad_001", title: "إعلان ممول 1", link: "https://t.me/NexoraBot" }
];

// ==========================================
// المسارات والـ APIs الخاصة بالمنصة
// ==========================================

// 1. مسار جلب وتحديث بيانات العميل
app.post('/api/user-data', (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) return res.status(400).json({ error: "Missing telegramId" });
    
    if (!usersDatabase[telegramId]) {
        usersDatabase[telegramId] = { usdBalance: 0.00, vipPlanLevel: 1, miningEnergy: 1000, freeCasinoSpins: 0 };
    }
    res.json(usersDatabase[telegramId]);
});

// 2. مسار النقر والتعدين اليدوي
app.post('/api/mining/click', (req, res) => {
    const { userId } = req.body;
    if (usersDatabase[userId]) {
        if (usersDatabase[userId].miningEnergy >= 20) {
            usersDatabase[userId].miningEnergy -= 20;
            usersDatabase[userId].usdBalance += 0.05;
            return res.json({ success: true, newBalance: usersDatabase[userId].usdBalance });
        }
    }
    res.json({ success: false, message: "فشلت المزامنة أو نفدت الطاقة" });
});

// 3. مسار جلب الإعلانات المتاحة
app.post('/api/get-ads', (req, res) => {
    res.json(availableAds);
});

// 4. مسار مشاهدة الإعلانات واحتساب الجولات المجانية
app.post('/api/watch-ad', (req, res) => {
    const { telegramId, adId } = req.body;
    if (!telegramId) return res.json({ success: false, message: "المستخدم غير معروف" });

    if (!usersDatabase[telegramId]) {
        usersDatabase[telegramId] = { usdBalance: 0.00, vipPlanLevel: 1, miningEnergy: 1000, freeCasinoSpins: 0 };
    }

    usersDatabase[telegramId].freeCasinoSpins += 1; 
    
    res.json({ 
        success: true, 
        message: "تمت مشاهدة الإعلان بنجاح! تم منحك جولة كازينو مجانية.",
        freeSpinsLeft: usersDatabase[telegramId].freeCasinoSpins
    });
});

// 5. مسار تشغيل ألعاب الكازينو الثلاثة (عجلة، سلوت، نرد)
app.post('/api/casino/play-game', (req, res) => {
    const { userId, gameId, riskLevel, betAmount } = req.body;
    const user = usersDatabase[userId];

    if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

    if (betAmount === 0) {
        if (user.freeCasinoSpins <= 0) {
            return res.json({ success: false, message: "لا تملك جولات مجانية! شاهد الإعلانات لشحنها." });
        }
        user.freeCasinoSpins -= 1;
    } else {
        if (user.usdBalance < betAmount) {
            return res.json({ success: false, message: "رصيدك الحالي غير كافٍ للرهان الحقيقي!" });
        }
        user.usdBalance -= betAmount;
    }

    let winChance = 0.5;
    if (riskLevel === 'low') winChance = 0.7;
    if (riskLevel === 'high') winChance = 0.25;

    const isWin = Math.random() < winChance;
    let prize = 0;

    if (isWin) {
        let multiplier = riskLevel === 'high' ? 3.0 : (riskLevel === 'medium' ? 1.5 : 1.1);
        prize = betAmount === 0 ? (Math.random() * 0.5) : (betAmount * multiplier);
        user.usdBalance += prize;
    }

    res.json({
        success: true,
        message: isWin ? `مبروك! لقد فزت بمبلغ ${prize.toFixed(3)} USDT` : "للأسف لم تحالفك الحظ في هذه الجولة، حاول مجدداً!",
        newBalance: user.usdBalance,
        freeSpinsLeft: user.freeCasinoSpins
    });
});

// 6. تقديم طلب إعلاني من معلن
app.post('/api/ads/submit', (req, res) => {
    const { userId, link, cost } = req.body;
    const newId = "ad_" + Date.now();
    availableAds.push({ _id: newId, title: "إعلان مدفوع", link: link });
    
    pendingRequests.push({ id: newId, userId, type: 'إعلان ممول', amount: cost, txHash: 'دفع معلق للتحقق' });
    res.json({ success: true, message: "تم تقديم طلب الإعلان، يرجى إرسال هاش التحويل في المحفظة لتفعيله." });
});

// 7. استقبال إشعارات الإيداع اليدوي
app.post('/api/deposit-notify', (req, res) => {
    const { telegramId, amount, txHash } = req.body;
    pendingRequests.push({
        id: "req_" + Date.now(),
        userId: telegramId,
        type: 'شحن رصيد',
        amount: amount,
        txHash: txHash
    });
    res.json({ success: true });
});

// 8. طلب سحب الأرباح
app.post('/api/withdraw/submit', (req, res) => {
    const { userId, amount } = req.body;
    const user = usersDatabase[userId];
    if(!user || user.usdBalance < amount) {
        return res.json({ success: false, message: "الرصيد غير كافٍ لإتمام عملية السحب!" });
    }
    
    user.usdBalance -= parseFloat(amount);
    pendingRequests.push({
        id: "req_" + Date.now(),
        userId: userId,
        type: 'سحب أرباح',
        amount: amount,
        txHash: 'قيد المراجعة الإدارية'
    });
    res.json({ success: true, message: "تم تسجيل طلب السحب بنجاح، وسيتم تحويله يدوياً بعد مراجعة الإدارة (حد أقصى مرتين أسبوعياً)." });
});

// ==========================================
// لوحة تحكم الإدارة الذاتية (Admin APIs)
// ==========================================

app.post('/api/admin/update-balance', (req, res) => {
    const { targetUserId, newBalance } = req.body;
    if (!usersDatabase[targetUserId]) {
        usersDatabase[targetUserId] = { usdBalance: 0.00, vipPlanLevel: 1, miningEnergy: 1000, freeCasinoSpins: 0 };
    }
    usersDatabase[targetUserId].usdBalance = parseFloat(newBalance);
    res.json({ success: true, message: `تم تحديث رصيد المستخدم بنجاح إلى ${newBalance} USDT` });
});

app.post('/api/admin/pending-requests', (req, res) => {
    res.json({ success: true, requests: pendingRequests });
});

app.post('/api/admin/process-request', (req, res) => {
    const { requestId, action } = req.body;
    const index = pendingRequests.findIndex(r => r.id === requestId);
    if (index !== -1) {
        const request = pendingRequests[index];
        if (action === 'approve' && request.type === 'شحن رصيد') {
            if (usersDatabase[request.userId]) {
                usersDatabase[request.userId].usdBalance += parseFloat(request.amount);
            }
        }
        pendingRequests.splice(index, 1);
        return res.json({ success: true, message: "تمت معالجة الطلب وتحديث بيانات العميل فوراً." });
    }
    res.json({ success: false, message: "الطلب غير موجود." });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`السيرفر يعمل بنجاح الآن على بورت: ${PORT}`);
});
