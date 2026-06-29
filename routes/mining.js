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

// دالة حساب التعدين الآلي (نفس المعادلة السابقة)
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

// ===== التعدين اليدوي (نقرة) مع التحقق من مهلة 24 ساعة =====
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

        // التحقق من مهلة 24 ساعة منذ آخر حصاد
        const now = Date.now();
        const lastHarvest = user.lastHarvestTime || 0;
        const cooldownMs = 24 * 60 * 60 * 1000; // 24 ساعة بالمللي
        if (lastHarvest > 0 && (now - lastHarvest) < cooldownMs) {
            const remainingMs = cooldownMs - (now - lastHarvest);
            const remainingSeconds = Math.floor(remainingMs / 1000);
            return res.status(403).json({
                message: 'لا يمكن التعدين حالياً، يرجى الانتظار حتى انتهاء المهلة',
                cooldownRemaining: remainingSeconds,
                miningEarnings: user.miningEarnings,
                balance: user.balance,
                casinoBalance: user.casinoBalance,
            });
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

// ===== حصاد الأرباح مع تسجيل وقت الحصاد =====
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

        // تحديث التعدين الآلي
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
        // إعادة تعيين أرباح التعدين
        user.miningEarnings = 0;
        user.lastAutoMiningUpdate = Date.now();
        // تسجيل وقت الحصاد (بدء المهلة 24 ساعة)
        user.lastHarvestTime = Date.now();

        writeDatabase(db);

        res.json({
            message: 'تم الحصاد بنجاح، تم تفعيل مهلة 24 ساعة قبل التعدين مجدداً',
            balance: user.balance,
            casinoBalance: user.casinoBalance,
            miningEarnings: user.miningEarnings,
            lastHarvestTime: user.lastHarvestTime,
            transactions: user.transactions.slice(-10).reverse(),
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

// ===== جلب حالة التعدين (للتحقق من المهلة) =====
router.get('/mining-status', (req, res) => {
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

        const now = Date.now();
        const lastHarvest = user.lastHarvestTime || 0;
        const cooldownMs = 24 * 60 * 60 * 1000;
        let remainingSeconds = 0;
        let canMine = true;
        if (lastHarvest > 0 && (now - lastHarvest) < cooldownMs) {
            const remainingMs = cooldownMs - (now - lastHarvest);
            remainingSeconds = Math.floor(remainingMs / 1000);
            canMine = false;
        }

        // تحديث التعدين الآلي لعرض الأرباح الحالية
        calculateAutoMining(user);
        writeDatabase(db);

        res.json({
            miningEarnings: user.miningEarnings,
            lastHarvestTime: user.lastHarvestTime,
            canMine,
            cooldownRemaining: remainingSeconds,
        });
    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

module.exports = router;
module.exports.calculateAutoMining = calculateAutoMining;
