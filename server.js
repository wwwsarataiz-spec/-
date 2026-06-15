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
  .catch(err => console.error('خطأ في الاتصال:', err));

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  fullName: String,
  phoneNumber: String,
  points: { type: Number, default: 0 },
  isMining: { type: Boolean, default: false },
  miningStartedAt: Date,
  referredBy: String // إضافة حقل الإحالة
});
const User = mongoose.model('User', userSchema);

// مسار التسجيل (مع دعم الإحالات)
app.post('/api/register', async (req, res) => {
    try {
        const { telegramId, fullName, phoneNumber, referrerId } = req.body;
        let user = await User.findOne({ telegramId });
        if (user) return res.json({ success: true, message: 'مرحباً بعودتك!', user });
        
        user = new User({ telegramId, fullName, phoneNumber, points: 10, referredBy: referrerId });
        
        // مكافأة 1 نقطة للداعي (إحالة آمنة)
        if (referrerId) {
            await User.findOneAndUpdate({ telegramId: referrerId }, { $inc: { points: 1 } }); 
        }
        
        await user.save();
        res.json({ success: true, message: 'تم إنشاء حسابك بنجاح!', user });
    } catch (error) { res.status(500).json({ success: false, message: 'خطأ في السيرفر' }); }
});

// مسارات التعدين (كما هي)
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

// إعداد البوت
const bot = new Telegraf(BOT_TOKEN);
const registrationState = {};

bot.start(async (ctx) => {
  const chatId = ctx.chat.id.toString();
  // التحقق من وجود ID داعٍ في الرابط (مثال: /start 12345)
  const referrerId = ctx.payload; 
  
  let user = await User.findOne({ telegramId: chatId });
  if (user) return ctx.reply(`أهلاً بك يا ${user.fullName}! رصيدك: ${user.points.toFixed(2)}`, Markup.keyboard([['⛏️ ابدأ التعدين', '👤 حسابي']]).resize());
  
  registrationState[chatId] = { step: 'WAITING_FOR_NAME', referrerId };
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
      const newUser = new User({ 
        telegramId: chatId, 
        fullName: registrationState[chatId].fullName, 
        phoneNumber: text, 
        points: 10,
        referredBy: registrationState[chatId].referrerId 
      });
      await newUser.save();
      // إضافة المكافأة للداعي
      if (registrationState[chatId].referrerId) {
          await User.findOneAndUpdate({ telegramId: registrationState[chatId].referrerId }, { $inc: { points: 1 } });
      }
      delete registrationState[chatId];
      return ctx.reply('✅ تم التسجيل! وتمت إضافة مكافأة الإحالة (إن وجدت).', Markup.keyboard([['⛏️ ابدأ التعدين', '👤 حسابي']]).resize());
    } catch (e) { ctx.reply('خطأ، أرسل /start'); }
  }
});

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ: ${PORT}`));
