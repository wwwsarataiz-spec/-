require('dotenv').config();
const express = require('express');
const bot = require('./bot');
const { User } = require('./database');

const app = express();
app.use(express.static('public'));
app.use(express.json());

// API المتجر (ليربط الواجهة بقاعدة البيانات)
app.post('/api/shop', async (req, res) => {
    const { telegramId, item } = req.body;
    let user = await User.findOne({ telegramId });
    if (!user) return res.json({ success: false });

    const prices = { 'level2': 200, 'level3': 500 };
    const targetLevel = item === 'level2' ? 2 : 3;

    if (user.points < prices[item]) return res.json({ success: false, message: 'نقاطك غير كافية!' });
    
    user.points -= prices[item];
    user.miningLevel = targetLevel;
    await user.save();
    res.json({ success: true, message: '✅ تم شراء الترقية بنجاح!' });
});

// تشغيل البوت والسيرفر
bot.launch().then(() => console.log('🤖 البوت يعمل...'));
app.listen(process.env.PORT || 5000, () => console.log('🌐 السيرفر يعمل...'));
