require('dotenv').config();
const express = require('express');
const { mongoose } = require('./database');
const bot = require('./bot');
const { User } = require('./database');

const app = express();
app.use(express.static('public'));
app.use(express.json());

// API Status & Shop
app.post('/api/status', async (req, res) => {
    const user = await User.findOne({ telegramId: req.body.telegramId });
    res.json(user ? { success: true, points: user.points, miningLevel: user.miningLevel } : { success: false });
});

app.post('/api/shop', async (req, res) => {
    // منطق المتجر المدمج هنا...
});

bot.launch();
app.listen(process.env.PORT || 5000);
