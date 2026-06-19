// ==========================================
// routes/user.js — بيانات المستخدم الشخصية
// ==========================================

const express = require('express');
const { User, Transaction, UserMiningPlan } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ========== جلب بيانات المستخدم ==========
router.post('/user-data', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        
        // جلب خطط التعدين النشطة
        const activePlans = await UserMiningPlan.find({ 
            userId: user._id.toString(), 
            isActive: true 
        });
        
        // حساب أرباح التعدين
        let miningEarnings = 0;
        for (const plan of activePlans) {
            const daysPassed = Math.floor((Date.now() - plan.startDate) / (1000 * 60 * 60 * 24));
            const daysToCount = Math.min(daysPassed, plan.duration);
            miningEarnings += daysToCount * plan.dailyReturn;
        }
        
        // التحقق من حالة السحب الأسبوعي
        const currentWeek = getWeekNumber(new Date());
        const canWithdraw = user.lastWithdrawalWeek !== currentWeek || user.withdrawalCount < 3;
        
        res.json({
            success: true,
            usdBalance: user.usdBalance || 0,
            casinoBalance: user.casinoBalance || 0,
            giftPoints: user.giftPoints || 0,        // نقاط الهدايا (غير قابلة للسحب)
            freeSpins: user.freeCasinoSpins || 0,
            watchedAdsCount: user.watchedAdsCount || 0,
            energy: user.miningEnergy || 1000,
            miningLevel: user.miningLevel || 1,
            vipPlanLevel: user.vipPlanLevel || 1,
            name: user.fullName,
            email: user.email,
            role: user.role,
            verified: user.verified,
            activeMiningPlans: activePlans.length,
            miningEarnings: parseFloat(miningEarnings.toFixed(3)),
            canWithdraw: canWithdraw,                 // هل يمكن السحب هذا الأسبوع؟
            withdrawalCount: user.withdrawalCount || 0, // عدد مرات السحب
            walletAddress: user.walletAddress || ''
        });
        
    } catch (error) {
        console.error('User data error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في جلب البيانات' 
        });
    }
});

// ========== تعديل الملف الشخصي ==========
router.post('/update-profile', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const user = req.user;
        
        if (name) user.fullName = name;
        await user.save();
        
        res.json({ 
            success: true, 
            message: '✅ تم تحديث الملف الشخصي' 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في التحديث' 
        });
    }
});

// ========== جلب سجل المعاملات ==========
router.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({ 
            userId: req.user._id.toString() 
        })
        .sort({ createdAt: -1 })
        .limit(50);
        
        res.json({ 
            success: true, 
            transactions 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في جلب المعاملات' 
        });
    }
});

// ========== دالة مساعدة: رقم الأسبوع ==========
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = router;
