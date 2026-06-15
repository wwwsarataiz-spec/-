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
  lastDailyBonus: Date // حقل جديد لتاريخ آخر مكافأة
});
const User = mongoose.model('User', userSchema);

// مسارات الويب
app.post('/api/register', async (req, res) => {
    try {
        const { telegramId, fullName, phoneNumber, referrerId } = req.body;
        let user = await User.findOne({ telegramId });
        if (user) return res.json({ success: true, message: 'مرحباً بعودتك!', user });
        user = new User({ telegramId, fullName, phoneNumber, points: 10, referredBy: referrerId });
        if (referrerId) await User.findOneAndUpdate({ telegramId: referrerId }, { $inc: { points: 1 } });
        await user.save();
        res.json({ success: true, message: 'تم التسجيل!', user });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ' }); }
});

// مسارات التعدين (Mining)
app.post('/api/mine', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ success: false, message: 'غير موجود' });
        if (user.isMining) return res.json({ success: false, message: 'التعدين يعمل!' });
        user.isMining = true;
        user.miningStartedAt = new Date();
        await user.save();
        res.json({ success: true, message: '⛏️ بدأت عملية التعدين!' });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ' }); }
});

app.post('/api/collect', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user || !user.isMining) return res.status(400).json({ success: false, message: 'لا يوجد تعدين نشط' });
        const diffInHours = (new Date() - user.miningStartedAt) / (1000 * 60 * 60);
        user.points += (diffInHours * 5);
        user.isMining = false;
        await user.save();
        res.json({ success: true, totalPoints: user.points.toFixed(2) });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ' }); }
});

// إعداد البوت مع ميزة "المكافأة اليومية"
const bot = new Telegraf(BOT_TOKEN);
const registrationState = {};

bot.start(async (ctx) => {
  const chatId = ctx.chat.id.toString();
  let user = await User.findOne({ telegramId: chatId });
  if (user) return ctx.reply(`أهلاً بك يا ${user.fullName}!`, Markup.keyboard([['⛏️ ابدأ التعدين', '💰 مكافأة يومية', '👤 حسابي']]).resize());
  registrationState[chatId] = { step: 'WAITING_FOR_NAME', referrerId: ctx.payload };
  ctx.reply('مرحباً في نكسورا! أرسل اسمك الثلاثي:');
});

bot.hears('💰 مكافأة يومية', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    let user = await User.findOne({ telegramId: chatId });
    if (!user) return ctx.reply('يجب التسجيل أولاً.');
    
    const now = new Date();
    if (user.lastDailyBonus && (now - user.lastDailyBonus) < (24 * 60 * 60 * 1000)) {
        return ctx.reply('لقد حصلت على مكافأتك بالفعل! انتظر 24 ساعة.');
    }
    
    user.points += 20; // مكافأة 20 نقطة
    user.lastDailyBonus = now;
    await user.save();
    ctx.reply('🎉 مبروك! حصلت على 20 نقطة هدية يومية.');
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
      return ctx.reply('✅ تم التسجيل!', Markup.keyboard([['⛏️ ابدأ التعدين', '💰 مكافأة يومية', '👤 حسابي']]).resize());
    } catch (e) { ctx.reply('خطأ، أرسل /start'); }
  }
});

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ: ${PORT}`));
