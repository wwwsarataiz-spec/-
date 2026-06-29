const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const JWT_SECRET = 'nexora_super_secret_key_2026';

function readDatabase() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        const initial = { users: [], pendingDeposits: [], nextId: 1, depositIdCounter: 1 };
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
        return initial;
    }
}

function writeDatabase(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ===== دالة حساب التعدين الآلي (معدل 0.004 لكل 86400 ثانية) =====
function calculateAutoMining(user) {
    const now = Date.now();
    const lastUpdate = user.lastAutoMiningUpdate || now;
    const elapsedSeconds = (now - lastUpdate) / 1000;
    const dailyMax = 0.004;
    const ratePerSecond = dailyMax / 86400;
    let additional = elapsedSeconds * ratePerSecond;
    let newEarnings = (user.miningEarnings || 0) + additional;
    if (newEarnings > dailyMax) newEarnings = dailyMax;
    user.miningEarnings = parseFloat(newEarnings.toFixed(8));
    user.lastAutoMiningUpdate = now;
    return user.miningEarnings;
}

// ===== التعدين اليدوي (نقرة) =====
router.post('/mine', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'غير مصرح' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        let db = readDatabase();
        const user = db.users.find(u => u.id === decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }
        // تحديث التعدين الآلي أولاً
        calculateAutoMining(user);
        // إضافة مكافأة النقرة (0.001) مع مراعاة الحد الأقصى
        const clickReward = 0.001;
        let newEarnings = user.miningEarnings + clickReward;
        if (newEarnings > 0.004) newEarnings = 0.004;
        user.miningEarnings = parseFloat(newEarnings.toFixed(8));
        user.lastAutoMiningUpdate = Date.now();
        writeDatabase(db);
        res.json({
            message: 'تم التعدين بنجاح',
            miningEarnings: user.miningEarnings,
            balance: user.balance,
            casinoBalance: user.casinoBalance,
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

// ===== حصاد الأرباح =====
router.post('/harvest', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'غير مصرح' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        let db = readDatabase();
        const user = db.users.find(u => u.id === decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }
        calculateAutoMining(user);
        if (user.miningEarnings <= 0) {
            return res.status(400).json({ message: 'لا توجد أرباح للحصاد' });
        }
        const harvestAmount = user.miningEarnings;
        user.balance = parseFloat((user.balance + harvestAmount).toFixed(8));
        user.transactions.push({
            type: 'harvest',
            amount: harvestAmount,
            status: 'completed',
            timestamp: new Date().toISOString(),
        });
        user.miningEarnings = 0;
        user.lastAutoMiningUpdate = Date.now();
        writeDatabase(db);
        res.json({
            message: 'تم الحصاد',
            balance: user.balance,
            casinoBalance: user.casinoBalance,
            miningEarnings: user.miningEarnings,
            transactions: user.transactions.slice(-10).reverse(),
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

module.exports = router;
module.exports.calculateAutoMining = calculateAutoMining;
