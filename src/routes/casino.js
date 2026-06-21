// ==========================================
// routes/casino.js - ألعاب الكازينو
// ==========================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { User } = require('../models/User');
const { Transaction } = require('../models/Transaction');

// ==========================================
// إعدادات الكازينو (قابلة للتعديل من الإدارة)
// ==========================================
let casinoSettings = {
    houseEdge: 5,      // نسبة ربح المنصة (%)
    minBet: 0.1,       // الحد الأدنى للرهان
    maxBet: 100,       // الحد الأقصى للرهان
    wheelEnabled: true,
    diceEnabled: true,
    crashEnabled: true
};

// ==========================================
// دالة توليد بذور عادلة (Provably Fair)
// ==========================================
function generateSeeds() {
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const serverSeed = crypto.randomBytes(16).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return { clientSeed, serverSeed, serverSeedHash };
}

function generateFairResult(clientSeed, serverSeed, nonce) {
    const combined = clientSeed + '-' + serverSeed + '-' + nonce;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    const randomNumber = parseInt(hash.substring(0, 8), 16) / 0xFFFFFFFF;
    return randomNumber;
}

// ==========================================
// 1. عجلة الحظ
// ==========================================
router.post('/wheel', async (req, res) => {
    try {
        const { email, betAmount, useFreeSpin } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
        }

        if (!casinoSettings.wheelEnabled) {
            return res.json({ success: false, message: '⛔ لعبة العجلة معطلة حالياً' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        let finalBet = betAmount || 0;
        let isFreeSpin = false;

        // استخدام جولة مجانية
        if (useFreeSpin) {
            if (user.freeSpins <= 0) {
                return res.json({ success: false, message: 'لا توجد جولات مجانية' });
            }
            user.freeSpins -= 1;
            isFreeSpin = true;
            finalBet = 0;
        } else {
            // التحقق من الرهان
            if (finalBet < casinoSettings.minBet || finalBet > casinoSettings.maxBet) {
                return res.json({
                    success: false,
                    message: `الرهان يجب أن يكون بين ${casinoSettings.minBet} و ${casinoSettings.maxBet}`
                });
            }
            if (user.casinoBalance < finalBet) {
                return res.json({ success: false, message: 'رصيد الكازينو غير كافٍ' });
            }
            user.casinoBalance -= finalBet;
        }

        // توليد البذور
        const seeds = generateSeeds();
        const nonce = Date.now() + Math.random() * 1000;
        const rand = generateFairResult(seeds.clientSeed, seeds.serverSeed, nonce);

        // خوارزمية العجلة (8 أقسام)
        const segments = [
            { label: '×0', multiplier: 0 },
            { label: '×1', multiplier: 1 },
            { label: '×1.5', multiplier: 1.5 },
            { label: '×2', multiplier: 2 },
            { label: '×0', multiplier: 0 },
            { label: '×3', multiplier: 3 },
            { label: '×0', multiplier: 0 },
            { label: '×5', multiplier: 5 }
        ];

        const houseEdgeFactor = 1 - (casinoSettings.houseEdge / 100);
        const adjustedRand = rand * houseEdgeFactor;
        const idx = Math.floor(adjustedRand * segments.length) % segments.length;
        const result = segments[idx];
        const isWin = result.multiplier > 0;
        let profit = 0;

        if (isWin) {
            profit = finalBet * result.multiplier;
            if (isFreeSpin) {
                profit = 0.5; // مكافأة الجولة المجانية
            }
            user.casinoBalance += profit;
        }

        // تسجيل المعاملة
        if (finalBet > 0) {
            const transaction = new Transaction({
                userId: user._id,
                type: 'casino_bet',
                amount: finalBet,
                note: `عجلة الحظ - ${isWin ? 'فوز' : 'خسارة'}`,
                status: 'approved'
            });
            await transaction.save();
        }

        await user.save();

        res.json({
            success: true,
            isWin,
            multiplier: result.multiplier,
            profit: isFreeSpin ? profit : (isWin ? profit : -finalBet),
            newBalance: user.casinoBalance,
            freeSpinsLeft: user.freeSpins,
            serverSeedHash: seeds.serverSeedHash,
            clientSeed: seeds.clientSeed,
            rollResult: idx
        });

    } catch (error) {
        console.error('❌ Wheel error:', error);
        res.status(500).json({ success: false, message: 'خطأ في لعبة العجلة' });
    }
});

// ==========================================
// 2. لعبة النرد
// ==========================================
router.post('/dice', async (req, res) => {
    try {
        const { email, betAmount, guess } = req.body;

        if (!email || !guess) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        if (!casinoSettings.diceEnabled) {
            return res.json({ success: false, message: '⛔ لعبة النرد معطلة حالياً' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        const bet = betAmount || 0;
        if (bet < casinoSettings.minBet || bet > casinoSettings.maxBet) {
            return res.json({
                success: false,
                message: `الرهان يجب أن يكون بين ${casinoSettings.minBet} و ${casinoSettings.maxBet}`
            });
        }
        if (user.casinoBalance < bet) {
            return res.json({ success: false, message: 'رصيد الكازينو غير كافٍ' });
        }

        user.casinoBalance -= bet;

        // توليد البذور
        const seeds = generateSeeds();
        const nonce = Date.now() + Math.random() * 1000;
        const rand = generateFairResult(seeds.clientSeed, seeds.serverSeed, nonce);
        const roll = Math.floor(rand * 6) + 1;

        // منطق الفوز
        let isWin = false;
        let multiplier = 0;

        if (guess === 'even' && roll % 2 === 0) { isWin = true; multiplier = 2; }
        else if (guess === 'odd' && roll % 2 !== 0) { isWin = true; multiplier = 2; }
        else if (parseInt(guess) === roll) { isWin = true; multiplier = 6; }

        // تطبيق نسبة ربح المنصة
        const houseEdgeFactor = 1 - (casinoSettings.houseEdge / 100);
        multiplier = multiplier * houseEdgeFactor;

        let profit = 0;
        if (isWin) {
            profit = bet * multiplier;
            user.casinoBalance += profit;
        } else {
            profit = -bet;
        }

        // تسجيل المعاملة
        const transaction = new Transaction({
            userId: user._id,
            type: 'casino_bet',
            amount: bet,
            note: `النرد - ${isWin ? 'فوز' : 'خسارة'}`,
            status: 'approved'
        });
        await transaction.save();

        await user.save();

        res.json({
            success: true,
            isWin,
            roll,
            multiplier: isWin ? multiplier : 0,
            profit,
            newBalance: user.casinoBalance,
            serverSeedHash: seeds.serverSeedHash,
            clientSeed: seeds.clientSeed
        });

    } catch (error) {
        console.error('❌ Dice error:', error);
        res.status(500).json({ success: false, message: 'خطأ في لعبة النرد' });
    }
});

// ==========================================
// 3. لعبة Crash (الدجاج)
// ==========================================
let activeCrashGames = {};

router.post('/crash/start', async (req, res) => {
    try {
        const { email, betAmount } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
        }

        if (!casinoSettings.crashEnabled) {
            return res.json({ success: false, message: '⛔ لعبة Crash معطلة حالياً' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        const bet = betAmount || 0;
        if (bet < casinoSettings.minBet || bet > casinoSettings.maxBet) {
            return res.json({
                success: false,
                message: `الرهان يجب أن يكون بين ${casinoSettings.minBet} و ${casinoSettings.maxBet}`
            });
        }
        if (user.casinoBalance < bet) {
            return res.json({ success: false, message: 'رصيد الكازينو غير كافٍ' });
        }

        user.casinoBalance -= bet;
        await user.save();

        // توليد البذور
        const seeds = generateSeeds();
        const nonce = Date.now() + Math.random() * 1000;
        const rand = generateFairResult(seeds.clientSeed, seeds.serverSeed, nonce);
        const crashPoint = 1.1 + (rand * 8.9); // بين 1.1 و 10.0

        const gameId = Date.now().toString() + crypto.randomBytes(4).toString('hex');
        activeCrashGames[gameId] = {
            email,
            bet,
            crashPoint,
            serverSeed: seeds.serverSeed,
            serverSeedHash: seeds.serverSeedHash,
            clientSeed: seeds.clientSeed,
            userId: user._id,
            active: true,
            cashoutMultiplier: null
        };

        res.json({
            success: true,
            gameId,
            serverSeedHash: seeds.serverSeedHash,
            clientSeed: seeds.clientSeed
        });

    } catch (error) {
        console.error('❌ Crash start error:', error);
        res.status(500).json({ success: false, message: 'خطأ في بدء اللعبة' });
    }
});

router.post('/crash/cashout', async (req, res) => {
    try {
        const { gameId, cashoutMultiplier } = req.body;

        if (!gameId || !cashoutMultiplier) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const game = activeCrashGames[gameId];
        if (!game || !game.active) {
            return res.status(404).json({ success: false, message: 'اللعبة غير موجودة أو منتهية' });
        }

        const user = await User.findById(game.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        let isWin = false;
        let profit = 0;

        if (cashoutMultiplier <= game.crashPoint) {
            isWin = true;
            profit = game.bet * cashoutMultiplier;
            user.casinoBalance += profit;
        } else {
            profit = -game.bet;
        }

        game.active = false;
        await user.save();

        // تسجيل المعاملة
        const transaction = new Transaction({
            userId: user._id,
            type: 'casino_bet',
            amount: game.bet,
            note: `Crash - ${isWin ? 'فوز' : 'خسارة'}`,
            status: 'approved'
        });
        await transaction.save();

        res.json({
            success: true,
            isWin,
            crashPoint: game.crashPoint,
            cashoutMultiplier: cashoutMultiplier,
            profit,
            newBalance: user.casinoBalance
        });

    } catch (error) {
        console.error('❌ Crash cashout error:', error);
        res.status(500).json({ success: false, message: 'خطأ في سحب الأرباح' });
    }
});

// ==========================================
// 4. جلب إعدادات الكازينو (للواجهة)
// ==========================================
router.get('/settings', (req, res) => {
    res.json({
        success: true,
        settings: {
            houseEdge: casinoSettings.houseEdge,
            minBet: casinoSettings.minBet,
            maxBet: casinoSettings.maxBet,
            wheelEnabled: casinoSettings.wheelEnabled,
            diceEnabled: casinoSettings.diceEnabled,
            crashEnabled: casinoSettings.crashEnabled
        }
    });
});

// ==========================================
// 5. تحديث إعدادات الكازينو (للمشرف)
// ==========================================
router.post('/settings/update', async (req, res) => {
    try {
        const { houseEdge, minBet, maxBet, wheelEnabled, diceEnabled, crashEnabled } = req.body;

        // التحقق من الصلاحية (سيتم إضافة middleware لاحقاً)
        // مؤقتاً: نسمح لأي طلب

        if (houseEdge !== undefined) casinoSettings.houseEdge = Math.min(Math.max(houseEdge, 1), 20);
        if (minBet !== undefined) casinoSettings.minBet = Math.max(minBet, 0.01);
        if (maxBet !== undefined) casinoSettings.maxBet = Math.max(maxBet, 1);
        if (wheelEnabled !== undefined) casinoSettings.wheelEnabled = wheelEnabled;
        if (diceEnabled !== undefined) casinoSettings.diceEnabled = diceEnabled;
        if (crashEnabled !== undefined) casinoSettings.crashEnabled = crashEnabled;

        res.json({
            success: true,
            message: '✅ تم تحديث إعدادات الكازينو',
            settings: casinoSettings
        });

    } catch (error) {
        console.error('❌ Update settings error:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحديث الإعدادات' });
    }
});

module.exports = router;
