// ==========================================
// routes/admin.js - لوحة التحكم الإدارية
// ==========================================

const express = require('express');
const router = express.Router();
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const AdminLog = require('../src/models/AdminLog');
const Ad = require('../src/models/Ad');
const authMiddleware = require('../middleware/auth');

// ==========================================
// جلب جميع بيانات لوحة التحكم
// ==========================================
router.get('/dashboard-data', async (req, res) => {
  try {
    const users = await User.find();
    const transactions = await Transaction.find();
    const pendingRequests = await Transaction.find({ status: 'pending' });
    const ads = await Ad.find({ isActive: true });

    res.json({
      success: true,
      usersCount: users.length,
      requests: pendingRequests,
      users: users.map(u => ({
        id: u._id,
        name: u.username,
        email: u.email,
        role: u.role,
        usdBalance: u.usdBalance,
        casinoBalance: u.casinoBalance,
        giftPoints: u.giftPoints,
        verified: u.verified
      })),
      ads: ads,
      totalBalance: users.reduce((sum, u) => sum + (u.usdBalance || 0), 0)
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
  }
});

// ==========================================
// معالجة الطلبات (قبول/رفض)
// ==========================================
router.post('/process-request', async (req, res) => {
  const { requestId, action } = req.body;

  try {
    const transaction = await Transaction.findById(requestId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    if (action === 'approve') {
      transaction.status = 'approved';
      
      // تحديث رصيد المستخدم إذا كان إيداعاً
      if (transaction.type === 'deposit') {
        const user = await User.findById(transaction.userId);
        if (user) {
          user.usdBalance += transaction.amount;
          await user.save();
        }
      }
    } else if (action === 'reject') {
      transaction.status = 'rejected';
      
      // إعادة المبلغ إذا كان سحباً
      if (transaction.type === 'withdrawal') {
        const user = await User.findById(transaction.userId);
        if (user) {
          user.usdBalance += transaction.amount;
          await user.save();
        }
      }
    } else {
      return res.status(400).json({ success: false, message: 'إجراء غير صالح' });
    }

    await transaction.save();

    // تسجيل في سجل الإدارة
    await AdminLog.create({
      adminId: req.body.adminId || 'system',
      action: action === 'approve' ? 'approve_deposit' : 'reject_deposit',
      targetId: transaction.userId,
      details: `${action === 'approve' ? 'قبول' : 'رفض'} طلب ${transaction.type} بمبلغ ${transaction.amount}`
    });

    res.json({ success: true, message: 'تم تحديث الطلب بنجاح' });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ success: false, message: 'خطأ في معالجة الطلب' });
  }
});

// ==========================================
// تعديل رصيد المستخدم
// ==========================================
router.post('/modify-balance', async (req, res) => {
  const { email, newBalance } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    user.usdBalance = parseFloat(newBalance);
    await user.save();

    await AdminLog.create({
      adminId: req.body.adminId || 'system',
      action: 'modify_balance',
      targetId: user._id,
      details: `تعديل رصيد المستخدم ${user.email} إلى ${newBalance}`
    });

    res.json({ success: true, message: 'تم تحديث الرصيد بنجاح' });
  } catch (error) {
    console.error('Error modifying balance:', error);
    res.status(500).json({ success: false, message: 'خطأ في تعديل الرصيد' });
  }
});

// ==========================================
// إرسال نقاط هدايا
// ==========================================
router.post('/send-gift-points', async (req, res) => {
  const { email, points } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    user.giftPoints = (user.giftPoints || 0) + parseFloat(points);
    await user.save();

    await AdminLog.create({
      adminId: req.body.adminId || 'system',
      action: 'send_gift_points',
      targetId: user._id,
      details: `إرسال ${points} نقطة هدايا للمستخدم ${user.email}`
    });

    res.json({ success: true, message: `تم إرسال ${points} نقطة هدايا بنجاح` });
  } catch (error) {
    console.error('Error sending gift points:', error);
    res.status(500).json({ success: false, message: 'خطأ في إرسال النقاط' });
  }
});

// ==========================================
// إرسال رصيد كازينو
// ==========================================
router.post('/send-casino-balance', async (req, res) => {
  const { email, amount } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    user.casinoBalance = (user.casinoBalance || 0) + parseFloat(amount);
    await user.save();

    await AdminLog.create({
      adminId: req.body.adminId || 'system',
      action: 'modify_casino_balance',
      targetId: user._id,
      details: `إرسال ${amount} رصيد كازينو للمستخدم ${user.email}`
    });

    res.json({ success: true, message: `تم إرسال ${amount} رصيد كازينو بنجاح` });
  } catch (error) {
    console.error('Error sending casino balance:', error);
    res.status(500).json({ success: false, message: 'خطأ في إرسال الرصيد' });
  }
});

// ==========================================
// جلب إحصائيات عامة
// ==========================================
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawals = await Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      totalUsers,
      totalDeposits: totalDeposits[0]?.total || 0,
      totalWithdrawals: totalWithdrawals[0]?.total || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات' });
  }
});

module.exports = router;
