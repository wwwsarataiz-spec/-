const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).catch(err => console.error(err));

const User = mongoose.model('User', new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  fullName: String,
  points: { type: Number, default: 0 },
  isMining: { type: Boolean, default: false },
  miningStartedAt: Date,
  miningLevel: { type: Number, default: 1 }, // حقل جديد للمستوى
  lastDailyBonus: Date
}));

// --- المسارات ---
app.post('/api/status', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ success: false });
        
        let currentPoints = user.points;
        if (user.isMining) {
            const diffInHours = (new Date() - user.miningStartedAt) / (1000 * 60 * 60);
            const rates = { 1: 1, 2: 1.5, 3: 2 }; // معدلات الربح للمستويات
            currentPoints += (diffInHours * (rates[user.miningLevel] || 1));
        }
        res.json({ success: true, points: currentPoints.toFixed(2), miningLevel: user.miningLevel });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/upgrade', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        const costs = { 1: 100, 2: 300 }; // تكلفة الترقية للمستوى التالي
        
        if (user.miningLevel >= 3) return res.json({ success: false, message: 'وصلت للمستوى الأقصى!' });
        if (user.points < costs[user.miningLevel]) return res.json({ success: false, message: 'نقاط غير كافية!' });
        
        user.points -= costs[user.miningLevel];
        user.miningLevel += 1;
        await user.save();
        res.json({ success: true, message: '✅ تمت الترقية بنجاح!' });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- أوامر البوت ---
const bot = new Telegraf(BOT_TOKEN);
bot.start(async (ctx) => {
    ctx.reply('مرحباً في نكسورا! استخدم الأزرار:', Markup.keyboard([['⛏️ ابدأ التعدين', '💰 مكافأة يومية'], ['🏆 لوحة الصدارة', '👤 حسابي']]).resize());
});

// (باقي الأوامر تبقى كما هي...)
bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل...`));
