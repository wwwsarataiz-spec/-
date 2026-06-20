// ==========================================
// routes/ads.js - نظام الإعلانات الممولة
// ==========================================

const express = require('express');
const router = express.Router();
const User = require('../src/models/User');
const Ad = require('../src/models/Ad');
const Transaction = require('../src/models/Transaction');

// ==========================================
// 1. مشاهدة إعلان (للمستخدم)
// ==========================================
const ADS_FOR_POINT = 15;
const POINT_VALUE = 0.01;

router.post('/watch', async (req, res) => {
  try {
    const { email } = req.body;

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

    // التحقق من وجود إعلانات متاحة
    const availableAd = await Ad.findOne({ isActive: true });
    if (!availableAd) {
      return res.json({
        success: false,
        message: '❌ لا توجد إعلانات حالياً، حاول لاحقاً'
      });
    }

    // زيادة عدد المشاهدات في الإعلان
    availableAd.viewsCount += 1;
    availableAd.remainingBudget -= availableAd.costPerView;
    if (availableAd.remainingBudget <= 0 || availableAd.viewsCount >= availableAd.totalViewsRequired) {
      availableAd.isActive = false;
    }
    await availableAd.save();

    // تحديث عداد المستخدم
    user.watchedAdsCount = (user.watchedAdsCount || 0) + 1;
    let pointEarned = false;

    if (user.watchedAdsCount >= ADS_FOR_POINT) {
      user.casinoBalance = (user.casinoBalance || 0) + POINT_VALUE;
      user.watchedAdsCount = 0;
      pointEarned = true;
    }

    await user.save();

    res.json({
      success: true,
      message: pointEarned
        ? `🎉 أكملت ${ADS_FOR_POINT} إعلاناً وحصلت على ${POINT_VALUE}$ في رصيد الكازينو!`
        : `✅ تم احتساب الإعلان. تبقى ${ADS_FOR_POINT - user.watchedAdsCount} إعلاناً للنقطة القادمة.`,
      watchedAdsCount: user.watchedAdsCount,
      casinoBalance: user.casinoBalance,
      pointEarned
    });

  } catch (error) {
    console.error('❌ Watch ad error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ أثناء مشاهدة الإعلان'
    });
  }
});

// ==========================================
// 2. إنشاء حملة إعلانية (للمعلن)
// ==========================================
router.post('/create', async (req, res) => {
  try {
    const { email, link, platform, views } = req.body;

    if (!email || !link || !views) {
      return res.status(400).json({
        success: false,
        message: '❌ جميع الحقول مطلوبة'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    const cost = views * 0.005; // 0.005$ لكل مشاهدة

    if (user.usdBalance < cost) {
      return res.json({
        success: false,
        message: `❌ رصيدك غير كافٍ! التكلفة: ${cost.toFixed(2)} USDT`
      });
    }

    // خصم التكلفة
    user.usdBalance -= cost;
    await user.save();

    // إنشاء الإعلان
    const ad = new Ad({
      link,
      platform: platform || 'telegram',
      totalBudget: cost,
      remainingBudget: cost,
      totalViewsRequired: views,
      isActive: true,
      advertiserId: user._id.toString()
    });
    await ad.save();

    // تسجيل المعاملة
    const transaction = new Transaction({
      userId: user._id,
      type: 'ad_campaign',
      amount: cost,
      status: 'approved',
      note: `حملة إعلانية (${views} مشاهدة)`
    });
    await transaction.save();

    res.json({
      success: true,
      message: `✅ تم تفعيل حملتك الإعلانية بنجاح! سيتم عرض رابطك للمستخدمين.`,
      newBalance: user.usdBalance,
      adId: ad._id
    });

  } catch (error) {
    console.error('❌ Create ad error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في إنشاء الإعلان'
    });
  }
});

// ==========================================
// 3. جلب الإعلانات النشطة
// ==========================================
router.get('/active', async (req, res) => {
  try {
    const ads = await Ad.find({ isActive: true }).select('link platform viewsCount totalViewsRequired');

    res.json({
      success: true,
      ads: ads.map(ad => ({
        link: ad.link,
        platform: ad.platform,
        progress: Math.round((ad.viewsCount / ad.totalViewsRequired) * 100)
      }))
    });

  } catch (error) {
    console.error('❌ Get ads error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في جلب الإعلانات'
    });
  }
});

// ==========================================
// 4. إحصاءات الإعلانات (للمشرف)
// ==========================================
router.get('/stats', async (req, res) => {
  try {
    const totalAds = await Ad.countDocuments();
    const activeAds = await Ad.countDocuments({ isActive: true });
    const totalViews = await Ad.aggregate([
      { $group: { _id: null, total: { $sum: '$viewsCount' } } }
    ]);

    res.json({
      success: true,
      totalAds,
      activeAds,
      totalViews: totalViews[0]?.total || 0
    });

  } catch (error) {
    console.error('❌ Ad stats error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في جلب الإحصائيات'
    });
  }
});

module.exports = router;
