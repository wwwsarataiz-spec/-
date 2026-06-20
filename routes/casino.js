// ==========================================
// routes/casino.js - ألعاب الكازينو
// ==========================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');

// ==========================================
// دالة مساعدة لتوليد Server Seed
// ==========================================
function generateServerSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function generateClientSeed() {
  return crypto.randomBytes(16).toString('hex');
}

// ==========================================
// 1. عجلة الحظ
// ==========================================
router.post('/wheel', async (req, res) => {
  try {
    const { email, betAmount, useFreeSpin } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: '❌ البريد الإلكتروني مطلوب'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    // استخدام جولة مجانية
    if (useFreeSpin) {
      if (user.freeCasinoSpins <= 0) {
        return res.json({
          success: false,
          message: '❌ لا توجد جولات مجانية متاحة'
        });
      }
      user.freeCasinoSpins -= 1;
      betAmount = 0;
    } else {
      // التحقق من الرصيد
      const totalBalance = (user.casinoBalance || 0) + (user.giftPoints || 0);
      if (betAmount > totalBalance) {
        return res.json({
          success: false,
          message: '❌ رصيد غير كافٍ!'
        });
      }

      // خصم من رصيد الكازينو أولاً، ثم نقاط الهدايا
      if (betAmount <= user.casinoBalance) {
        user.casinoBalance -= betAmount;
      } else {
        const remaining = betAmount - user.casinoBalance;
        user.casinoBalance = 0;
        user.giftPoints -= remaining;
      }
    }

    // منطق العجلة (مضاعفات عشوائية)
    const multipliers = [0, 1, 1.5, 2, 3, 5];
    const weights = [30, 25, 20, 15, 7, 3]; // نسبة ظهور كل مضاعف
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let multiplier = 0;
    let win = false;
    let profit = 0;

    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        multiplier = multipliers[i];
        break;
      }
    }

    if (multiplier > 0) {
      win = true;
      profit = betAmount * multiplier;
      user.casinoBalance += profit;
    }

    user.totalCasinoPlayed = (user.totalCasinoPlayed || 0) + 1;
    await user.save();

    // توليد Server Seed و Client Seed للتحقق
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();

    res.json({
      success: true,
      multiplier,
      win,
      profit,
      newBalance: user.casinoBalance,
      newGiftPoints: user.giftPoints,
      freeSpinsLeft: user.freeCasinoSpins,
      serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
      clientSeed
    });

  } catch (error) {
    console.error('❌ Wheel error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في لعبة العجلة'
    });
  }
});

// ==========================================
// 2. لعبة الهامش
// ==========================================
router.post('/margin', async (req, res) => {
  try {
    const { email, amount, chosenPercentage } = req.body;

    if (!email || !amount || chosenPercentage === undefined) {
      return res.status(400).json({
        success: false,
        message: '❌ البيانات غير مكتملة'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    const totalBalance = (user.casinoBalance || 0) + (user.giftPoints || 0);
    if (amount > totalBalance) {
      return res.json({
        success: false,
        message: '❌ رصيد غير كافٍ!'
      });
    }

    // خصم المبلغ
    if (amount <= user.casinoBalance) {
      user.casinoBalance -= amount;
    } else {
      const remaining = amount - user.casinoBalance;
      user.casinoBalance = 0;
      user.giftPoints -= remaining;
    }

    // توليد رقم عشوائي (1-100)
    const rollResult = Math.floor(Math.random() * 100) + 1;
    const win = rollResult <= chosenPercentage;
    let profit = 0;
    let multiplier = 0;

    if (win) {
      multiplier = 1 + (chosenPercentage / 100);
      profit = amount * (chosenPercentage / 100);
      user.casinoBalance += profit;
    } else {
      profit = -amount;
    }

    await user.save();

    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();

    res.json({
      success: true,
      win,
      rollResult,
      multiplier,
      profit,
      newBalance: user.casinoBalance,
      newGiftPoints: user.giftPoints,
      serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
      clientSeed
    });

  } catch (error) {
    console.error('❌ Margin error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في لعبة الهامش'
    });
  }
});

// ==========================================
// 3. لعبة النرد
// ==========================================
router.post('/dice', async (req, res) => {
  try {
    const { email, bet, guess } = req.body;

    if (!email || !bet || !guess) {
      return res.status(400).json({
        success: false,
        message: '❌ البيانات غير مكتملة'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    const totalBalance = (user.casinoBalance || 0) + (user.giftPoints || 0);
    if (bet > totalBalance) {
      return res.json({
        success: false,
        message: '❌ رصيد غير كافٍ!'
      });
    }

    // خصم المبلغ
    if (bet <= user.casinoBalance) {
      user.casinoBalance -= bet;
    } else {
      const remaining = bet - user.casinoBalance;
      user.casinoBalance = 0;
      user.giftPoints -= remaining;
    }

    // رمي النرد (1-6)
    const roll = Math.floor(Math.random() * 6) + 1;
    let win = false;
    let profit = 0;
    let multiplier = 0;

    if (guess === 'even' && roll % 2 === 0) { win = true; multiplier = 2; }
    else if (guess === 'odd' && roll % 2 !== 0) { win = true; multiplier = 2; }
    else if (parseInt(guess) === roll) { win = true; multiplier = 6; }

    if (win) {
      profit = bet * multiplier;
      user.casinoBalance += profit;
    } else {
      profit = -bet;
    }

    await user.save();

    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();

    res.json({
      success: true,
      win,
      roll,
      multiplier,
      profit,
      newBalance: user.casinoBalance,
      newGiftPoints: user.giftPoints,
      serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
      clientSeed
    });

  } catch (error) {
    console.error('❌ Dice error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في لعبة النرد'
    });
  }
});

// ==========================================
// 4. لعبة Crash (بدء اللعبة)
// ==========================================
let crashGames = {};

router.post('/crash/start', async (req, res) => {
  try {
    const { email, bet } = req.body;

    if (!email || !bet) {
      return res.status(400).json({
        success: false,
        message: '❌ البيانات غير مكتملة'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    const totalBalance = (user.casinoBalance || 0) + (user.giftPoints || 0);
    if (bet > totalBalance) {
      return res.json({
        success: false,
        message: '❌ رصيد غير كافٍ!'
      });
    }

    // خصم المبلغ
    if (bet <= user.casinoBalance) {
      user.casinoBalance -= bet;
    } else {
      const remaining = bet - user.casinoBalance;
      user.casinoBalance = 0;
      user.giftPoints -= remaining;
    }

    await user.save();

    // توليد نقطة الانهيار (بين 1.01 و 10.00)
    const crashPoint = 1.01 + (Math.random() * 8.99);
    const gameId = Date.now().toString() + crypto.randomBytes(4).toString('hex');
    const serverSeed = generateServerSeed();

    crashGames[gameId] = {
      email,
      bet,
      crashPoint,
      serverSeed,
      active: true,
      userId: user._id
    };

    res.json({
      success: true,
      gameId,
      serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
      clientSeed: generateClientSeed()
    });

  } catch (error) {
    console.error('❌ Crash start error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في بدء اللعبة'
    });
  }
});

// ==========================================
// 5. لعبة Crash (سحب الأرباح)
// ==========================================
router.post('/crash/cashout', async (req, res) => {
  try {
    const { gameId, cashoutMultiplier } = req.body;

    if (!gameId || !cashoutMultiplier) {
      return res.status(400).json({
        success: false,
        message: '❌ البيانات غير مكتملة'
      });
    }

    const game = crashGames[gameId];
    if (!game || !game.active) {
      return res.status(404).json({
        success: false,
        message: '❌ اللعبة غير موجودة أو منتهية'
      });
    }

    const user = await User.findById(game.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    let win = false;
    let profit = 0;

    if (cashoutMultiplier <= game.crashPoint) {
      win = true;
      profit = game.bet * cashoutMultiplier;
      user.casinoBalance += profit;
    } else {
      profit = -game.bet;
    }

    await user.save();
    game.active = false;

    res.json({
      success: true,
      win,
      crashPoint: game.crashPoint,
      cashoutMultiplier: cashoutMultiplier,
      profit,
      newBalance: user.casinoBalance,
      newGiftPoints: user.giftPoints
    });

  } catch (error) {
    console.error('❌ Crash cashout error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في سحب الأرباح'
    });
  }
});

module.exports = router;
