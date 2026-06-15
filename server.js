const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const mongoose = require('mongoose');

// إعداد خادم Express وبوت تليجرام باستخدام المتغيرات البيئية Safe Environment
const app = express();
const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

// الاتصال بقاعدة البيانات MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('تم الاتصال بقاعدة البيانات بنجاح'))
  .catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));

// هيكل بيانات المستخدم (User Schema)
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

// التحقق من وجود توكن البوت لتفادي انهيار الخادم
if (!BOT_TOKEN) {
  console.error("خطأ: لم يتم تعيين TELEGRAM_BOT_TOKEN في المتغيرات البيئية!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// حالات التسجيل المؤقتة (حفظ مؤقت في الذاكرة أثناء التسجيل)
const registrationState = {};

// أمر البداية /start
bot.start(async (ctx) => {
  const chatId = ctx.chat.id.toString();
  
  try {
    // التحقق إذا كان المستخدم مسجلاً مسبقاً
    let user = await User.findOne({ telegramId: chatId });
    
    if (user) {
      return ctx.reply(`أهلاً بك مجدداً يا ${user.fullName} في منصة نكسورا! ✨\nرصيدك الحالي: ${user.points.toFixed(2)} نقطة.`, 
        Markup.keyboard([['⛏️ ابدأ التعدين', '👤 حسابي']]).resize()
      );
    }
    
    // إذا لم يكن مسجلاً، تبدأ مرحلة التسجيل خطوة بخطوة
    registrationState[chatId] = { step: 'WAITING_FOR_NAME' };
    await ctx.reply('مرحباً بك في منصة نكسورا (Nexora)! 🚀\nللبدء، يرجى إدخال اسمك الثلاثي:');
    
  } catch (error) {
    console.error(error);
    ctx.reply('حدث خطأ أثناء قراءة البيانات، يرجى المحاولة لاحقاً.');
  }
});

// استقبال النصوص لإكمال عملية التسجيل والتحكم بالتعدين
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text.trim();
  const state = registrationState[chatId];

  // 1. مرحلة استقبال الاسم
  if (state && state.step === 'WAITING_FOR_NAME') {
    registrationState[chatId].fullName = text;
    registrationState[chatId].step = 'WAITING_FOR_PHONE';
    return ctx.reply('شكراً لك. الآن يرجى إدخال رقم هاتفك (مع رمز الدولة):');
  }

  // 2. مرحلة استقبال رقم الهاتف وإتمام التسجيل
  if (state && state.step === 'WAITING_FOR_PHONE') {
    const fullName = registrationState[chatId].fullName;
    const phoneNumber = text;

    try {
      // حفظ المستخدم في قاعدة البيانات بشكل دائم حقيقي
      const newUser = new User({
        telegramId: chatId,
        username: ctx.from.username || 'لا يوجد',
        fullName: fullName,
        phoneNumber: phoneNumber,
        points: 10, // هدية ترحيبية عند التسجيل
        isMining: false
      });

      await newUser.save();
      delete registrationState[chatId]; // تنظيف الذاكرة المؤقتة

      return ctx.reply('✅ تم تسجيل حسابك بنجاح حقيقي ومؤمن في قاعدة البيانات! وتم منحك 10 نقاط هدية ترحيبية.', 
        Markup.keyboard([['⛏️ ابدأ التعدين', '👤 حسابي']]).resize()
      );

    } catch (error) {
      console.error(error);
      return ctx.reply('عذراً، حدث خطأ أثناء حفظ بياناتك. أرسل /start للمحاولة مجدداً.');
    }
  }

  // 3. التعامل مع أزرار القائمة الرئيسية بعد التسجيل
  try {
    const user = await User.findOne({ telegramId: chatId });
    if (!user) return; // منع غير المسجلين من استخدام الأزرار

    if (text === '👤 حسابي') {
      return ctx.reply(`👤 تفاصيل حسابك:\n\nالاسم: ${user.fullName}\nرقم الهاتف: ${user.phoneNumber}\nالرصيد الحالي: ${user.points.toFixed(2)} نقطة`);
    }

    if (text === '⛏️ ابدأ التعدين') {
      // هنا منطق التعدين المجاني (رويداً رويداً سنقوم بتطويره وتحديثه ليحسب النقاط بدقة متناهية بالوقت)
      if (user.isMining) {
        return ctx.reply('عملية التعدين المجاني تعمل بالفعل حالياً! انتظر لحين انتهاء الدورة لحصد النقاط.');
      }

      user.isMining = true;
      user.miningStartedAt = new Date();
      await user.save();

      return ctx.reply('⛏️ بدأت عملية التعدين المجاني بنجاح الآن! كود الـ Backend يعمل بشكل حقيقي ويراقب حسابك.');
    }

  } catch (error) {
    console.error(error);
  }
});

// تشغيل البوت سحابياً
bot.launch()
  .then(() => console.log('بوت تليجرام يعمل الآن بنجاح وبشكل حقيقي...'))
  .catch(err => console.error('فشل تشغيل البوت:', err));

// واجهة وهمية لتجعل استضافة Render/Koyeb تقبل تشغيل التطبيق كخادم ويب دائم دون إغلاقه
app.get('/', (req, res) => {
  res.send('Nexora Core Backend is Running Successfully!');
});

app.listen(PORT, () => {
  console.log(`خادم الويب يعمل على المنفذ: ${PORT}`);
});

// الإغلاق الآمن للبوت عند توقف السيرفر
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
