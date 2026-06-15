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
  .then(() => console.log('تم الاتصال بقاعدة البيانات بنجاح'))
  .catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  fullName: String,
  phoneNumber: String,
  points: { type: Number, default: 0 },
  isMining: { type: Boolean, default: false },
  miningStartedAt: Date
});
const User = mongoose.model('User', userSchema);

// --- مسارات الويب ---
app.post('/api/register', async (req, res) => {
    try {
        const { telegramId, username, fullName, phoneNumber } = req.body;
        let user = await User.findOne({ telegramId });
        if (user) return res.json({ success: true, message: 'مرحباً بعودتك!', user });
        user = new User({ telegramId, username, fullName, phoneNumber, points: 10, isMining: false });
        await user.save();
        res.json({ success: true, message: 'تم إنشاء حسابك بنجاح!', user });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ في السيرفر' }); }
});

// مسار بدء التعدين
app.post('/api/mine', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ success: false, message: 'مستخدم غير موجود' });
        if (user.isMining) return res.json({ success: false, message: 'التعدين يعمل!' });
        user.isMining = true;
        user.miningStartedAt = new Date();
        await user.save();
        res.json({ success: true, message: '⛏️ بدأت عملية التعدين!' });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ في السيرفر' }); }
});

// مسار حصاد النقاط
app.post('/api/collect', async (req, res) => {
    try {
        const { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user || !user.isMining) return res.status(400).json({ success: false, message: 'لا يوجد تعدين نشط' });
        const diffInHours = (new Date() - user.miningStartedAt) / (1000 * 60 * 60);
        user.points += (diffInHours * 5); // زيادة 5 نقاط لكل ساعة
        user.isMining = false;
        await user.save();
        res.json({ success: true, totalPoints: user.points.toFixed(2) });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ في السيرفر' }); }
});

// --- إعداد البوت ---
const bot = new Telegraf(BOT_TOKEN);
const registrationState = {};

bot.start(async (ctx) => {
  const chatId = ctx.chat.id.toString();
  let user = await User.findOne({ telegramId: chatId });
  if (user) return ctx.reply(`أهلاً بك يا ${user.fullName}! رصيدك: ${user.points.toFixed(2)}`, Markup.keyboard([['⛏️ ابدأ التعدين', '👤 حسابي']]).resize());
  registrationState[chatId] = { step: 'WAITING_FOR_NAME' };
  ctx.reply('مرحباً في نكسورا! أرسل اسمك الثلاثي:');
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
      const newUser = new User({ telegramId: chatId, fullName: registrationState[chatId].fullName, phoneNumber: text, points: 10 });
      await newUser.save();
      delete registrationState[chatId];
      return ctx.reply('✅ تم التسجيل!', Markup.keyboard([['⛏️ ابدأ التعدين', '👤 حسابي']]).resize());
    } catch (e) { ctx.reply('خطأ، أرسل /start'); }
  }
});

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ: ${PORT}`));
