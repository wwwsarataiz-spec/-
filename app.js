require('dotenv').config();
const express = require('express');
const path = require('path');
const bot = require('./bot');
// استدعاء الموديلات المحدثة بالكامل من ملف قاعدة البيانات
const { User, Ad, AdLog, TransactionRequest } = require('./database');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const ADMIN_ID = "7018561132";

bot.launch().then(() => console.log('🤖 Bot is live!')).catch(console.error);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- ١. جلب بيانات المستخدم المحدثة ---
app.post('/api/user-data', async (req, res) => {
    const { telegramId } = req.body;
    try {
        let user = await User.findOne({ telegramId });
        if (!user) {
            return res.json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- ٢. إشعار الإيداع اليدوي المطور (حفظ المعاملة وإبلاغ الأدمن) ---
app.post('/api/deposit-notify', async (req, res) => {
    const { telegramId, coin, amount, txHash } = req.body;
    try {
        // إنشاء سجل طلب معلق في قاعدة البيانات لضمان عدم ضياع التعب والتوثيق اليدوي
        await TransactionRequest.create({
            userId: telegramId,
            type: 'deposit',
            amount: amount,
            txHash: txHash || 'لم يتم إدخال هاش',
            status: 'pending',
            details: `شحن عملة ${coin}`
        });

        // إرسال رسالة فورية لحسابك كآدمين للمراجعة
        await bot.telegram.sendMessage(ADMIN_ID, `💰 طلب إيداع جديد ينتظر موافقتك!\n👤 المستخدم: ${telegramId}\n🪙 العملة: ${coin}\n💵 المبلغ: ${amount}\n🔗 الهاش: ${txHash || 'لا يوجد'}\n\nيرجى مراجعة المعاملة وتفعيلها للمستخدم يدوياً عبر لوحة التحكم.`);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// --- ٣. نظام الإعلانات الحقيقي (جلب الإعلانات النشطة ذات الميزانية) ---
app.post('/api/get-ads', async (req, res) => {
    try {
        // السيرفر يبحث فقط عن الإعلانات المفعلة والتي لا تزال تملك ميزانية متبقية كافية
        const ads = await Ad.find({ isActive: true, remainingBudget: { $gte: 0.001 } });
        res.json(ads);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ads' });
    }
});

// --- ٤. مشاهدة الإعلان والربح الدقيق (0.001$) وخصمها من المعلن ---
app.post('/api/watch-ad', async (req, res) => {
    const { telegramId, adId } = req.body;
    try {
        const ad = await Ad.findById(adId);
        if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود أو انتهت صلاحيته' });
        if (ad.remainingBudget < 0.001) {
            ad.isActive = false;
            await ad.save();
            return res.json({ success: false, message: 'عذراً، نفذت ميزانية هذا الإعلان!' });
        }

        // منع تكرار مشاهدة نفس الإعلان من نفس الشخص لحمايتك
        const alreadyViewed = await AdLog.findOne({ telegramId, adId });
        if (alreadyViewed) return res.json({ success: false, message: 'لقد شاهدت هذا الإعلان بالفعل!' });

        // ١. خصم القيمة من ميزانية الإعلان المتبقية للمعلن وزيادة عداد المشاهدات
        ad.remainingBudget -= 0.001;
        ad.viewsCount += 1;
        if (ad.remainingBudget < 0.001) ad.isActive = false; // إيقافه تلقائياً إذا انتهت فلوسه
        await ad.save();

        // ٢. إضافة المكافأة الدقيقة لحساب المستخدم بالدولار الموثق بالسيرفر
        await User.findOneAndUpdate({ telegramId }, { $inc: { usdBalance: 0.001 } });
        
        // ٣. تسجيل اللوج لمنع التكرار
        await AdLog.create({ telegramId, adId });

        res.json({ success: true, message: '🎉 أحسنت! تمت مشاهدة الإعلان الحقيقي وإضافة 0.001$ إلى رصيدك بنجاح.' });
    } catch (error) {
        res.json({ success: false, message: 'خطأ في معالجة الإعلان' });
    }
});

// --- ٥. خوارزمية الكازينو الذكية المحمية (لصالح البوت) ---
function calculateCasinoResult(winChancePercentage) {
    const roll = Math.floor(Math.random() * 100) + 1;
    return roll <= winChancePercentage;
}

app.post('/api/casino/play-game', async (req, res) => {
    const { userId, gameId, riskLevel, betAmount } = req.body;

    try {
        const user = await User.findOne({ telegramId: userId });
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        // نظام الحماية من النقرات السريعة جداً (Anti-Spam)
        const now = new Date();
        if (user.lastCasinoPlay && (now - user.lastCasinoPlay) < 1500) {
            return res.status(429).json({ success: false, message: 'الرجاء التمهل! انتظر ثانية بين الجولات.' });
        }

        // إعدادات نسب الفوز المخفية (لصالح البوت دائماً)
        let winChance = 30; // افتراضي متوسط
        let multiplier = 1.5;

        if (riskLevel === 'low') {
            winChance = 40;   // اللاعب يربح 40% والبوت يربح 60%
            multiplier = 1.2; 
        } else if (riskLevel === 'medium') {
            winChance = 25;   // اللاعب يربح 25% والبوت يربح 75%
            multiplier = 1.8;
        } else if (riskLevel === 'high') {
            winChance = 10;   // اللاعب يربح 10% والبوت يربح 90% (شبه مستحيل)
            multiplier = 4.0;
        }

        let isFreeSpin = false;
        // إذا كان مبلغ الرهان 0 وكان يملك محاولات مجانية
        if (betAmount === 0 && user.freeCasinoSpins > 0) {
            isFreeSpin = true;
            user.freeCasinoSpins -= 1;
        } else {
            // اللعب بالرصيد الحقيقي المحمي بالسيرفر
            if (betAmount <= 0 || user.usdBalance < betAmount) {
                return res.status(400).json({ success: false, message: 'رصيد USDT الخاص بك غير كافٍ للرهان!' });
            }
            // خصم رهان المستخدم أولاً
            user.usdBalance -= betAmount;
        }

        // تشغيل الخوارزمية الرياضية
        const userWon = calculateCasinoResult(winChance);
        let msg = "";

        if (userWon) {
            if (isFreeSpin) {
                // الجولات المجانية تعطي نقاط بسيطة للمنصة (حماية لرصيدك الحقيقي)
                const pointsReward = Math.floor(Math.random() * 30) + 10;
                user.points += pointsReward;
                msg = `🎉 جولة مجانية موفقة! ربحت ${pointsReward} نقطة Nexora.`;
            } else {
                // فوز حقيقي بالدولار
                const prize = betAmount * multiplier;
                user.usdBalance += prize;
                msg = `🔥 تخمينك في محله! فزت بمبلغ $${prize.toFixed(3)} (مضاعف X${multiplier})`;
            }
        } else {
            msg = isFreeSpin ? "😢 جولة مجانية غير موفقة، حاول مجدداً!" : "📉 للأسف النتيجة لصالح البوت، حظاً أوفر في المرة القادمة.";
        }

        // تحديث بيانات التتبع والوقت لـمنع الثغرات
        user.totalCasinoPlayed += 1;
        user.lastCasinoPlay = now;
        await user.save();

        res.json({
            success: true,
            userWon: userWon,
            message: msg,
            freeSpinsLeft: user.freeCasinoSpins,
            newBalance: user.usdBalance,
            newPoints: user.points
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'خطأ في خوارزمية الكازينو الداخلي' });
    }
});

app.listen(process.env.PORT || 5000, () => console.log('🌐 Server is running safely on ports...'));
