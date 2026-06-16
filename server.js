const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = "7018561132"; // رقم تعريفك الخاص (المدير)

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

// --- أوامر البوت ---
const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
    ctx.reply('مرحباً في نكسورا! استخدم الأزرار:', 
    Markup.keyboard([
        ['⛏️ ابدأ التعدين', '💰 مكافأة يومية'], 
        ['🏆 لوحة الصدارة', '👤 حسابي'],
        ['📥 إيداع']
    ]).resize());
});

bot.hears('📥 إيداع', async (ctx) => {
    ctx.reply('لإتمام الإيداع، أرسل صورة إيصال التحويل (Screenshot) هنا، وسيقوم المدير بمراجعته.');
});

// استقبال صور الإيداع
bot.on('photo', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    // إرسال تنبيه للمدير
    bot.telegram.sendPhoto(ADMIN_ID, photoId, {
        caption: `طلب إيداع جديد من: ${chatId}\n\nهل تقبل الإيداع؟`,
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ قبول', `approve_${chatId}`), Markup.button.callback('❌ رفض', `reject_${chatId}`)]
        ])
    });
    ctx.reply('تم إرسال الإيصال للمراجعة، انتظر التأكيد.');
});

// التعامل مع أزرار الإدارة
bot.action(/approve_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    await User.findOneAndUpdate({ telegramId: userId }, { $inc: { points: 50 } }); 
    bot.telegram.sendMessage(userId, '✅ تم قبول الإيداع! تم إضافة 50 نقطة لرصيدك.');
    ctx.editMessageCaption('تم قبول الإيداع بنجاح.');
});

bot.action(/reject_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    bot.telegram.sendMessage(userId, '❌ تم رفض الإيداع. يرجى التأكد من بيانات التحويل.');
    ctx.editMessageCaption('تم رفض الإيداع.');
});

// الأوامر الأخرى (حسابي، تعدين، الخ..)
bot.hears('👤 حسابي', async (ctx) => {
    const webLink = `https://nexora-backend-ko1u.onrender.com/?id=${ctx.chat.id}`;
    ctx.reply('إدارة حسابك:', Markup.inlineKeyboard([[Markup.button.webApp('🌐 افتح لوحة التحكم', webLink)]]));
});

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل...`));
