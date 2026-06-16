require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bot = require('./bot');
const { User } = require('./database');

const app = express();
app.use(express.json());

// --- إعدادات الملفات الثابتة ---
app.use(express.static('public'));
app.use(express.static(__dirname));

// --- تشغيل البوت ---
bot.launch().then(() => {
    console.log('🤖 البوت يعمل الآن...');
}).catch((err) => {
    console.error('❌ خطأ في تشغيل البوت:', err);
});

// --- حل مشكلة Not Found (توجيه ديناميكي) ---
app.get('/', (req, res) => {
    const publicPath = path.join(__dirname, 'public', 'index.html');
    const rootPath = path.join(__dirname, 'index.html');

    if (fs.existsSync(publicPath)) {
        res.sendFile(publicPath);
    } else if (fs.existsSync(rootPath)) {
        res.sendFile(rootPath);
    } else {
        res.status(404).send('❌ الملف index.html غير موجود في المجلد public أو المجلد الرئيسي.');
    }
});

// --- وسيط حماية ---
const authMiddleware = async (req, res, next) => {
    const { telegramId } = req.body;
    const user = await User.findOne({ telegramId });
    if (!user) return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    req.user = user; 
    next();
};

// --- API حفظ البيانات ---
app.post('/api/save-user', async (req, res) => {
    const { telegramId, fullName, phoneNumber } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { telegramId: telegramId.toString() },
            { fullName, phoneNumber },
            { new: true, upsert: true }
        );
        res.json({ success: true, message: '✅ تم حفظ بياناتك بنجاح!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
    }
});

// --- API المتجر ---
app.post('/api/shop', authMiddleware, async (req, res) => {
    const { item } = req.body;
    const user = req.user; 

    const prices = { 'level2': 200, 'level3': 500 };
    if (!prices[item]) return res.json({ success: false, message: 'عنصر غير موجود!' });
    if (user.points < prices[item]) return res.json({ success: false, message: 'نقاطك غير كافية!' });
    
    user.points -= prices[item];
    user.miningLevel = item === 'level2' ? 2 : 3;
    await user.save();
    res.json({ success: true, message: '✅ تم شراء الترقية بنجاح!' });
});

app.listen(process.env.PORT || 5000, () => console.log('🌐 السيرفر يعمل على المنفذ 5000...'));
