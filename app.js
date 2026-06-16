require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bot = require('./bot');
const { User } = require('./database');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- تشغيل البوت ---
bot.launch().then(() => console.log('🤖 Nexora Elite Bot is live!')).catch(console.error);

// --- توجيه الواجهة الأساسي ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- API إدارة المستخدمين والإيداع والسحب ---
app.post('/api/user-data', async (req, res) => {
    const { telegramId } = req.body;
    const user = await User.findOne({ telegramId });
    res.json(user || { error: 'User not found' });
});

app.post('/api/withdraw', async (req, res) => {
    const { telegramId, amount, wallet } = req.body;
    const user = await User.findOne({ telegramId });
    if (user && user.points >= amount) {
        user.points -= amount;
        user.pendingWithdrawals += amount;
        await user.save();
        res.json({ success: true, message: '✅ تم إرسال طلب السحب للإدارة.' });
    } else {
        res.json({ success: false, message: '❌ رصيد غير كافٍ.' });
    }
});

app.post('/api/deposit-notify', async (req, res) => {
    const { telegramId, amount } = req.body;
    // هنا نرسل إشعار للمدير عبر البوت
    bot.telegram.sendMessage("7018561132", `💰 إشعار إيداع جديد!\nالمستخدم: ${telegramId}\nالمبلغ: ${amount}`);
    res.json({ success: true, message: 'تم إخطار الإدارة بنجاح.' });
});

// --- API الإدارة (صلاحيات كاملة) ---
app.post('/api/admin-action', async (req, res) => {
    const { adminId, targetId, action, value } = req.body;
    if (adminId !== "7018561132") return res.status(403).json({ success: false });

    if (action === 'addPoints') {
        await User.findOneAndUpdate({ telegramId: targetId }, { $inc: { points: value } });
    }
    res.json({ success: true });
});

app.listen(process.env.PORT || 5000, () => console.log('🌐 السيرفر يعمل على المنفذ 5000...'));
