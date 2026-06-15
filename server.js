const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('تم الاتصال بنجاح'))
  .catch(err => console.error('خطأ:', err));

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  fullName: String,
  phoneNumber: String,
  points: { type: Number, default: 0 },
  isMining: { type: Boolean, default: false },
  miningStartedAt: Date,
  referredBy: String,
  lastDailyBonus: Date
});
const User = mongoose.model('User', userSchema);

// مسارات الويب
app.post('/api/register', async (req, res) => {
    try {
        const { telegramId, fullName, phoneNumber, referrerId } = req.body;
        let user = await User.findOne({ telegramId });
        if (user) return res.json({ success: true, message: 'أهلاً بعودتك!', user });
        user = new User({ telegramId, fullName, phoneNumber, points: 10, referredBy: referrerId });
        if (referrerId) await User.findOneAndUpdate({ telegramId: referrerId }, { $inc: { points: 1 } });
        await user.save();
        res.json({ success: true, message: 'تم التسجيل!', user });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ' }); }
});

// إعداد البوت
const bot = new Telegraf(BOT_TOKEN);
const registrationState = {};

bot.start(async (ctx) => {
  const chatId = ctx.chat.id.toString();
  let user = await User.findOne({ telegramId: chatId });
  if (user) return ctx.reply(`أهلاً بك يا ${user.fullName}!`, Markup.keyboard([['⛏️ ابدأ التعدين', '💰 مكافأة يومية'], ['🏆 لوحة الصدارة', '👤 حسابي']]).resize());
  registrationState[chatId] = { step: 'WAITING_FOR_NAME', referrerId: ctx.payload };
  ctx.reply('مرحباً في نكسورا! أرسل اسمك الثلاثي:');
});

// ميزة لوحة الصدارة
bot.hears('🏆 لوحة الصدارة', async (ctx) => {
    const topUsers = await User.find().sort({ points: -1 }).limit(5);
    let message = '🏆 **أغنى 5 مستخدمين في نكسورا:**\n\n';
    topUsers.forEach((u, index) => {
        message += `${index + 1}. ${u.fullName}: ${u.points.toFixed(2)} نقطة\n`;
    });
    ctx.replyWithMarkdown(message);
});

bot.hears('💰 مكافأة يومية', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    let user = await User.findOne({ telegramId: chatId });
    if (!user) return ctx.reply('يجب التسجيل أولاً.');
    const now = new Date();
    if (user.lastDailyBonus && (now - user.lastDailyBonus) < (24 * 60 * 60 * 1000)) {
        return ctx.reply('لقد حصلت على مكافأتك بالفعل! انتظر 24 ساعة.');
    }
    user.points += 20;
    user.lastDailyBonus = now;
    await user.save();
    ctx.reply('🎉 مبروك! حصلت على 20 نقطة هدية يومية.');
});

// ميزة حسابي
bot.hears('👤 حسابي', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.chat.id.toString() });
    if(user) ctx.reply(`رصيدك الحالي: ${user.points.toFixed(2)} نقطة.`);
});

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text.trim();
  const state = registrationState[chatId];
  if (state && state.step === 'WAITING_FOR_NAME') {
    registrationState[chatId].fullName = text;
    registrationState[chatId].step = 'WAITING_FOR_PHONE';
    return ctx.reply('شكراً. الآن أرسل رقم هاتفك:');
  }
  if (state && state.step === 'WAITING_FOR_PHONE') {
    try {
      const newUser = new User({ telegramId: chatId, fullName: registrationState[chatId].fullName, phoneNumber: text, points: 10, referredBy: registrationState[chatId].referrerId });
      await newUser.save();
      if (registrationState[chatId].referrerId) await User.findOneAndUpdate({ telegramId: registrationState[chatId].referrerId }, { $inc: { points: 1 } });
      delete registrationState[chatId];
      return ctx.reply('✅ تم التسجيل!', Markup.keyboard([['⛏️ ابدأ التعدين', '💰 مكافأة يومية'], ['🏆 لوحة الصدارة', '👤 حسابي']]).resize());
    } catch (e) { ctx.reply('خطأ، أرسل /start'); }
  }
});

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ: ${PORT}`));
