// ==========================================
// routes/wallet.js - إدارة المحفظة
// ==========================================

const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { Transaction } = require('../models/Transaction');

// ==========================================
// عنوان المحفظة الرسمي
// ==========================================
const OFFICIAL_WALLET = {
  trc20: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46",
  bsc: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46",
  eth: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46"
};

// ==========================================
// 1. جلب عنوان المحفظة
// ==========================================
router.get('/address', (req, res) => {
  res.json({
    success: true,
    address: OFFICIAL_WALLET.trc20,
    networks: OFFICIAL_WALLET
  });
});

// ==========================================
// 2. إرسال إثبات إيداع
// ==========================================
router.post('/deposit', async (req, res) => {
  try {
    const { email, amount, txHash, receipt } = req.body;

    if (!email || !amount || !txHash) {
      return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ يجب أن يكون موجباً' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    // التحقق من عدم تكرار الهاش
    const existing = await Transaction.findOne({ txHash });
    if (existing) {
      return res.json({ success: false, message: 'هذا الهاش مستخدم مسبقاً' });
    }

    // إنشاء طلب إيداع معلق
    const transaction = new Transaction({
      userId: user._id,
      type: 'deposit',
      amount: parseFloat(amount),
      txHash: txHash,
      receipt: receipt || '',
      status: 'pending',
      note: `إيداع من ${user.email}`
    });
    await transaction.save();

    res.json({
      success: true,
      message: '✅ تم إرسال إثبات الإيداع، سيتم مراجعته من الإدارة',
      transactionId: transaction._id
    });

  } catch (error) {
    console.error('❌ Deposit error:', error);
    res.status(500).json({ success: false, message: 'خطأ في إرسال الإيداع' });
  }
});

// ==========================================
// 3. طلب سحب
// ==========================================
router.post('/withdraw', async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ يجب أن يكون موجباً' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (user.balance < amount) {
      return res.json({ success: false, message: 'رصيد غير كافٍ' });
    }

    // خصم المبلغ مؤقتاً
    user.balance -= amount;
    await user.save();

    // إنشاء طلب سحب معلق
    const transaction = new Transaction({
      userId: user._id,
      type: 'withdrawal',
      amount: parseFloat(amount),
      txHash: '',
      status: 'pending',
      note: `سحب من ${user.email}`
    });
    await transaction.save();

    res.json({
      success: true,
      message: '✅ تم إرسال طلب السحب، سيتم معالجته خلال 24 ساعة',
      newBalance: user.balance,
      transactionId: transaction._id
    });

  } catch (error) {
    console.error('❌ Withdraw error:', error);
    res.status(500).json({ success: false, message: 'خطأ في طلب السحب' });
  }
});

// ==========================================
// 4. جلب سجل المعاملات للمستخدم
// ==========================================
router.post('/transactions', async (req, res) => {
  try {
    const { email, limit = 20, skip = 0 } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Transaction.countDocuments({ userId: user._id });

    res.json({
      success: true,
      transactions,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

  } catch (error) {
    console.error('❌ Transactions error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب المعاملات' });
  }
});

// ==========================================
// 5. تحويل من الرصيد الأساسي إلى رصيد الكازينو
// ==========================================
router.post('/transfer-to-casino', async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ يجب أن يكون موجباً' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (user.balance < amount) {
      return res.json({ success: false, message: 'رصيد غير كافٍ' });
    }

    user.balance -= amount;
    user.casinoBalance = (user.casinoBalance || 0) + amount;
    await user.save();

    res.json({
      success: true,
      message: `✅ تم تحويل ${amount} USDT إلى رصيد الكازينو`,
      newBalance: user.balance,
      newCasinoBalance: user.casinoBalance
    });

  } catch (error) {
    console.error('❌ Transfer to casino error:', error);
    res.status(500).json({ success: false, message: 'خطأ في التحويل' });
  }
});

module.exports = router;
