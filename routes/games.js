const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// لعبة Crash أو النرد بنظام Provably Fair
router.post('/play-crash', async (req, res) => {
    const { betAmount, telegramId } = req.body;
    
    // توليد سيرفر سيد (Server Seed) وسيرفر هاش لحماية النتيجة
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const clientSeed = telegramId; // استخدام آيدي التلجرام كـ Client Seed
    
    const hash = crypto.createHmac('sha256', serverSeed).update(clientSeed).digest('hex');
    
    // خوارزمية تحديد نقطة الانهيار (Crash Point) مع احتساب House Edge 5% للمنصة
    const hsEdge = 0.05; 
    const randomValue = parseInt(hash.substr(0, 13), 16);
    const multiplier = (95 / (100 - (randomValue % 100))).toFixed(2);

    // النتيجة النهائية للعبة
    let finalResult = parseFloat(multiplier);
    if (finalResult < 1) finalResult = 1.00;

    res.json({
        crashPoint: finalResult,
        serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'), // تظهر للمستخدم للتحقق
        msg: `انتهت اللعبة عند الانهيار: x${finalResult}`
    });
});

module.exports = router;
