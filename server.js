const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = "7018561132"; 

mongoose.connect(MONGO_URI).catch(err => console.error(err));

const User = mongoose.model('User', new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  fullName: String,
  points: { type: Number, default: 0 },
  isMining: { type: Boolean, default: false },
  miningStartedAt: Date,
  miningLevel: { type: Number, default: 1 },
  lastDailyBonus: Date
}));

// --- المسارات (API) ---
app.post('/api/status', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ success: false });
        let currentPoints = user.points;
        if (user.isMining) {
            const diffInHours = (new Date() - user.miningStartedAt) / (1000 * 60 * 60);
            const rates = { 1: 1, 2: 1.5, 3: 2 };
            currentPoints += (diffInHours * (rates[user.miningLevel] || 1));
        }
        res.json({ success: true, points: currentPoints.toFixed(2), miningLevel: user.miningLevel });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/upgrade', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        const costs = { 1: 100, 2: 300 };
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
    ctx.reply('مرحباً في نكسورا! استخدم الأزرار:', 
    Markup.keyboard([
        ['⛏️ ابدأ التعدين', '💰 مكافأة يومية'], 
        ['🏆 لوحة الصدارة', '👤 حسابي'],
        ['📥 إيداع', '💸 سحب الأرباح']
    ]).resize());
});

// نظام الإيداع
bot.hears('📥 إيداع', (ctx) => ctx.reply('أرسل صورة إيصال التحويل للمراجعة.'));

bot.on('photo', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    bot.telegram.sendPhoto(ADMIN_ID, photoId, {
        caption: `طلب إيداع من ${chatId}\nقبول الإيداع؟`,
        ...Markup.inlineKeyboard([[Markup.button.callback('✅ قبول', `approve_${chatId}`), Markup.button.callback('❌ رفض', `reject_${chatId}`)]])
    });
    ctx.reply('تم إرسال طلبك للمراجعة.');
});

// نظام السحب
bot.hears('💸 سحب الأرباح', (ctx) => ctx.reply('لطلب السحب أرسل رسالة بالصيغة: /withdraw [رقم المحفظة] [المبلغ]'));

bot.command('withdraw', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('صيغة خاطئة! استخدم: /withdraw [محفظة] [مبلغ]');
    const [wallet, amount] = [parts[1], parts[2]];
    bot.telegram.sendMessage(ADMIN_ID, `💸 طلب سحب:\nالمستخدم: ${ctx.chat.id}\nالمحفظة: ${wallet}\nالمبلغ: ${amount}`, {
        ...Markup.inlineKeyboard([[Markup.button.callback('✅ تم التحويل', `pay_${ctx.chat.id}_${amount}`), Markup.button.callback('❌ رفض', `cancel_${ctx.chat.id}`)]])
    });
    ctx.reply('تم إرسال طلب السحب للإدارة.');
});

// أزرار الإدارة
bot.action(/approve_(.+)/, async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.match[1] }, { $inc: { points: 50 } });
    ctx.editMessageCaption('✅ تم قبول الإيداع.');
});

bot.action(/pay_(.+)_(.+)/, async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.match[1] }, { $inc: { points: -ctx.match[2] } });
    ctx.editMessageText('✅ تمت عملية السحب بنجاح.');
});

bot.action(/reject_(.+)|cancel_(.+)/, (ctx) => ctx.editMessageText('❌ تم رفض الطلب.'));

bot.hears('👤 حسابي', (ctx) => {
    const webLink = `https://nexora-backend-ko1u.onrender.com/?id=${ctx.chat.id}`;
    ctx.reply('إدارة حسابك:', Markup.inlineKeyboard([[Markup.button.webApp('🌐 افتح لوحة التحكم', webLink)]]));
});

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل...`));
