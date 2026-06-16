require('dotenv').config();
const express = require('express');
const path = require('path');
const bot = require('./bot');
const { User, Ad, AdLog } = require('./database');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const ADMIN_ID = "7018561132";

bot.launch().then(() => console.log('🤖 Bot is live!')).catch(console.error);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/user-data', async (req, res) => {
    const { telegramId } = req.body;
    const user = await User.findOne({ telegramId });
    res.json(user || { error: 'User not found' });
});

app.post('/api/deposit-notify', async (req, res) => {
    const { telegramId, coin, amount } = req.body;
    try {
        await bot.telegram.sendMessage(ADMIN_ID, `💰 إيداع جديد!\nالمستخدم: ${telegramId}\nالعملة: ${coin}\nالمبلغ: ${amount}`);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/get-ads', async (req, res) => {
    const ads = await Ad.find({ isActive: true });
    res.json(ads);
});

app.post('/api/watch-ad', async (req, res) => {
    const { telegramId, adId } = req.body;
    const ad = await Ad.findById(adId);
    if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود' });
    
    await User.findOneAndUpdate({ telegramId }, { $inc: { points: ad.costPerView } });
    await AdLog.create({ telegramId, adId });
    res.json({ success: true, message: 'تمت إضافة الرصيد!' });
});

app.listen(process.env.PORT || 5000, () => console.log('🌐 Server is running...'));
