const express = require('express');
const router = express.Router();
const User = require('../models/User');

// حساب واستلام أرباح التعدين تلقائياً
router.post('/claim', async (req, res) => {
    const { telegramId } = req.body;

    try {
        let user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });

        const now = new Date();
        const timeElapsedInMs = now - new Date(user.lastMiningClaim);
        const timeElapsedInHours = timeElapsedInMs / (1000 * 60 * 60); // تحويل الوقت لساعات

        if (timeElapsedInHours < 0.01) {
            return res.status(400).json({ msg: 'لم يمر وقت كافٍ للمطالبة بالأرباح بعد' });
        }

        // حساب الأرباح: الوقت المنقضي × معدل الربح للباقة
        const earnings = timeElapsedInHours * user.miningRatePerHour;

        // تحديث رصيد المستخدم ووقت المطالبة الجديد
        user.balance += earnings;
        user.lastMiningClaim = now;
        await user.save();

        res.json({
            msg: 'تم حصد أرباح التعدين بنجاح!',
            claimedAmount: earnings.toFixed(4),
            newBalance: user.balance.toFixed(4)
        });

    } catch (err) {
        res.status(500).send('خطأ في خادم التعدين');
    }
});

module.exports = router;
