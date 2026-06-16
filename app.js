require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bot = require('./bot');
const { User } = require('./database');

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

app.listen(process.env.PORT || 5000, () => console.log('🌐 Server is running...'));
