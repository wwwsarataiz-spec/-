// ==========================================
// routes/mining.js - نظام التعدين والطاقة
// ==========================================

const express = require('express');
const router = express.Router();
const User = require('../src/models/User');
const MiningPlan = require('../src/models/MiningPlan');
const Transaction = require('../src/models/Transaction');

// ==========================================
// 1. النقر على زر التعدين
// ==========================================
router.post('/click', async (req, res) => {
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

    if (user.miningEnergy < 20) {
      return res.json({
        success: false,
        message: '⛔ الطاقة منخفضة! انتظر حتى تتجدد',
        energy: user.miningEnergy
      });
    }

    user.miningEnergy -= 20;
    user.usdBalance = (user.usdBalance || 0) + 0.01;
    user.lastMiningClick = new Date();

    await user.save();

    res.json({
      success: true,
      message: '✅ تم التعدين بنجاح! +0.01 USDT',
      newBalance: user.usdBalance,
      energy: user.miningEnergy
    });

  } catch (error) {
    console.error('❌ Mining click error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ أثناء التعدين'
    });
  }
});

// ==========================================
// 2. جلب خطط التعدين
// ==========================================
router.get('/plans', async (req, res) => {
  try {
    const plans = await MiningPlan.find({ isActive: true });

    res.json({
      success: true,
      plans: plans.map(p => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        dailyReturn: p.dailyReturn,
        duration: p.duration,
        level: p.level,
        description: p.description
      }))
    });

  } catch (error) {
    console.error('❌ Mining plans error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في جلب الخطط'
    });
  }
});

// ==========================================
// 3. شراء خطة تعدين
// ==========================================
router.post('/buy-plan', async (req, res) => {
  try {
    const { email, planId } = req.body;

    if (!email || !planId) {
      return res.status(400).json({
        success: false,
        message: '❌ البريد الإلكتروني ومعرف الخطة مطلوبان'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    const plan = await MiningPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: '❌ الخطة غير موجودة'
      });
    }

    if (user.usdBalance < plan.price) {
      return res.json({
        success: false,
        message: `❌ رصيدك غير كافٍ! تحتاج ${plan.price} USDT`
      });
    }

    user.usdBalance -= plan.price;
    await user.save();

    const transaction = new Transaction({
      userId: user._id,
      type: 'custom_plan',
      amount: plan.price,
      status: 'approved',
      note: `شراء خطة ${plan.name} (${plan.duration} يوم)`
    });
    await transaction.save();

    res.json({
      success: true,
      message: `✅ تم شراء خطة ${plan.name} بنجاح!`,
      newBalance: user.usdBalance
    });

  } catch (error) {
    console.error('❌ Buy plan error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في شراء الخطة'
    });
  }
});

// ==========================================
// 4. تجديد الطاقة تلقائياً (كل 10 دقائق)
// ==========================================
router.post('/recharge-energy', async (req, res) => {
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

    user.miningEnergy = 1000;
    await user.save();

    res.json({
      success: true,
      message: '✅ تم تجديد الطاقة بالكامل!',
      energy: user.miningEnergy
    });

  } catch (error) {
    console.error('❌ Recharge energy error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في تجديد الطاقة'
    });
  }
});

module.exports = router;
