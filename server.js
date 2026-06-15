const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const mongoose = require('mongoose');

// إعداد الخادم
const app = express();
app.use(express.static('public'));
app.use(express.json());

// الاتصال بقاعدة البيانات
const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('تم الاتصال بقاعدة البيانات بنجاح'))
  .catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));

// تعريف هيكل المستخدم في البداية
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

// مسارات الويب
app.get('/test', (req, res) => {
    res.send('سيرفر نكسورا يعمل ويستضيف واجهة الويب بنجاح! 🚀');
});

app.post('/api/register', async (req, res) => {
    try {
        const { telegramId, username, fullName, phoneNumber } = req.body;
        if (!telegramId || !fullName || !phoneNumber) {
            return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة!' });
        }
        let user = await User.findOne({ telegramId });
        if (user) {
            return res.json({ success: true, message: 'مرحباً بعودتك!', user });
        }
        user = new User({ telegramId, username: username || 'لا يوجد', fullName, phoneNumber, points: 0, isMining: false });
        await user.save();
        res.json({ success: true, message: 'تم إنشاء حسابك في نكسورا بنجاح! 🚀', user });
    } catch (error) {
        console.error('خطأ في التسجيل:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في السيرفر.' });
    }
});

// إعداد البوت
if (!BOT_TOKEN) {
  console.error("خطأ: لم يتم تعيين TELEGRAM_BOT_TOKEN!");
  process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);
const registrationState = {};

bot.start(async (ctx) => {
  const chatId = ctx.chat.id.toString();
  let user = await User.findOne({ telegramId: chatId });
  if (user) {
    return ctx.reply(`أهلاً بك مجدداً يا ${user.fullName}!`, Markup.keyboard([['⛏️ ابدأ التعدين', '👤 حسابي']]).resize());
  }
  registrationState[chatId] = { step: 'WAITING_FOR_NAME' };
  ctx.reply('مرحباً في نكسورا! يرجى إدخال اسمك الثلاثي:');
});

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text.trim();
  const state = registrationState[chatId];

  if (state && state.step === 'WAITING_FOR_NAME') {
    registrationState[chatId].fullName = text;
    registrationState[chatId].step = 'WAITING_FOR_PHONE';
    return ctx.reply('شكراً. الآن يرجى إدخال رقم هاتفك:');
  }

  if (state && state.step === 'WAITING_FOR_PHONE') {
    try {
      const newUser = new User({
        telegramId: chatId,
        username: ctx.from.username || 'لا يوجد',
        fullName: registrationState[chatId].fullName,
        phoneNumber: text,
        points: 10
      });
      await newUser.save();
      delete registrationState[chatId];
      return ctx.reply('✅ تم التسجيل بنجاح!', Markup.keyboard([['⛏️ ابدأ التعدين', '👤 حسابي']]).resize());
    } catch (e) {
      ctx.reply('حدث خطأ، أرسل /start للمحاولة.');
    }
  }
});

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ: ${PORT}`));
