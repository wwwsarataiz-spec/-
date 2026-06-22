const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
app.use(express.json());

// تشغيل ملفات الواجهات الأمامية التي قمنا بصنعها سابقاً تلقائياً
app.use(express.static(path.join(__dirname)));

// جلب المتغيرات السرية من إعدادات البيئة السحابية لحماية بياناتك
const TOKEN = process.env.TELEGRAM_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const WEB_APP_URL = process.env.WEB_APP_URL; // رابط موقعك على Render
const PORT = process.env.PORT || 3000;

// الاتصال بقاعدة بيانات MongoDB Atlas
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// تعريف هيكل بيانات المستخدم داخل قاعدة البيانات (Schema)
const UserSchema = new mongoose.Schema({
    telegramId: String,
    fullName: String,
    phone: String,
    email: String,
    balance: { type: Number, default: 0.00 },
    status: { type: String, default: 'active' } // active, frozen, banned
});
const User = mongoose.model('User', UserSchema);

// تشغيل البوت بنظام سحب البيانات المستمر (Polling) وهو الأسهل للهواتف
const bot = new TelegramBot(TOKEN, { polling: true });

// الخوارزمية الخلفية للبوت عند إرسال أمر /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    // التحقق مما إذا كان المستخدم مسجلاً مسبقاً في قاعدة البيانات
    let user = await User.findOne({ telegramId: chatId.toString() });
    
    if (user && user.status === 'banned') {
        return bot.sendMessage(chatId, "❌ نعتذر منك، تم حظر حسابك من قبل الإدارة لمخالفة الشروط.");
    }

    // إرسال رسالة ترحيبية فخمة تحتوي على زر يفتح تطبيق الويب مباشرة داخل تليجرام
    bot.sendMessage(chatId, `✨ أهلاً بك في منصة NEXORA الملكية الرقمية.\n\nاضغط على الزر أدناه لفتح واجهة الاستثمار، التعدين السحابي، وصالة الألعاب مباشرة من هاتفك!`, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🚀 فتح تطبيق الويب (Web App)", web_app: { url: WEB_APP_URL } }
                ]
            ]
        }
    });
});

// تشغيل السيرفر لاستضافة الصفحات
app.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
