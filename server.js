const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(() => console.log('تم الاتصال بقاعدة البيانات')).catch(err => console.error(err));

const User = mongoose.model('User', new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  fullName: String,
  points: { type: Number, default: 0 },
  isMining: { type: Boolean, default: false },
  miningStartedAt: Date,
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
            currentPoints += (diffInHours * 5);
        }
        res.json({ success: true, points: currentPoints.toFixed(2), isMining: user.isMining });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/mine', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (user.isMining) return res.json({ success: false, message: 'التعدين يعمل بالفعل!' });
        user.isMining = true;
        user.miningStartedAt = new Date();
        await user.save();
        res.json({ success: true, message: '⛏️ بدأ التعدين!' });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/collect', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        const diffInHours = (new Date() - user.miningStartedAt) / (1000 * 60 * 60);
        user.points += (diffInHours * 5);
        user.isMining = false;
        await user.save();
        res.json({ success: true, totalPoints: user.points.toFixed(2) });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- البوت ---
const bot = new Telegraf(BOT_TOKEN);
bot.start(async (ctx) => {
    ctx.reply('مرحباً! استخدم الأزرار أدناه.', Markup.keyboard([['⛏️ ابدأ التعدين', '💰 مكافأة يومية'], ['🏆 لوحة الصدارة', '👤 حسابي']]).resize());
});

bot.hears('🏆 لوحة الصدارة', async (ctx) => {
    const topUsers = await User.find().sort({ points: -1 }).limit(5);
    let msg = '🏆 أغنى 5 مستخدمين:\n';
    topUsers.forEach((u, i) => msg += `${i+1}. ${u.fullName}: ${u.points.toFixed(2)}\n`);
    ctx.reply(msg);
});

bot.hears('👤 حسابي', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const webLink = `https://nexora-backend-ko1u.onrender.com/?id=${chatId}`;
    ctx.reply('إدارة حسابك:', Markup.inlineKeyboard([[Markup.button.webApp('🌐 افتح لوحة التحكم', webLink)]]));
});

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ ${PORT}`));
