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

// ===== تحويل نقاط التعدين → رصيد الكازينو =====
router.post('/wallet/transfer-points-to-casino', (req, res) => {
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
        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'المبلغ غير صحيح' });
        }
        if (amount > user.points_balance) {
            return res.status(400).json({ message: 'رصيد نقاط التعدين غير كافٍ' });
        }
        user.points_balance = parseFloat((user.points_balance - amount).toFixed(4));
        user.casino_balance = parseFloat((user.casino_balance + amount).toFixed(4));
        user.transactions.push({
            type: 'transfer_points_to_casino',
            amount,
            status: 'completed',
            timestamp: new Date().toISOString(),
        });
        writeDatabase(db);
        res.json({
            message: 'تم تحويل النقاط إلى رصيد الكازينو',
            points_balance: user.points_balance,
            casino_balance: user.casino_balance,
            balance: user.balance,
            transactions: user.transactions.slice(-10).reverse(),
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

// ===== تحويل رصيد الكازينو → نقاط التعدين =====
router.post('/wallet/transfer-casino-to-points', (req, res) => {
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
        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'المبلغ غير صحيح' });
        }
        if (amount > user.casino_balance) {
            return res.status(400).json({ message: 'رصيد الكازينو غير كافٍ' });
        }
        user.casino_balance = parseFloat((user.casino_balance - amount).toFixed(4));
        user.points_balance = parseFloat((user.points_balance + amount).toFixed(4));
        user.transactions.push({
            type: 'transfer_casino_to_points',
            amount,
            status: 'completed',
            timestamp: new Date().toISOString(),
        });
        writeDatabase(db);
        res.json({
            message: 'تم تحويل رصيد الكازينو إلى نقاط التعدين',
            points_balance: user.points_balance,
            casino_balance: user.casino_balance,
            balance: user.balance,
            transactions: user.transactions.slice(-10).reverse(),
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

// ===== شراء نقاط (USDT → نقاط) =====
router.post('/wallet/buy-points', (req, res) => {
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
        const { usdtAmount } = req.body;
        if (!usdtAmount || isNaN(usdtAmount) || usdtAmount <= 0) {
            return res.status(400).json({ message: 'المبلغ غير صحيح' });
        }
        const exchangeRate = 10;
        const pointsToAdd = usdtAmount * exchangeRate;
        if (usdtAmount > user.balance) {
            return res.status(400).json({ message: 'رصيد USDT غير كافٍ' });
        }
        user.balance = parseFloat((user.balance - usdtAmount).toFixed(4));
        user.points_balance = parseFloat((user.points_balance + pointsToAdd).toFixed(4));
        user.transactions.push({
            type: 'buy_points',
            usdtAmount,
            pointsAdded: pointsToAdd,
            status: 'completed',
            timestamp: new Date().toISOString(),
        });
        writeDatabase(db);
        res.json({
            message: `تم شراء ${pointsToAdd} نقطة مقابل ${usdtAmount} USDT`,
            balance: user.balance,
            points_balance: user.points_balance,
            casino_balance: user.casino_balance,
            transactions: user.transactions.slice(-10).reverse(),
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

// ===== بيع نقاط (نقاط → USDT) مع عمولة 5% =====
router.post('/wallet/sell-points', (req, res) => {
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
        const { pointsAmount } = req.body;
        if (!pointsAmount || isNaN(pointsAmount) || pointsAmount <= 0) {
            return res.status(400).json({ message: 'المبلغ غير صحيح' });
        }
        if (pointsAmount > user.points_balance) {
            return res.status(400).json({ message: 'رصيد النقاط غير كافٍ' });
        }
        const exchangeRate = 10;
        let usdtBeforeCommission = pointsAmount / exchangeRate;
        const commission = usdtBeforeCommission * 0.05;
        const usdtAfterCommission = usdtBeforeCommission - commission;
        user.points_balance = parseFloat((user.points_balance - pointsAmount).toFixed(4));
        user.balance = parseFloat((user.balance + usdtAfterCommission).toFixed(4));
        user.transactions.push({
            type: 'sell_points',
            pointsSold: pointsAmount,
            usdtReceived: usdtAfterCommission,
            commission,
            status: 'completed',
            timestamp: new Date().toISOString(),
        });
        writeDatabase(db);
        res.json({
            message: `تم بيع ${pointsAmount} نقطة، استلمت ${usdtAfterCommission.toFixed(4)} USDT (بعد خصم 5% عمولة)`,
            balance: user.balance,
            points_balance: user.points_balance,
            casino_balance: user.casino_balance,
            transactions: user.transactions.slice(-10).reverse(),
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

// ===== جلب المعاملات =====
router.get('/wallet/transactions', (req, res) => {
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
        res.json({ transactions: user.transactions.slice(-10).reverse() });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

module.exports = router;
