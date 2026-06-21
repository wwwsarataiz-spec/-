// ==========================================
// routes/mining.js - نظام التعدين والاستثمار
// ==========================================

const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { Transaction } = require('../models/Transaction');

// ==========================================
// 1. النقر على زر التعدين
// ==========================================
router.post('/click', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        if (user.miningEnergy < 20) {
            return res.json({
                success: false,
                message: '⛔ الطاقة منخفضة! انتظر حتى تتجدد',
                energy: user.miningEnergy
            });
        }

        // خصم الطاقة وإضافة الرصيد
        user.miningEnergy -= 20;
        user.balance = (user.balance || 0) + parseFloat(process.env.MINING_REWARD || 0.001);
        await user.save();

        res.json({
            success: true,
            message: '✅ تم التعدين بنجاح!',
            newBalance: user.balance,
            energy: user.miningEnergy
        });

    } catch (error) {
        console.error('❌ Mining click error:', error);
        res.status(500).json({ success: false, message: 'خطأ في التعدين' });
    }
});

// ==========================================
// 2. تجديد الطاقة
// ==========================================
router.post('/recharge', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        user.miningEnergy = 1000;
        await user.save();

        res.json({
            success: true,
            message: '✅ تم تجديد الطاقة بالكامل!',
            energy: user.miningEnergy
        });

    } catch (error) {
        console.error('❌ Recharge error:', error);
        res.status(500).json({ success: false, message: 'خطأ في تجديد الطاقة' });
    }
});

// ==========================================
// 3. جلب خطط التعدين (للإدارة)
// ==========================================
router.get('/plans', async (req, res) => {
    try {
        // خطط افتراضية (يمكن تعديلها من الإدارة لاحقاً)
        const plans = [
            { id: 'bronze', name: '🥉 برونزي', price: 5, dailyReturn: 3, duration: 30 },
            { id: 'silver', name: '🥈 فضي', price: 15, dailyReturn: 5, duration: 30 },
            { id: 'gold', name: '🥇 ذهبي', price: 50, dailyReturn: 8, duration: 30 },
            { id: 'diamond', name: '💎 ماسي', price: 150, dailyReturn: 12, duration: 30 }
        ];

        res.json({ success: true, plans });

    } catch (error) {
        console.error('❌ Plans error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الخطط' });
    }
});

// ==========================================
// 4. شراء خطة تعدين
// ==========================================
router.post('/buy-plan', async (req, res) => {
    try {
        const { email, planId } = req.body;
        if (!email || !planId) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        // خطط افتراضية
        const plans = {
            bronze: { name: 'برونزي', price: 5, dailyReturn: 3, duration: 30 },
            silver: { name: 'فضي', price: 15, dailyReturn: 5, duration: 30 },
            gold: { name: 'ذهبي', price: 50, dailyReturn: 8, duration: 30 },
            diamond: { name: 'ماسي', price: 150, dailyReturn: 12, duration: 30 }
        };

        const plan = plans[planId];
        if (!plan) {
            return res.status(404).json({ success: false, message: 'الخطة غير موجودة' });
        }

        if (user.balance < plan.price) {
            return res.json({
                success: false,
                message: `❌ رصيد غير كافٍ! تحتاج ${plan.price} USDT`
            });
        }

        // خصم المبلغ وإضافة الخطة
        user.balance -= plan.price;
        if (!user.investments) user.investments = [];
        user.investments.push({
            planId,
            planName: plan.name,
            amount: plan.price,
            dailyReturn: plan.dailyReturn,
            duration: plan.duration,
            startDate: new Date(),
            endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000),
            lastCollected: null,
            isActive: true
        });
        await user.save();

        // تسجيل المعاملة
        const transaction = new Transaction({
            userId: user._id,
            type: 'investment',
            amount: plan.price,
            note: `شراء خطة ${plan.name}`,
            status: 'approved'
        });
        await transaction.save();

        res.json({
            success: true,
            message: `✅ تم شراء خطة ${plan.name} بنجاح!`,
            newBalance: user.balance
        });

    } catch (error) {
        console.error('❌ Buy plan error:', error);
        res.status(500).json({ success: false, message: 'خطأ في شراء الخطة' });
    }
});

// ==========================================
// 5. سحب أرباح الاستثمار
// ==========================================
router.post('/collect-profit', async (req, res) => {
    try {
        const { email, investmentIndex } = req.body;
        if (!email || investmentIndex === undefined) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        if (!user.investments || investmentIndex >= user.investments.length) {
            return res.status(404).json({ success: false, message: 'الاستثمار غير موجود' });
        }

        const inv = user.investments[investmentIndex];
        if (!inv.isActive) {
            return res.json({ success: false, message: 'هذا الاستثمار غير نشط' });
        }

        const now = Date.now();
        const startDate = new Date(inv.startDate).getTime();
        const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        if (daysPassed <= 0) {
            return res.json({ success: false, message: 'لا توجد أرباح بعد' });
        }

        const totalProfit = inv.amount * (inv.dailyReturn / 100) * daysPassed;
        if (totalProfit <= 0) {
            return res.json({ success: false, message: 'لا توجد أرباح' });
        }

        // إضافة الأرباح إلى الرصيد
        user.balance += totalProfit;
        inv.lastCollected = new Date();
        await user.save();

        res.json({
            success: true,
            message: `✅ تم سحب ${totalProfit.toFixed(2)} USDT أرباح`,
            newBalance: user.balance
        });

    } catch (error) {
        console.error('❌ Collect profit error:', error);
        res.status(500).json({ success: false, message: 'خطأ في سحب الأرباح' });
    }
});

// ==========================================
// 6. سحب رأس المال بعد انتهاء المدة
// ==========================================
router.post('/withdraw-capital', async (req, res) => {
    try {
        const { email, investmentIndex } = req.body;
        if (!email || investmentIndex === undefined) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        if (!user.investments || investmentIndex >= user.investments.length) {
            return res.status(404).json({ success: false, message: 'الاستثمار غير موجود' });
        }

        const inv = user.investments[investmentIndex];
        if (!inv.isActive) {
            return res.json({ success: false, message: 'تم سحب رأس المال مسبقاً' });
        }

        const now = Date.now();
        const endDate = new Date(inv.endDate).getTime();
        if (now < endDate) {
            return res.json({ success: false, message: 'لم تنتهِ مدة الاستثمار بعد' });
        }

        // إضافة رأس المال إلى الرصيد
        user.balance += inv.amount;
        inv.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: `✅ تم سحب رأس المال (${inv.amount} USDT) بنجاح`,
            newBalance: user.balance
        });

    } catch (error) {
        console.error('❌ Withdraw capital error:', error);
        res.status(500).json({ success: false, message: 'خطأ في سحب رأس المال' });
    }
});

// ==========================================
// 7. جلب استثمارات المستخدم
// ==========================================
router.post('/my-investments', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        const investments = (user.investments || []).map((inv, index) => {
            const now = Date.now();
            const startDate = new Date(inv.startDate).getTime();
            const endDate = new Date(inv.endDate).getTime();
            const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
            const progress = Math.min((daysPassed / totalDays) * 100, 100);
            const totalProfit = inv.amount * (inv.dailyReturn / 100) * daysPassed;
            const canWithdrawCapital = now >= endDate;

            return {
                index,
                ...inv,
                daysPassed: Math.min(daysPassed, totalDays),
                totalDays,
                progress: Math.round(progress),
                totalProfit: Math.max(totalProfit, 0),
                canWithdrawCapital
            };
        });

        res.json({ success: true, investments });

    } catch (error) {
        console.error('❌ My investments error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الاستثمارات' });
    }
});

module.exports = router;
