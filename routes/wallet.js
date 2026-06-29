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

// ===== التحويل إلى الكازينو =====
router.post('/wallet/transfer-to-casino', (req, res) => {
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
            return res.status(400).json({ message: 'مبلغ غير صحيح' });
        }
        if (amount > user.balance) {
            return res.status(400).json({ message: 'رصيد غير كافٍ' });
        }
        user.balance = parseFloat((user.balance - amount).toFixed(8));
        user.casinoBalance = parseFloat((user.casinoBalance + amount).toFixed(8));
        user.transactions.push({
            type: 'transfer_to_casino',
            amount,
            status: 'completed',
            timestamp: new Date().toISOString(),
        });
        writeDatabase(db);
        res.json({
            message: 'تم التحويل للكازينو',
            balance: user.balance,
            casinoBalance: user.casinoBalance,
            transactions: user.transactions.slice(-10).reverse(),
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

// ===== طلب السحب (الحد الأدنى 4 USDT) =====
router.post('/wallet/withdraw', (req, res) => {
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
        const { walletAddress, amount } = req.body;
        if (!walletAddress || walletAddress.trim() === '') {
            return res.status(400).json({ message: 'عنوان المحفظة مطلوب' });
        }
        if (!amount || isNaN(amount) || amount < 4) {
            return res.status(400).json({ message: 'الحد الأدنى 4 USDT' });
        }
        if (amount > user.balance) {
            return res.status(400).json({ message: 'رصيد غير كافٍ' });
        }
        user.balance = parseFloat((user.balance - amount).toFixed(8));
        user.transactions.push({
            type: 'withdraw',
            amount,
            walletAddress: walletAddress.trim(),
            status: 'pending',
            timestamp: new Date().toISOString(),
        });
        writeDatabase(db);
        res.json({
            message: 'تم تقديم طلب السحب، قيد المعالجة',
            balance: user.balance,
            casinoBalance: user.casinoBalance,
            transactions: user.transactions.slice(-10).reverse(),
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

// ===== الإيداع اليدوي (تسجيل TxID) =====
router.post('/wallet/deposit', (req, res) => {
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
        const { txid } = req.body;
        if (!txid || txid.trim() === '') {
            return res.status(400).json({ message: 'رقم العملية مطلوب' });
        }
        // إضافة إلى قائمة الإيداعات المنتظرة
        const deposit = {
            id: db.depositIdCounter++,
            userId: user.id,
            userEmail: user.email,
            txid: txid.trim(),
            amount: 0,
            status: 'pending',
            timestamp: new Date().toISOString(),
        };
        db.pendingDeposits.push(deposit);
        user.transactions.push({
            type: 'deposit',
            amount: 0,
            txid: txid.trim(),
            status: 'pending',
            timestamp: new Date().toISOString(),
        });
        writeDatabase(db);
        res.json({
            message: 'تم استلام طلب الإيداع، سيتم مراجعته من الإدارة',
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
