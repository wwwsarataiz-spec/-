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

// حساب المضاعف بناءً على المخاطرة R (1-100)
// الصيغة: M = 1 + (R / (100 - R + 0.001)) * 0.9
function calculateMultiplier(risk) {
    if (risk < 1) risk = 1;
    if (risk > 100) risk = 100;
    const denominator = 100 - risk + 0.001;
    const multiplier = 1 + (risk / denominator) * 0.9;
    return parseFloat(multiplier.toFixed(4));
}

// فرصة الفوز الفعلية مع حماية الخزنة (Whale Protection)
function getActualWinProbability(risk, betAmount, userCasinoBalance) {
    let baseP = 100 - risk; // 0-99
    // إذا كان الرهان كبيراً جداً (> 50% من رصيد الكازينو) نخفض الفرصة بشكل كبير
    // وإذا كان صغيراً جداً (< 1%) نزيد الفرصة قليلاً
    const ratio = betAmount / (userCasinoBalance + 0.001);
    let adjustment = 0;
    if (ratio > 0.5) {
        adjustment = - (ratio - 0.5) * 50; // خصم يصل إلى 50%
    } else if (ratio < 0.01) {
        adjustment = (0.01 - ratio) * 20; // إضافة تصل إلى 20%
    }
    let finalP = baseP + adjustment;
    if (finalP < 0) finalP = 0;
    if (finalP > 100) finalP = 100;
    return parseFloat(finalP.toFixed(2));
}

// نقطة نهاية اللعب
router.post('/play', (req, res) => {
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

        const { gameType, betAmount, risk } = req.body;
        if (!gameType || !betAmount || isNaN(betAmount) || betAmount <= 0) {
            return res.status(400).json({ message: 'بيانات غير صحيحة' });
        }
        if (!risk || isNaN(risk) || risk < 1 || risk > 100) {
            return res.status(400).json({ message: 'نسبة المخاطرة يجب أن تكون بين 1 و 100' });
        }
        if (betAmount > user.casinoBalance) {
            return res.status(400).json({ message: 'رصيد كازينو غير كافٍ' });
        }

        // حساب المضاعف وفرصة الفوز
        const multiplier = calculateMultiplier(risk);
        let winProbability = getActualWinProbability(risk, betAmount, user.casinoBalance);

        // توليد رقم عشوائي (0-100) لتحديد الفوز
        const random = Math.random() * 100;
        const win = random < winProbability;

        let profit = 0;
        if (win) {
            profit = betAmount * (multiplier - 1);
            profit = parseFloat(profit.toFixed(4));
            user.casinoBalance = parseFloat((user.casinoBalance + profit).toFixed(4));
        } else {
            user.casinoBalance = parseFloat((user.casinoBalance - betAmount).toFixed(4));
        }

        // تسجيل المعاملة
        user.transactions.push({
            type: 'game_' + gameType,
            amount: win ? profit : -betAmount,
            status: 'completed',
            timestamp: new Date().toISOString(),
            details: { risk, multiplier, winProbability, win, betAmount }
        });

        writeDatabase(db);

        // رسالة النتيجة حسب نوع اللعبة
        let resultMessage = '';
        if (gameType === 'chicken') {
            resultMessage = win ? '🐔 الدجاجة وصلت إلى النهاية! ربحت!' : '💥 انفجرت الدجاجة! خسرت!';
        } else if (gameType === 'dice') {
            resultMessage = win ? '🎲 النرد أظهر رقمك! ربحت!' : '🎲 النرد لم يظهر رقمك! خسرت!';
        } else if (gameType === 'wall') {
            resultMessage = win ? '🧱 كسرت الحائط! ربحت!' : '🧱 الحائط صمد! خسرت!';
        }

        res.json({
            win,
            profit: win ? profit : -betAmount,
            newCasinoBalance: user.casinoBalance,
            multiplier,
            winProbability,
            resultMessage,
            gameType,
            randomNumber: random.toFixed(2)
        });

    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

module.exports = router;
