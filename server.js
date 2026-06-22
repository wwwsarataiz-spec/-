const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// جلب المتغيرات السرية من بيئة Render
const TOKEN = process.env.TELEGRAM_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const WEB_APP_URL = process.env.WEB_APP_URL;
const PORT = process.env.PORT || 3000;

// الاتصال بقاعدة البيانات
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB Atlas Successfully!'))
    .catch(err => console.error('MongoDB error:', err));

// هيكل بيانات المستخدمين المطور لدعم الألعاب والمحفظة والتعدين
const UserSchema = new mongoose.Schema({
    telegramId: String,
    fullName: String,
    phone: String,
    balance: { type: Number, default: 0.00 },
    miningSpeed: { type: Number, default: 0.0050 }, // الأرباح في الساعة
    lastMiningClaim: { type: Date, default: Date.now },
    status: { type: String, default: 'active' } // active, frozen, banned
});
const User = mongoose.model('User', UserSchema);

// هيكل بيانات المعاملات المالية (إيداع وسحب)
const TransactionSchema = new mongoose.Schema({
    telegramId: String,
    type: String, // deposit, withdraw
    amount: Number,
    asset: String,
    status: { type: String, default: 'pending' }, // pending, approved, rejected
    createdAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', TransactionSchema);

// تشغيل البوت
const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    let user = await User.findOne({ telegramId: chatId.toString() });

    if (!user) {
        // إذا كان مستخدم جديد، يتم توجيهه لواجهة التسجيل أولاً
        bot.sendMessage(chatId, `✨ مرحباً بك في منصة NEXORA الملكية.\n\nيرجى فتح التطبيق لتسجيل حسابك وتفعيل محرك التعدين المجاني الخاص بك فوراً!`, {
            reply_markup: { inline_keyboard: [[{ text: "🔐 تسجيل الدخول / الاشتراك", web_app: { url: `${WEB_APP_URL}/login.html` } }]] }
        });
    } else {
        if (user.status === 'banned') return bot.sendMessage(chatId, "❌ تم حظر حسابك لمخالفة القوانين.");
        
        // إذا كان مسجل سابقاً، يفتح له الواجهة الرئيسية (التعدين) مباشرة
        bot.sendMessage(chatId, `🚀 أهلاً بعودتك يا ${user.fullName}!\nرصيدك الحالي: $${user.balance.toFixed(2)}\n\nاضغط أدناه للدخول إلى صالة الاستثمار والألعاب:`, {
            reply_markup: { inline_keyboard: [[{ text: "🏪 دخول المنصة الملكية", web_app: { url: `${WEB_APP_URL}/index.html` } }]] }
        });
    }
});

// --- المسارات البرمجية لربط واجهات الويب (API Endpoints) ---

// 1. مسار تسجيل حساب جديد
app.post('/api/register', async (req, res) => {
    const { telegramId, fullName, phone } = req.body;
    try {
        let user = await User.findOne({ telegramId });
        if (user) return res.status(400).json({ success: false, message: "الحساب مسجل بالفعل!" });

        user = new User({ telegramId, fullName, phone, balance: 1.00 }); // منح 1 دولار بونص ترحيبي
        await user.save();
        res.json({ success: true, message: "تم إنشاء الحساب بنجاح وتفعيل بونص $1" });
    } catch (err) {
        res.status(500).json({ success: false, message: "خطأ في السيرفر الداخلي" });
    }
});

// 2. مسار جلب بيانات المستخدم الفورية للواجهات
app.get('/api/user/:id', async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.params.id });
        if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 3. مسار تقديم طلب إيداع (المحفظة)
app.post('/api/deposit', async (req, res) => {
    const { telegramId, amount, asset } = req.body;
    try {
        const tx = new Transaction({ telegramId, type: 'deposit', amount, asset });
        await tx.save();
        res.json({ success: true, message: "تم رفع الإيصال، الطلب قيد المراجعة الإدارية الحالية." });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 4. مسار معالجة طلبات سحب الأموال الحقيقية والآمنة
app.post('/api/withdraw', async (req, res) => {
    const { telegramId, amount, address } = req.body;
    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            return res.status(404).json({ success: false, message: "⚠️ خطأ: الحساب غير مسجل بالنظام." });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "❌ سحب مرفوض: حسابك مجمد حالياً، راجع الإدارة." });
        }
        if (amount < 10) {
            return res.status(400).json({ success: false, message: "⚠️ الحد الأدنى للسحب هو 10 دولار." });
        }
        if (user.balance < amount) {
            return res.status(400).json({ success: false, message: "❌ خطأ: رصيدك الحالي غير كافٍ لإتمام العملية." });
        }

        // خصم المبلغ وتسجيل المعاملة معلقة
        user.balance -= amount;
        await user.save();

        const withdrawalTx = new Transaction({
            telegramId,
            type: 'withdraw',
            amount,
            asset: 'USDT_TRC20',
            status: 'pending'
        });
        await withdrawalTx.save();

        res.json({ 
            success: true, 
            message: `✅ تم تسجيل طلب السحب بنجاح!\nالمبلغ: $${amount}\nسيتم التحويل بعد تدقيق الإدارة.`,
            newBalance: user.balance
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "💥 خطأ داخلي أثناء معالجة السحب." });
    }
});

// 5. مسار تحديث الرصيد عند اللعب في الكازينو (فوز أو خسارة)
app.post('/api/casino/play', async (req, res) => {
    const { telegramId, cost, winAmount } = req.body;
    try {
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
        if (user.balance < cost) return res.status(400).json({ success: false, message: "عذراً رصيدك لا يكفي لتكلفة هذه اللعبة!" });

        // خصم التكلفة وإضافة الأرباح المكتسبة
        user.balance = user.balance - cost + winAmount;
        await user.save();

        res.json({ success: true, newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => console.log(`Backend Server running on port ${PORT}`));
