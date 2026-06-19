// ==========================================
// routes/mining.js — التعدين وخطط التعدين
// ==========================================

const express = require('express');
const { User, MiningPlan, UserMiningPlan } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ========== جلب جميع خطط التعدين ==========
router.get('/plans', async (req, res) => {
    try {
        const plans = await MiningPlan.find({ isActive: true }).sort({ price: 1 });
        res.json({ 
            success: true, 
            plans 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في جلب الخطط' 
        });
    }
});

// ========== ضغطة التعدين ==========
router.post('/click', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const now = new Date();
        const lastClick = user.lastMiningClick || new Date(0);
        const hoursPassed = (now - lastClick) / (1000 * 60 * 60);
        
        // إعادة شحن الطاقة (100 كل ساعة)
        let energy = user.miningEnergy || 1000;
        if (hoursPassed >= 1) {
            energy = Math.min(1000, energy + Math.floor(hoursPassed * 100));
        }
        
        if (energy < 10) {
            return res.json({ 
                success: false, 
                message: '⚡ الطاقة منخفضة! انتظر شحنها' 
            });
        }
        
        // حساب المكافأة حسب المستوى
        const baseReward = 0.001;
        const levelMultiplier = 1 + (user.miningLevel - 1) * 0.1;
        const reward = baseReward * levelMultiplier;
        
        energy -= 10;
        user.miningEnergy = energy;
        user.usdBalance = (user.usdBalance || 0) + reward;
        user.lastMiningClick = now;
        await user.save();
        
        res.json({
            success: true,
            newBalance: user.usdBalance,
            energy: energy,
            reward: reward.toFixed(4),
            message: `⛏️ تم التعدين! ربحت ${reward.toFixed(4)} USDT`
        });
        
    } catch (error) {
        console.error('Mining click error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في التعدين' 
        });
    }
});

// ========== شراء خطة التعدين ==========
router.post('/buy-plan', authenticateToken, async (req, res) => {
    try {
        const { planId } = req.body;
        const user = req.user;
        
        const plan = await MiningPlan.findById(planId);
        if (!plan || !plan.isActive) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ الخطة غير موجودة' 
            });
        }
        
        if (user.usdBalance < plan.price) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ رصيد غير كافٍ' 
            });
        }
        
        // خصم الرصيد
        user.usdBalance -= plan.price;
        user.miningLevel = Math.max(user.miningLevel || 1, plan.level || 1);
        await user.save();
        
        // إنشاء خطة للمستخدم
        const userPlan = new UserMiningPlan({
            userId: user._id.toString(),
            planId: plan._id.toString(),
            planName: plan.name,
            price: plan.price,
            dailyReturn: plan.dailyReturn,
            duration: plan.duration || 30,
            startDate: new Date(),
            endDate: new Date(Date.now() + (plan.duration || 30) * 24 * 60 * 60 * 1000),
            isActive: true
        });
        await userPlan.save();
        
        res.json({
            success: true,
            message: `✅ تم شراء خطة ${plan.name} بنجاح!`,
            newBalance: user.usdBalance,
            plan: userPlan
        });
        
    } catch (error) {
        console.error('Buy plan error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في شراء الخطة' 
        });
    }
});

// ========== جلب خطط المستخدم ==========
router.get('/my-plans', authenticateToken, async (req, res) => {
    try {
        const plans = await UserMiningPlan.find({ 
            userId: req.user._id.toString(),
            isActive: true 
        }).sort({ startDate: -1 });
        
        res.json({ 
            success: true, 
            plans 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في جلب الخطط' 
        });
    }
});

// ========== جمع أرباح التعدين ==========
router.post('/collect', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const plans = await UserMiningPlan.find({ 
            userId: user._id.toString(), 
            isActive: true 
        });
        
        let totalEarnings = 0;
        const now = new Date();
        
        for (const plan of plans) {
            const daysPassed = Math.floor((now - plan.startDate) / (1000 * 60 * 60 * 24));
            const daysToCollect = Math.min(daysPassed, plan.duration);
            const earnings = daysToCollect * plan.dailyReturn;
            
            if (earnings > 0) {
                totalEarnings += earnings;
                plan.lastCollected = now;
                await plan.save();
            }
        }
        
        if (totalEarnings > 0) {
            user.usdBalance = (user.usdBalance || 0) + totalEarnings;
            await user.save();
        }
        
        res.json({
            success: true,
            earnings: totalEarnings.toFixed(3),
            newBalance: user.usdBalance,
            message: totalEarnings > 0 
                ? `✅ تم جمع ${totalEarnings.toFixed(3)} USDT` 
                : '⏳ لا يوجد أرباح للجمع'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في جمع الأرباح' 
        });
    }
});

module.exports = router;
