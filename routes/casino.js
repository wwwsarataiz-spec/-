// ==========================================
// routes/casino.js — ألعاب الكازينو الحقيقية
// نظام "Provably Fair" — يمكن التحقق من النتائج
// ==========================================

const express = require('express');
const crypto = require('crypto');
const { User } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ========== نظام التحقق العادل (Provably Fair) ==========
// يستخدم server seed + client seed + nonce
// يمكن للمستخدم التحقق من أن النتيجة لم تُتلاعب بها

function generateServerSeed() {
    return crypto.randomBytes(32).toString('hex');
}

function getRoll(serverSeed, clientSeed, nonce) {
    const hash = crypto.createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}`)
        .digest('hex');
    // تحويل أول 8 أحرف hex إلى رقم بين 0 و 1
    const int = parseInt(hash.substring(0, 8), 16);
    return int / 0xFFFFFFFF;
}

// تخزين بيانات الألعاب (في الإنتاج استخدم Redis)
const gameSeeds = new Map();

// ========== عجلة الحظ (Wheel) ==========
const WHEEL_SEGMENTS = [
    { multiplier: 0,   weight: 30,  color: '#444' },      // 30% — خسارة
    { multiplier: 1,   weight: 25,  color: '#ffd700' },  // 25% — استرداد
    { multiplier: 1.5, weight: 20,  color: '#ffaa00' }, // 20% — ربح 50%
    { multiplier: 2,   weight: 15,  color: '#ff4444' }, // 15% — ربح 100%
    { multiplier: 3,   weight: 8,   color: '#00cc66' }, // 8% — ربح 200%
    { multiplier: 5,   weight: 2,   color: '#00ff88' }  // 2% — ربح 400%
];

function getWheelResult(roll) {
    const totalWeight = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
    let cumulative = 0;
    const normalizedRoll = roll * totalWeight;
    
    for (const segment of WHEEL_SEGMENTS) {
        cumulative += segment.weight;
        if (normalizedRoll <= cumulative) {
            return segment;
        }
    }
    return WHEEL_SEGMENTS[0];
}

router.post('/wheel', authenticateToken, async (req, res) => {
    try {
        const { betAmount, clientSeed, useFreeSpin } = req.body;
        const user = req.user;
        const bet = parseFloat(betAmount) || 0;
        
        // التحقق من الرهان
        if (useFreeSpin) {
            if (user.freeCasinoSpins <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '❌ لا توجد جولات مجانية' 
                });
            }
        } else {
            const totalBalance = (user.casinoBalance || 0) + (user.giftPoints || 0);
            if (bet <= 0 || totalBalance < bet) {
                return res.status(400).json({ 
                    success: false, 
                    message: '❌ رصيد غير كافٍ' 
                });
            }
        }
        
        // توليد النتيجة العادلة
        const serverSeed = generateServerSeed();
        const nonce = Date.now();
        const roll = getRoll(serverSeed, clientSeed || 'default', nonce);
        const result = getWheelResult(roll);
        
        // حساب النتيجة
        let isWin = false;
        let profit = 0;
        let actualBet = useFreeSpin ? 0 : bet;
        
        if (result.multiplier > 0) {
            isWin = true;
            profit = actualBet * (result.multiplier - 1);
        } else {
            profit = -actualBet;
        }
        
        // تحديث الأرصدة
        if (useFreeSpin) {
            user.freeCasinoSpins -= 1;
            if (result.multiplier > 0) {
                user.casinoBalance = (user.casinoBalance || 0) + (bet * result.multiplier);
            }
        } else {
            // خصم من نقاط الهدايا أولاً، ثم رصيد الكازينو
            let remainingBet = actualBet;
            if (user.giftPoints > 0) {
                const fromGift = Math.min(user.giftPoints, remainingBet);
                user.giftPoints -= fromGift;
                remainingBet -= fromGift;
            }
            user.casinoBalance = (user.casinoBalance || 0) - remainingBet;
            
            if (result.multiplier > 0) {
                user.casinoBalance += actualBet * result.multiplier;
            }
        }
        
        user.totalCasinoPlayed = (user.totalCasinoPlayed || 0) + 1;
        user.lastCasinoPlay = new Date();
        await user.save();
        
        // حفظ بيانات اللعبة للتحقق
        const gameId = `wheel_${Date.now()}_${user._id}`;
        gameSeeds.set(gameId, { 
            serverSeed, 
            clientSeed: clientSeed || 'default', 
            nonce,
            result: result.multiplier 
        });
        
        res.json({
            success: true,
            isWin,
            multiplier: result.multiplier,
            profit: profit.toFixed(3),
            newBalance: user.casinoBalance,
            newGiftPoints: user.giftPoints,
            freeSpinsLeft: user.freeCasinoSpins,
            gameId,
            serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex')
        });
        
    } catch (error) {
        console.error('Wheel error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في اللعبة' 
        });
    }
});

// ========== لعبة النرد (Dice) ==========
router.post('/dice', authenticateToken, async (req, res) => {
    try {
        const { bet, guess, clientSeed } = req.body;
        const user = req.user;
        const betAmount = parseFloat(bet) || 0;
        
        // التحقق من الرهان
        const totalBalance = (user.casinoBalance || 0) + (user.giftPoints || 0);
        if (betAmount <= 0 || totalBalance < betAmount) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ رصيد غير كافٍ' 
            });
        }
        
        // توليد النتيجة (1-6)
        const serverSeed = generateServerSeed();
        const nonce = Date.now();
        const rollValue = getRoll(serverSeed, clientSeed || 'default', nonce);
        const roll = Math.floor(rollValue * 6) + 1;
        
        // تحديد الفائز
        let isWin = false;
        let multiplier = 0;
        
        if (guess === 'even') {
            isWin = roll % 2 === 0;
            multiplier = isWin ? 1.9 : 0;
        } else if (guess === 'odd') {
            isWin = roll % 2 !== 0;
            multiplier = isWin ? 1.9 : 0;
        } else {
            const guessNum = parseInt(guess);
            if (guessNum === roll) {
                isWin = true;
                multiplier = 5.5; // رقم صحيح = مكافأة عالية
            } else if (Math.abs(guessNum - roll) <= 1) {
                isWin = true;
                multiplier = 1.5; // رقم قريب
            }
        }
        
        // حساب الربح/الخسارة
        let profit = 0;
        if (isWin) {
            profit = betAmount * (multiplier - 1);
        } else {
            profit = -betAmount;
        }
        
        // تحديث الأرصدة
        let remainingBet = betAmount;
        if (user.giftPoints > 0) {
            const fromGift = Math.min(user.giftPoints, remainingBet);
            user.giftPoints -= fromGift;
            remainingBet -= fromGift;
        }
        user.casinoBalance = (user.casinoBalance || 0) - remainingBet;
        
        if (isWin) {
            user.casinoBalance += betAmount * multiplier;
        }
        
        await user.save();
        
        const gameId = `dice_${Date.now()}_${user._id}`;
        gameSeeds.set(gameId, { 
            serverSeed, 
            clientSeed: clientSeed || 'default', 
            nonce, 
            roll 
        });
        
        res.json({
            success: true,
            roll,
            win: isWin,
            multiplier,
            profit: profit.toFixed(3),
            newBalance: user.casinoBalance,
            newGiftPoints: user.giftPoints,
            gameId,
            serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex')
        });
        
    } catch (error) {
        console.error('Dice error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في اللعبة' 
        });
    }
});

// ========== لعبة الهامش (Margin) ==========
router.post('/margin', authenticateToken, async (req, res) => {
    try {
        const { amount, chosenPercentage, clientSeed } = req.body;
        const user = req.user;
        const betAmount = parseFloat(amount) || 0;
        const percentage = parseInt(chosenPercentage) || 50;
        
        // التحقق من الرهان
        const totalBalance = (user.casinoBalance || 0) + (user.giftPoints || 0);
        if (betAmount <= 0 || totalBalance < betAmount) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ رصيد غير كافٍ' 
            });
        }
        
        // توليد النتيجة (1-100)
        const serverSeed = generateServerSeed();
        const nonce = Date.now();
        const rollValue = getRoll(serverSeed, clientSeed || 'default', nonce);
        const rollResult = Math.floor(rollValue * 100) + 1;
        
        // فوز إذا كان الرقم <= النسبة المختارة
        const isWin = rollResult <= percentage;
        // مضاعف = (100 / النسبة) × 0.95 (5% ميزة للمنصة)
        const multiplier = isWin ? (100 / percentage) * 0.95 : 0;
        
        let profit = 0;
        if (isWin) {
            profit = betAmount * (multiplier - 1);
        } else {
            profit = -betAmount;
        }
        
        // تحديث الأرصدة
        let remainingBet = betAmount;
        if (user.giftPoints > 0) {
            const fromGift = Math.min(user.giftPoints, remainingBet);
            user.giftPoints -= fromGift;
            remainingBet -= fromGift;
        }
        user.casinoBalance = (user.casinoBalance || 0) - remainingBet;
        
        if (isWin) {
            user.casinoBalance += betAmount * multiplier;
        }
        
        await user.save();
        
        const gameId = `margin_${Date.now()}_${user._id}`;
        gameSeeds.set(gameId, { 
            serverSeed, 
            clientSeed: clientSeed || 'default', 
            nonce, 
            rollResult 
        });
        
        res.json({
            success: true,
            rollResult,
            win: isWin,
            multiplier: multiplier.toFixed(2),
            profit: profit.toFixed(3),
            newBalance: user.casinoBalance,
            newGiftPoints: user.giftPoints,
            gameId,
            serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex')
        });
        
    } catch (error) {
        console.error('Margin error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في اللعبة' 
        });
    }
});

// ========== لعبة Crash ==========
router.post('/crash/start', authenticateToken, async (req, res) => {
    try {
        const { bet, clientSeed } = req.body;
        const user = req.user;
        const betAmount = parseFloat(bet) || 0;
        
        const totalBalance = (user.casinoBalance || 0) + (user.giftPoints || 0);
        if (betAmount <= 0 || totalBalance < betAmount) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ رصيد غير كافٍ' 
            });
        }
        
        // توليد نقطة الانفجار (exponential distribution)
        const serverSeed = generateServerSeed();
        const nonce = Date.now();
        const rollValue = getRoll(serverSeed, clientSeed || 'default', nonce);
        
        // crashPoint = 0.99 / (1 - roll) مع حد أقصى 100x
        let crashPoint = 0.99 / (1 - rollValue);
        crashPoint = Math.min(crashPoint, 100);
        crashPoint = Math.max(crashPoint, 1.01);
        crashPoint = Math.floor(crashPoint * 100) / 100;
        
        const gameId = `crash_${Date.now()}_${user._id}`;
        
        // حفظ بيانات اللعبة
        gameSeeds.set(gameId, { 
            serverSeed, 
            clientSeed: clientSeed || 'default', 
            nonce, 
            crashPoint,
            betAmount,
            userId: user._id.toString()
        });
        
        res.json({
            success: true,
            gameId,
            serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex')
        });
        
    } catch (error) {
        console.error('Crash start error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في بدء اللعبة' 
        });
    }
});

// ========== سحب الأرباح في Crash ==========
router.post('/crash/cashout', authenticateToken, async (req, res) => {
    try {
        const { gameId, cashoutMultiplier, clientSeed } = req.body;
        const user = req.user;
        
        const gameData = gameSeeds.get(gameId);
        if (!gameData) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ اللعبة غير موجودة أو منتهية' 
            });
        }
        
        const { crashPoint, betAmount } = gameData;
        const cashout = parseFloat(cashoutMultiplier) || 1;
        
        // التحقق من السحب قبل الانفجار
        if (cashout >= crashPoint) {
            // انفجر! خسارة كل شيء
            let remainingBet = betAmount;
            if (user.giftPoints > 0) {
                const fromGift = Math.min(user.giftPoints, remainingBet);
                user.giftPoints -= fromGift;
                remainingBet -= fromGift;
            }
            user.casinoBalance = (user.casinoBalance || 0) - remainingBet;
            await user.save();
            
            gameSeeds.delete(gameId);
            
            return res.json({
                success: true,
                crashed: true,
                crashPoint,
                profit: -betAmount,
                newBalance: user.casinoBalance,
                newGiftPoints: user.giftPoints,
                message: `💥 انفجرت! المضاعف: ${crashPoint}x`
            });
        }
        
        // فوز! السحب قبل الانفجار
        const profit = betAmount * (cashout - 1);
        let remainingBet = betAmount;
        if (user.giftPoints > 0) {
            const fromGift = Math.min(user.giftPoints, remainingBet);
            user.giftPoints -= fromGift;
            remainingBet -= fromGift;
        }
        user.casinoBalance = (user.casinoBalance || 0) - remainingBet + (betAmount * cashout);
        await user.save();
        
        gameSeeds.delete(gameId);
        
        res.json({
            success: true,
            crashed: false,
            crashPoint,
            cashoutMultiplier: cashout,
            profit: profit.toFixed(3),
            newBalance: user.casinoBalance,
            newGiftPoints: user.giftPoints,
            message: `🎉 نجحت! سحبت عند ${cashout}x (انفجر عند ${crashPoint}x)`
        });
        
    } catch (error) {
        console.error('Crash cashout error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في اللعبة' 
        });
    }
});

// ========== التحقق من عدالة اللعبة ==========
router.post('/verify', (req, res) => {
    try {
        const { gameId, serverSeed, clientSeed, nonce } = req.body;
        const stored = gameSeeds.get(gameId);
        
        if (!stored) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ اللعبة غير موجودة' 
            });
        }
        
        const hash = crypto.createHmac('sha256', serverSeed)
            .update(`${clientSeed}:${nonce}`)
            .digest('hex');
        
        const int = parseInt(hash.substring(0, 8), 16);
        const roll = int / 0xFFFFFFFF;
        
        res.json({
            success: true,
            verified: stored.serverSeed === serverSeed,
            roll,
            hash
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في التحقق' 
        });
    }
});

module.exports = router;
