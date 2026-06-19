// ==========================================
// routes/ads.js — الإعلانات الممولة
// ==========================================

const express = require('express');
const { User, Ad, AdLog } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ========== إنشاء حملة إعلانية ==========
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { link, platform, views } = req.body;
        const user = req.user;
        const viewCount = parseInt(views) || 1000;
        const costPerView = 0.005;
        const totalCost = viewCount * costPerView;
        
        // التحقق من الرصيد
        if (user.usdBalance < totalCost) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ رصيد غير كافٍ' 
            });
        }
        
        // إنشاء الإعلان
        const ad = new Ad({
            link,
            platform,
            totalBudget: totalCost,
            remainingBudget: totalCost,
            costPerView,
            totalViewsRequired: viewCount,
            viewsCount: 0,
            isActive: true,
            advertiserId: user._id.toString()
        });
        
        await ad.save();
        
        // خصم الرصيد
        user.usdBalance -= totalCost;
        await user.save();
        
        res.json({
            success: true,
            message: `✅ تم إنشاء الحملة بنجاح! التكلفة: ${totalCost.toFixed(2)} USDT`,
            newBalance: user.usdBalance,
            adId: ad._id
        });
        
    } catch (error) {
        console.error('Create ad error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في إنشاء الحملة' 
        });
    }
});

// ========== مشاهدة إعلان والربح ==========
router.post('/watch', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const now = Date.now();
        
        // فترة انتظار: 30 ثانية بين الإعلانات
        if (user.lastAdTime && (now - user.lastAdTime) < 30000) {
            const wait = Math.ceil((30000 - (now - user.lastAdTime)) / 1000);
            return res.status(429).json({ 
                success: false, 
                message: `⏳ انتظر ${wait} ثانية` 
            });
        }
        
        // جلب إعلان عشوائي نشط
        const ads = await Ad.find({ 
            isActive: true, 
            remainingBudget: { $gte: 0.005 } 
        });
        
        if (ads.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ لا توجد إعلانات متاحة حالياً' 
            });
        }
        
        const ad = ads[Math.floor(Math.random() * ads.length)];
        
        // التحقق من عدم المشاهدة مؤخراً (24 ساعة)
        const recentLog = await AdLog.findOne({
            telegramId: user._id.toString(),
            adId: ad._id,
            viewedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        if (recentLog) {
            return res.status(429).json({ 
                success: false, 
                message: '❌ شاهدت هذا الإعلان مؤخراً' 
            });
        }
        
        // تسجيل المشاهدة
        const adLog = new AdLog({
            telegramId: user._id.toString(),
            adId: ad._id
        });
        await adLog.save();
        
        // تحديث الإعلان
        ad.viewsCount += 1;
        ad.remainingBudget -= ad.costPerView;
        if (ad.remainingBudget <= 0 || ad.viewsCount >= ad.totalViewsRequired) {
            ad.isActive = false;
        }
        await ad.save();
        
        // مكافأة المستخدم
        user.watchedAdsCount = (user.watchedAdsCount || 0) + 1;
        user.lastAdTime = now;
        
        let bonusMessage = '';
        // كل 15 إعلان = 0.01$ رصيد كازينو
        if (user.watchedAdsCount >= 15) {
            user.casinoBalance = (user.casinoBalance || 0) + 0.01;
            user.watchedAdsCount = 0;
            bonusMessage = ' + مكافأة 0.01$!';
        }
        
        await user.save();
        
        res.json({
            success: true,
            message: `✅ تمت المشاهدة!${bonusMessage}`,
            watchedAdsCount: user.watchedAdsCount,
            casinoBalance: user.casinoBalance,
            adLink: ad.link
        });
        
    } catch (error) {
        console.error('Watch ad error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في المشاهدة' 
        });
    }
});

// ========== جلب الإعلانات المتاحة ==========
router.get('/available', authenticateToken, async (req, res) => {
    try {
        const ads = await Ad.find({ isActive: true }).limit(10);
        res.json({ 
            success: true, 
            ads 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في جلب الإعلانات' 
        });
    }
});

module.exports = router;
