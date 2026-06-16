require('dotenv').config();
const express = require('express');
const path = require('path');
const bot = require('./bot');
// قمت بإضافة Ad و AdLog إلى الاستيراد ليتم ربطهما بقاعدة البيانات
const { User, Ad, AdLog } = require('./database');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const ADMIN_ID = "7018561132"; // تم تثبيت الايدي الخاص بك

// --- تشغيل البوت ---
bot.launch().then(() => console.log('🤖 Nexora Elite Bot is live!')).catch(console.error);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- API إدارة المستخدمين والإيداع ---
app.post('/api/user-data', async (req, res) => {
    const { telegramId } = req.body;
    const user = await User.findOne({ telegramId });
    res.json(user || { error: 'User not found' });
});

app.post('/api/deposit-notify', async (req, res) => {
    const { telegramId, coin, amount } = req.body;
    bot.telegram.sendMessage(ADMIN_ID, `💰 إيداع جديد!\nالمستخدم: ${telegramId}\nالعملة: ${coin}\nالمبلغ: ${amount}`);
    res.json({ success: true, message: 'تم إخطار الإدارة بنجاح.' });
});

// --- إضافة نظام الإعلانات (إضافة برمجية جديدة) ---
app.post('/api/get-ads', async (req, res) => {
    const ads = await Ad.find({ isActive: true });
    res.json(ads);
});

app.post('/api/watch-ad', async (req, res) => {
    const { telegramId, adId } = req.body;
    
    // التحقق من سجل المشاهدات (حماية 24 ساعة)
    const lastView = await AdLog.findOne({ 
        telegramId, 
        adId, 
        viewedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    });
    
    if (lastView) return res.json({ success: false, message: 'لقد شاهدت هذا الإعلان مسبقاً اليوم.' });

    const ad = await Ad.findById(adId);
    if (!ad || ad.budget < ad.costPerView) return res.json({ success: false, message: 'الإعلان غير متاح حالياً.' });

    // خصم الرصيد من المعلن وإضافته للمستخدم
    ad.budget -= ad.costPerView;
    await ad.save();
    
    await User.findOneAndUpdate({ telegramId }, { $inc: { points: ad.costPerView } });
    await AdLog.create({ telegramId, adId });

    res.json({ success: true, message: 'تم إضافة المكافأة لرصيدك بنجاح!' });
});

app.listen(process.env.PORT || 5000, () => console.log('🌐 Server is running...'));
