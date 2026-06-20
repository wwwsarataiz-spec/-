// ==========================================
// routes/tokens.js - صنع العملات الرقمية
// ==========================================

const express = require('express');
const router = express.Router();
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');

// ==========================================
// 1. دفع الرسوم من الرصيد (خصم فوري)
// ==========================================
router.post('/pay-from-balance', async (req, res) => {
  try {
    const { email, tokenName, tokenSymbol, funding } = req.body;

    if (!email || !tokenName || !tokenSymbol) {
      return res.status(400).json({
        success: false,
        message: '❌ البريد الإلكتروني، اسم العملة وكودها مطلوبة'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    const fundingAmount = parseFloat(funding) || 0;
    const totalFees = 10 + fundingAmount; // 10$ رسوم أساسية + تمويل اختياري

    if (user.usdBalance < totalFees) {
      return res.json({
        success: false,
        message: `❌ رصيدك غير كافٍ! المطلوب: ${totalFees.toFixed(2)} USDT، رصيدك: ${user.usdBalance.toFixed(2)} USDT`
      });
    }

    // خصم الرسوم
    user.usdBalance -= totalFees;
    await user.save();

    // تسجيل المعاملة
    const transaction = new Transaction({
      userId: user._id,
      type: 'custom_plan',
      amount: totalFees,
      status: 'approved',
      note: `إنشاء عملة ${tokenName} (${tokenSymbol}) - تمويل: ${fundingAmount} USDT`
    });
    await transaction.save();

    res.json({
      success: true,
      message: `✅ تم خصم ${totalFees.toFixed(2)} USDT من رصيدك. جاري إنشاء العملة ${tokenName} (${tokenSymbol}).`,
      newBalance: user.usdBalance
    });

  } catch (error) {
    console.error('❌ Pay from balance error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ أثناء الدفع'
    });
  }
});

// ==========================================
// 2. طلب إنشاء عملة (بإثبات دفع)
// ==========================================
router.post('/create', async (req, res) => {
  try {
    const { email, tokenName, tokenSymbol, funding, paymentProof } = req.body;

    if (!email || !tokenName || !tokenSymbol || !paymentProof) {
      return res.status(400).json({
        success: false,
        message: '❌ جميع الحقول مطلوبة (بما في ذلك إثبات الدفع)'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    const fundingAmount = parseFloat(funding) || 0;
    const totalFees = 10 + fundingAmount;

    // تسجيل الطلب كمعلقة
    const transaction = new Transaction({
      userId: user._id,
      type: 'custom_plan',
      amount: totalFees,
      txHash: paymentProof,
      status: 'pending',
      note: `طلب إنشاء عملة ${tokenName} (${tokenSymbol}) - تمويل: ${fundingAmount} USDT`
    });
    await transaction.save();

    res.json({
      success: true,
      message: `✅ تم استلام طلبك للعملة ${tokenName} (${tokenSymbol}). سيتم مراجعته من الإدارة خلال 24 ساعة.`,
      requestId: transaction._id
    });

  } catch (error) {
    console.error('❌ Create token error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في إرسال الطلب'
    });
  }
});

// ==========================================
// 3. جلب طلبات العملات (للمشرف)
// ==========================================
router.get('/requests', async (req, res) => {
  try {
    const transactions = await Transaction.find({ 
      type: 'custom_plan',
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      requests: transactions.map(t => ({
        id: t._id,
        userId: t.userId,
        amount: t.amount,
        txHash: t.txHash,
        note: t.note,
        date: t.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Get token requests error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ في جلب الطلبات'
    });
  }
});

module.exports = router;
