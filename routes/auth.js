const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const JWT_SECRET = 'nexora_super_secret_key_2026';

// دوال قراءة وكتابة قاعدة البيانات
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

function generateToken(user) {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// استيراد دالة التعدين الآلي من mining.js
const { calculateAutoMining } = require('./mining');

// ===== تسجيل مستخدم جديد =====
router.post('/register', (req, res) => {
    const { name, phone, email, password } = req.body;
    if (!name || !phone || !email || !password) {
        return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }
    let db = readDatabase();
    const users = db.users;
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'البريد مستخدم بالفعل' });
    }
    const newUser = {
        id: db.nextId++,
        name,
        phone,
        email,
        password,
        balance: 0,
        casinoBalance: 0,
        miningEarnings: 0,
        lastAutoMiningUpdate: Date.now(),
        transactions: [],
    };
    users.push(newUser);
    writeDatabase(db);
    const token = generateToken(newUser);
    res.status(201).json({
        message: 'تم إنشاء الحساب',
        token,
        user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            balance: newUser.balance,
            casinoBalance: newUser.casinoBalance,
            miningEarnings: newUser.miningEarnings,
            transactions: newUser.transactions.slice(-10).reverse(),
        }
    });
});

// ===== تسجيل الدخول =====
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    let db = readDatabase();
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({ message: 'بيانات غير صحيحة' });
    }
    // تحديث التعدين الآلي
    calculateAutoMining(user);
    writeDatabase(db);
    const token = generateToken(user);
    res.json({
        message: 'تم تسجيل الدخول',
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            balance: user.balance,
            casinoBalance: user.casinoBalance,
            miningEarnings: user.miningEarnings,
            transactions: user.transactions.slice(-10).reverse(),
        }
    });
});

// ===== جلب بيانات المستخدم (مع تحديث التعدين) =====
router.get('/user', (req, res) => {
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
        writeDatabase(db);
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
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
