require('dotenv').config();
const express = require('express');
const bot = require('./bot'); // استيراد البوت
const { User } = require('./database');

const app = express();
app.use(express.static('public'));
app.use(express.json());

// --- تشغيل البوت هنا ---
bot.launch().then(() => {
    console.log('🤖 البوت يعمل الآن...');
}).catch((err) => {
    console.error('❌ خطأ في تشغيل البوت:', err);
});

// وسيط حماية للتأكد من هوية المستخدم
const authMiddleware = async (req, res, next) => {
    const { telegramId } = req.body;
    const user = await User.findOne({ telegramId });
    if (!user) return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    req.user = user; 
    next();
};

// API المتجر محمية بـ authMiddleware
app.post('/api/shop', authMiddleware, async (req, res) => {
    const { item } = req.body;
    const user = req.user; 

    const prices = { 'level2': 200, 'level3': 500 };
    if (!prices[item]) return res.json({ success: false, message: 'عنصر غير موجود!' });
    
    if (user.points < prices[item]) return res.json({ success: false, message: 'نقاطك غير كافية!' });
    
    user.points -= prices[item];
    user.miningLevel = item === 'level2' ? 2 : 3;
    await user.save();
    
    console.log(`[LOG] تم شراء ${item} بواسطة ${user.telegramId}`);
    res.json({ success: true, message: '✅ تم شراء الترقية بنجاح!' });
});

app.listen(process.env.PORT || 5000, () => console.log('🌐 السيرفر يعمل مع الحماية...'));
