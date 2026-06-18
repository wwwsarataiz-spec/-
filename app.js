const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// ==========================================
// استيراد موديلات قاعدة البيانات
// ==========================================
const { 
    User, 
    Ad, 
    AdLog, 
    CasinoGame, 
    TransactionRequest,
    Transaction,
    Stats,
    AdminLog 
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// دروع الأمان
// ==========================================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// الحد من عدد الطلبات (100 طلب كل 15 دقيقة)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'تم تجاوز عدد الطلبات المسموح بها، حاول بعد 15 دقيقة.' }
});
app.use(limiter);

// ==========================================
// الاتصال بقاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
    .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// ==========================================
// إعداد البريد الإلكتروني (Nodemailer)
// ==========================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// مسار الدخول الرئيسي
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// ==========================================
// محفظة المنصة الرسمية
// ==========================================
const OFFICIAL_WALLETS = {
    trc20: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46",
    platform: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46",
    bnb: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46",
    sol: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46"
};

// ==========================================
// 1. منظومة الحسابات (مع تفعيل البريد الإلكتروني الحقيقي)
// ==========================================

// تسجيل حساب جديد مع إرسال رمز التحقق عبر البريد الإلكتروني
app.post('/api/auth/register', async (req, res) => {
    const { name, phone, email, password, telegramId } = req.body;
    
    if (!name || !email || !password) {
        return res.json({ success: false, message: "يرجى ملء جميع الحقول المطلوبة!" });
    }

    try {
        // التحقق من عدم تكرار البريد
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.json({ success: false, message: "هذا البريد الإلكتروني مسجل بالفعل!" });
        }

        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // توليد رمز تحقق عشوائي (6 أرقام)
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // صلاحية 10 دقائق

        // إنشاء المستخدم في قاعدة البيانات
        const newUser = new User({
            telegramId: telegramId || email,
            fullName: name,
            phoneNumber: phone || 'غير محدد',
            email: email,
            password: hashedPassword,
            usdBalance: 0.00,
            casinoBalance: 0.00,
            freeCasinoSpins: 2,
            miningEnergy: 1000,
            role: 'user',
            verified: false,
            verificationCode: verificationCode,
            codeExpiry: codeExpiry,
            vipPlanLevel: 1
        });

        await newUser.save();

        // إرسال البريد الإلكتروني مع رمز التحقق
        try {
            await transporter.sendMail({
                from: `"Nexora Elite" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "🔐 رمز تأكيد حساب Nexora Elite",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0c0e12; color: #e9e9f3; border: 1px solid #ffd700; border-radius: 16px;">
                        <h1 style="color: #ffd700; text-align: center;">Nexora Elite 💎</h1>
                        <p>مرحباً <strong>${name}</strong>،</p>
                        <p>شكراً لتسجيلك في Nexora Elite. يرجى استخدام الرمز التالي لتأكيد حسابك:</p>
                        <div style="text-align: center; padding: 20px; background: rgba(255,215,0,0.1); border-radius: 12px; margin: 20px 0;">
                            <span style="font-size: 36px; font-weight: 900; color: #ffd700; letter-spacing: 6px;">${verificationCode}</span>
                        </div>
                        <p>هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط.</p>
                        <p>إذا لم تقم بطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
                        <hr style="border-color: rgba(255,215,0,0.2); margin: 20px 0;">
                        <p style="text-align: center; color: #888; font-size: 12px;">Nexora Elite - منصة التعدين والكازينو الأقوى</p>
                    </div>
                `
            });
            console.log(`✅ تم إرسال رمز التحقق إلى ${email}`);
        } catch (emailError) {
            console.error('❌ فشل إرسال البريد:', emailError);
            // إذا فشل الإرسال، نعطي المستخدم رمزاً للاختبار (حتى لا يعلق)
        }

        res.json({
            success: true,
            message: "تم إنشاء الحساب! يرجى التحقق من بريدك الإلكتروني وإدخال رمز التفعيل.",
            email: email
        });

    } catch (error) {
        console.error('❌ خطأ في التسجيل:', error);
        res.json({ success: false, message: "حدث خطأ أثناء التسجيل، حاول مجدداً." });
    }
});

// تأكيد البريد الإلكتروني
app.post('/api/auth/verify-email', async (req, res) => {
    const { email, code } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });
        if (user.verified) return res.json({ success: false, message: "الحساب مفعل مسبقاً" });

        // التحقق من صلاحية الرمز
        if (user.codeExpiry && new Date() > new Date(user.codeExpiry)) {
            return res.json({ success: false, message: "انتهت صلاحية الرمز، يرجى طلب رمز جديد." });
        }

        if (user.verificationCode !== code) {
            return res.json({ success: false, message: "رمز التأكيد غير صحيح" });
        }

        // تفعيل الحساب
        user.verified = true;
        user.verificationCode = null;
        user.codeExpiry = null;
        await user.save();

        res.json({ success: true, message: "✅ تم تأكيد البريد بنجاح! تم منحك جولتين مجانيتين." });

    } catch (error) {
        console.error('❌ خطأ في التحقق:', error);
        res.json({ success: false, message: "حدث خطأ أثناء التحقق." });
    }
});

// تسجيل الدخول
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة!" });
        }

        if (!user.verified) {
            return res.json({ success: false, message: "الحساب غير مفعل، يرجى التحقق من بريدك الإلكتروني." });
        }

        // توليد JWT للمستخدم
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: "مرحباً بعودتك!",
            token,
            user: {
                id: user._id,
                name: user.fullName,
                email: user.email,
                role: user.role,
                usdBalance: user.usdBalance,
                casinoBalance: user.casinoBalance,
                freeSpins: user.freeCasinoSpins
            }
        });

    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول:', error);
        res.json({ success: false, message: "حدث خطأ أثناء تسجيل الدخول." });
    }
});

// استعادة الحساب
app.post('/api/auth/recover', async (req, res) => {
    const { email, phone } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user || user.phoneNumber !== phone) {
            return res.json({ success: false, message: "البيانات المدخلة لا تطابق أي حساب مسجل لدينا!" });
        }

        // توليد رمز جديد وإرساله عبر البريد
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = newCode;
        user.codeExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        try {
            await transporter.sendMail({
                from: `"Nexora Elite" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "🔐 إعادة تعيين كلمة المرور - Nexora Elite",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0c0e12; color: #e9e9f3; border: 1px solid #ffd700; border-radius: 16px;">
                        <h1 style="color: #ffd700; text-align: center;">Nexora Elite 💎</h1>
                        <p>مرحباً <strong>${user.fullName}</strong>،</p>
                        <p>لقد طلبت إعادة تعيين كلمة المرور. استخدم الرمز التالي لإعادة التعيين:</p>
                        <div style="text-align: center; padding: 20px; background: rgba(255,215,0,0.1); border-radius: 12px; margin: 20px 0;">
                            <span style="font-size: 36px; font-weight: 900; color: #ffd700; letter-spacing: 6px;">${newCode}</span>
                        </div>
                        <p>هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط.</p>
                        <hr style="border-color: rgba(255,215,0,0.2); margin: 20px 0;">
                        <p style="text-align: center; color: #888; font-size: 12px;">Nexora Elite - منصة التعدين والكازينو الأقوى</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('فشل إرسال البريد:', emailError);
        }

        res.json({ success: true, message: "تم إرسال رمز إعادة التعيين إلى بريدك الإلكتروني." });

    } catch (error) {
        console.error('❌ خطأ في الاستعادة:', error);
        res.json({ success: false, message: "حدث خطأ أثناء عملية الاستعادة." });
    }
});

// ==========================================
// 2. جلب بيانات المستخدم
// ==========================================
app.post('/api/user-data', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ error: "المستخدم غير موجود" });

        res.json({
            usdBalance: user.usdBalance,
            casinoBalance: user.casinoBalance,
            watchedAdsCount: user.watchedAdsCount || 0,
            freeSpins: user.freeCasinoSpins,
            name: user.fullName,
            role: user.role
        });

    } catch (error) {
        console.error('❌ خطأ في جلب البيانات:', error);
        res.json({ error: "حدث خطأ في جلب البيانات" });
    }
});

// ==========================================
// 3. المكافأة اليومية
// ==========================================
app.post('/api/bonus/daily-claim', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
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
        await user.save();

        res.json({ success: true, message: "تم منحك جولة مجانية في الكازينو!", freeSpins: user.freeCasinoSpins });

    } catch (error) {
        console.error('❌ خطأ في المكافأة:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// ==========================================
// 4. نظام الإعلانات الممولة
// ==========================================
const ADS_FOR_POINT = 15;
const POINT_VALUE = 0.01;

app.post('/api/ads/watch', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        // حماية البوتات: 10 ثوانٍ بين الإعلانات
        const now = Date.now();
        if (now - (user.lastAdTime || 0) < 10000) {
            return res.json({ success: false, message: "يرجى الانتظار 10 ثوانٍ بين كل إعلان وآخر." });
        }
        user.lastAdTime = now;

        // التحقق من وجود إعلانات متاحة
        const ads = await Ad.find({ isActive: true });
        if (ads.length === 0) {
            return res.json({ success: false, message: "لا توجد إعلانات حالياً، حاول لاحقاً." });
        }

        // زيادة العداد
        user.watchedAdsCount = (user.watchedAdsCount || 0) + 1;
        let pointEarned = false;

        // إذا وصل للعدد المطلوب، نمنح نقطة كازينو
        if (user.watchedAdsCount >= ADS_FOR_POINT) {
            user.casinoBalance = (user.casinoBalance || 0) + POINT_VALUE;
            user.watchedAdsCount = 0;
            pointEarned = true;
        }

        await user.save();

        res.json({
            success: true,
            message: pointEarned 
                ? `🎉 أكملت ${ADS_FOR_POINT} إعلاناً وحصلت على ${POINT_VALUE}$ في رصيد الكازينو!` 
                : `✅ تم احتساب الإعلان. تبقى ${ADS_FOR_POINT - user.watchedAdsCount} إعلاناً للنقطة القادمة.`,
            watchedAdsCount: user.watchedAdsCount,
            casinoBalance: user.casinoBalance,
            pointEarned
        });

    } catch (error) {
        console.error('❌ خطأ في الإعلانات:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// ==========================================
// 5. ألعاب الكازينو
// ==========================================

// 5.1 لعبة الهامش
app.post('/api/casino/margin', async (req, res) => {
    const { email, amount, chosenPercentage } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        if (user.casinoBalance < amount) {
            return res.json({ success: false, message: "رصيد الكازينو غير كافٍ! شاهد إعلانات للحصول على نقاط." });
        }

        user.casinoBalance -= amount;
        const rollResult = Math.floor(Math.random() * 100) + 1;
        let win = false;
        let profit = 0;

        const effectivePercentage = chosenPercentage * 0.95;
        if (rollResult <= effectivePercentage) {
            win = true;
            profit = amount * (effectivePercentage / 100);
            user.casinoBalance += profit;
        } else {
            win = false;
            profit = -amount;
        }

        await user.save();

        res.json({
            success: true,
            win,
            rollResult,
            profit,
            newBalance: user.casinoBalance,
            message: win ? `فوز! ربحت ${profit.toFixed(2)}$` : `خسارة! خسرت ${amount.toFixed(2)}$`
        });

    } catch (error) {
        console.error('❌ خطأ في لعبة الهامش:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// 5.2 لعبة العجلة
app.post('/api/casino/play-game', async (req, res) => {
    const { email, betAmount, riskLevel } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "خطأ في الحساب" });

        let prize = 0;
        let isWin = false;

        if (betAmount === 0) {
            if (user.freeCasinoSpins <= 0) {
                return res.json({ success: false, message: "لا تملك جولات مجانية" });
            }
            user.freeCasinoSpins -= 1;
        } else {
            if (user.usdBalance < betAmount) {
                return res.json({ success: false, message: "الرصيد الحالي غير كافٍ" });
            }
            user.usdBalance -= betAmount;
        }

        const winChance = riskLevel === 'low' ? 0.65 : 0.30;
        isWin = Math.random() < winChance;

        if (isWin) {
            prize = betAmount === 0 ? 0.20 : betAmount * 2;
            user.usdBalance += prize;
        }

        await user.save();

        res.json({
            success: true,
            isWin,
            prize,
            newBalance: user.usdBalance,
            freeSpinsLeft: user.freeCasinoSpins
        });

    } catch (error) {
        console.error('❌ خطأ في لعبة العجلة:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// 5.3 لعبة النرد
app.post('/api/casino/dice', async (req, res) => {
    const { email, bet, guess } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        if (user.casinoBalance < bet) {
            return res.json({ success: false, message: "رصيد الكازينو غير كافٍ!" });
        }

        user.casinoBalance -= bet;
        const roll = Math.floor(Math.random() * 6) + 1;
        let win = false;
        let profit = 0;

        if (guess === 'even' && roll % 2 === 0) { win = true; profit = bet * 2; }
        else if (guess === 'odd' && roll % 2 !== 0) { win = true; profit = bet * 2; }
        else if (parseInt(guess) === roll) { win = true; profit = bet * 6; }

        if (win) {
            user.casinoBalance += profit;
        } else {
            profit = -bet;
        }

        await user.save();

        res.json({
            success: true,
            win,
            roll,
            profit,
            newBalance: user.casinoBalance,
            message: win ? `فوز! الرقم: ${roll}` : `خسارة! الرقم: ${roll}`
        });

    } catch (error) {
        console.error('❌ خطأ في لعبة النرد:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// ==========================================
// 6. صنع العملة
// ==========================================
app.post('/api/tokens/pay-from-balance', async (req, res) => {
    const { email, tokenName, tokenSymbol, funding } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        const totalFees = 10 + (parseFloat(funding) || 0);
        if (user.usdBalance < totalFees) {
            return res.json({ success: false, message: `رصيدك الأساسي غير كافٍ! الرصيد: ${user.usdBalance.toFixed(2)}، المطلوب: ${totalFees.toFixed(2)}` });
        }

        user.usdBalance -= totalFees;
        await user.save();

        // تسجيل طلب العملة في المعاملات
        const transaction = new Transaction({
            userId: user._id,
            type: 'withdrawal',
            amount: totalFees,
            txHash: `دفع من الرصيد - ${tokenName}`,
            status: 'approved',
            note: `إنشاء عملة ${tokenName} (${tokenSymbol})`
        });
        await transaction.save();

        res.json({
            success: true,
            message: `✅ تم خصم ${totalFees.toFixed(2)} USDT من رصيدك الأساسي. جاري إنشاء العملة ${tokenName} (${tokenSymbol}).`,
            newBalance: user.usdBalance
        });

    } catch (error) {
        console.error('❌ خطأ في صنع العملة:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

app.post('/api/tokens/create', async (req, res) => {
    const { email, tokenName, tokenSymbol, funding, paymentProof } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        const totalFees = 10 + (parseFloat(funding) || 0);
        const transaction = new Transaction({
            userId: user._id,
            type: 'withdrawal',
            amount: totalFees,
            txHash: paymentProof,
            status: 'pending',
            note: `طلب إنشاء عملة ${tokenName} (${tokenSymbol})`
        });
        await transaction.save();

        res.json({
            success: true,
            message: `تم استلام طلبك للعملة ${tokenName} مع الإثبات. سيتم مراجعته من الإدارة.`
        });

    } catch (error) {
        console.error('❌ خطأ في طلب العملة:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// ==========================================
// 7. الإعلانات الممولة (نشر حملة)
// ==========================================
app.post('/api/ads/create', async (req, res) => {
    const { email, link, platform, views } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        const cost = views * 0.005;
        if (user.usdBalance < cost) {
            return res.json({ success: false, message: `رصيدك الأساسي غير كافٍ! التكلفة: ${cost.toFixed(2)} USDT، رصيدك: ${user.usdBalance.toFixed(2)} USDT` });
        }

        user.usdBalance -= cost;
        await user.save();

        const newAd = new Ad({
            link: link,
            totalBudget: cost,
            remainingBudget: cost,
            costPerView: 0.005,
            totalViewsRequired: views,
            isActive: true,
            advertiserId: user._id.toString()
        });
        await newAd.save();

        res.json({
            success: true,
            message: `✅ تم تفعيل حملتك الإعلانية بنجاح! سيتم عرض رابطك للمستخدمين.`,
            newBalance: user.usdBalance
        });

    } catch (error) {
        console.error('❌ خطأ في إنشاء الإعلان:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// ==========================================
// 8. نقاط النهاية الأخرى
// ==========================================

// جلب عناوين المحافظ
app.get('/api/wallets/info', (req, res) => {
    res.json(OFFICIAL_WALLETS);
});

// مشاهدة الإعلانات (الطريقة القديمة)
app.post('/api/watch-ad', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "يرجى تسجيل الدخول أولاً!" });

        const ads = await Ad.find({ isActive: true });
        if (ads.length === 0) {
            return res.json({ success: false, message: "الإعلانات غير متوفرة حالياً!" });
        }

        user.freeCasinoSpins += 1;
        await user.save();

        res.json({ success: true, message: "تم منحك جولة كازينو مجانية!", freeSpinsLeft: user.freeCasinoSpins });

    } catch (error) {
        console.error('❌ خطأ:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// التعدين
app.post('/api/mining/click', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        if (user.miningEnergy >= 20) {
            user.miningEnergy -= 20;
            user.usdBalance = (user.usdBalance || 0) + 0.01;
            await user.save();
            return res.json({ success: true, newBalance: user.usdBalance, energy: user.miningEnergy });
        }

        res.json({ success: false, message: "طاقة التعدين نفدت!" });

    } catch (error) {
        console.error('❌ خطأ في التعدين:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// الإيداع
app.post('/api/deposit-notify', async (req, res) => {
    const { email, amount, txHash } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        const transaction = new Transaction({
            userId: user._id,
            type: 'deposit',
            amount: parseFloat(amount),
            txHash: txHash,
            status: 'pending'
        });
        await transaction.save();

        res.json({ success: true, message: "تم إرسال إثبات الإيداع، وسيتم مراجعته من الإدارة فوراً." });

    } catch (error) {
        console.error('❌ خطأ في الإيداع:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// السحب
app.post('/api/withdraw/submit', async (req, res) => {
    const { email, amount } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        if (user.usdBalance < amount) {
            return res.json({ success: false, message: "الرصيد غير كافٍ!" });
        }

        user.usdBalance -= parseFloat(amount);
        await user.save();

        const transaction = new Transaction({
            userId: user._id,
            type: 'withdrawal',
            amount: parseFloat(amount),
            status: 'pending'
        });
        await transaction.save();

        res.json({ success: true, message: "تم تسجيل طلب السحب. سيتم معالجته خلال 24 ساعة." });

    } catch (error) {
        console.error('❌ خطأ في السحب:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// إضافة إعلان (قديم)
app.post('/api/ads/submit', async (req, res) => {
    const { email, link, cost } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        const newAd = new Ad({
            link: link,
            totalBudget: parseFloat(cost),
            remainingBudget: parseFloat(cost),
            costPerView: 0.001,
            isActive: true,
            advertiserId: user._id.toString()
        });
        await newAd.save();

        res.json({ success: true, message: "تم تفعيل حملتك الإعلانية!" });

    } catch (error) {
        console.error('❌ خطأ:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// ==========================================
// 9. الإحصائيات العامة (API جديد)
// ==========================================
app.get('/api/stats/overview', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        
        const deposits = await Transaction.aggregate([
            { $match: { type: 'deposit', status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const withdrawals = await Transaction.aggregate([
            { $match: { type: 'withdrawal', status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({
            success: true,
            totalUsers,
            totalDeposits: deposits[0]?.total || 0,
            totalWithdrawals: withdrawals[0]?.total || 0
        });

    } catch (error) {
        console.error('❌ خطأ في الإحصائيات:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// ==========================================
// 10. إدارة الصلاحيات (للإدارة فقط)
// ==========================================

// إضافة مدير جديد
app.post('/api/admin/add-role', async (req, res) => {
    const { adminPassword, targetUserId, role } = req.body;

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.json({ success: false, message: 'رمز المدير غير صحيح' });
    }

    const allowedRoles = ['admin', 'manager', 'assistant'];
    if (!allowedRoles.includes(role)) {
        return res.json({ success: false, message: 'صلاحية غير صالحة' });
    }

    try {
        const user = await User.findOne({ telegramId: targetUserId });
        if (!user) return res.json({ success: false, message: 'المستخدم غير موجود' });

        user.role = role;
        await user.save();

        await AdminLog.create({
            adminId: 'system',
            action: `add_${role}`,
            targetId: targetUserId,
            details: `تمت إضافة صلاحية ${role} للمستخدم ${targetUserId}`
        });

        res.json({ success: true, message: `تمت إضافة صلاحية ${role} بنجاح` });

    } catch (error) {
        console.error('❌ خطأ في إضافة الصلاحية:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// حذف صلاحية مدير
app.post('/api/admin/remove-role', async (req, res) => {
    const { adminPassword, targetUserId } = req.body;

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.json({ success: false, message: 'رمز المدير غير صحيح' });
    }

    try {
        const user = await User.findOne({ telegramId: targetUserId });
        if (!user) return res.json({ success: false, message: 'المستخدم غير موجود' });

        if (user.role === 'admin' && user.telegramId === process.env.ADMIN_ID) {
            return res.json({ success: false, message: 'لا يمكن حذف صلاحية المدير الرئيسي' });
        }

        user.role = 'user';
        await user.save();

        await AdminLog.create({
            adminId: 'system',
            action: 'remove_role',
            targetId: targetUserId,
            details: `تمت إزالة صلاحيات المستخدم ${targetUserId}`
        });

        res.json({ success: true, message: 'تمت إزالة الصلاحيات بنجاح' });

    } catch (error) {
        console.error('❌ خطأ في حذف الصلاحية:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// تغيير رمز المدير
app.post('/api/admin/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (oldPassword !== process.env.ADMIN_PASSWORD) {
        return res.json({ success: false, message: 'رمز المدير الحالي غير صحيح' });
    }

    process.env.ADMIN_PASSWORD = newPassword;
    res.json({ success: true, message: 'تم تغيير رمز المدير بنجاح' });
});

// ==========================================
// 11. لوحة التحكم الإدارية (Admin Dashboard)
// ==========================================
app.get('/api/admin/dashboard-data', async (req, res) => {
    try {
        const users = await User.find();
        const transactions = await Transaction.find();
        const requests = await Transaction.find({ status: 'pending' });

        res.json({
            requests: requests,
            usersCount: users.length,
            users: users.map(u => ({
                name: u.fullName,
                email: u.email,
                balance: u.usdBalance,
                casinoBalance: u.casinoBalance,
                phone: u.phoneNumber,
                verified: u.verified,
                role: u.role
            }))
        });

    } catch (error) {
        console.error('❌ خطأ في لوحة التحكم:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

app.post('/api/admin/process-request', async (req, res) => {
    const { requestId, action } = req.body;

    try {
        const transaction = await Transaction.findById(requestId);
        if (!transaction) return res.json({ success: false, message: "الطلب غير موجود" });

        if (action === 'approve') {
            transaction.status = 'approved';
            if (transaction.type === 'deposit') {
                const user = await User.findById(transaction.userId);
                if (user) {
                    user.usdBalance += transaction.amount;
                    await user.save();
                }
            }
        } else {
            transaction.status = 'rejected';
        }

        await transaction.save();
        res.json({ success: true, message: "تم تحديث الطلب." });

    } catch (error) {
        console.error('❌ خطأ في معالجة الطلب:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

app.post('/api/admin/modify-balance', async (req, res) => {
    const { email, newBalance } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });

        user.usdBalance = parseFloat(newBalance);
        await user.save();

        res.json({ success: true, message: "تم تحديث رصيد الحساب." });

    } catch (error) {
        console.error('❌ خطأ في تعديل الرصيد:', error);
        res.json({ success: false, message: "حدث خطأ" });
    }
});

// ==========================================
// تشغيل الخادم
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على بورت ${PORT}`);
});
