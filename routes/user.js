// routes/user.js - بدون أي controllers
const express = require('express');
const router = express.Router();
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');

// 1. جلب بيانات المستخدم
router.post('/user-data', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'البريد مطلوب' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    res.json({
      success: true,
      usdBalance: user.usdBalance || 0,
      casinoBalance: user.casinoBalance || 0,
      giftPoints: user.giftPoints || 0,
      freeSpins: user.freeCasinoSpins || 0,
      energy: user.miningEnergy || 1000,
      name: user.username,
      role: user.role,
      watchedAdsCount: user.watchedAdsCount || 0,
      canWithdraw: true,
      withdrawalCount: user.withdrawalCount || 0
    });
  } catch (error) {
    console.error('❌ User data error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
  }
});

// 2. تحديث الملف الشخصي
router.post('/update-profile', async (req, res) => {
  try {
    const { email, username, phoneNumber } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'البريد مطلوب' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    if (username) user.username = username.trim();
    if (phoneNumber) user.phoneNumber = phoneNumber;
    await user.save();
    res.json({ success: true, message: '✅ تم تحديث الملف الشخصي' });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ success: false, message: 'خطأ في التحديث' });
  }
});

// 3. جلب المعاملات
router.get('/transactions', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'البريد مطلوب' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    const transactions = await Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('❌ Transactions error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب المعاملات' });
  }
});

// 4. رابط الإحالة
router.post('/referral-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'البريد مطلوب' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    const referralCode = user.referralCode || btoa(user.email).substring(0, 8);
    if (!user.referralCode) {
      user.referralCode = referralCode;
      await user.save();
    }
    res.json({ success: true, referralCode, referralLink: `https://t.me/NexoraBot?start=${referralCode}` });
  } catch (error) {
    console.error('❌ Referral link error:', error);
    res.status(500).json({ success: false, message: 'خطأ في توليد الرابط' });
  }
});

// 5. تحديث الطاقة
router.post('/update-energy', async (req, res) => {
  try {
    const { email, energy } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'البريد مطلوب' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    user.miningEnergy = Math.min(Math.max(energy, 0), 1000);
    await user.save();
    res.json({ success: true, energy: user.miningEnergy });
  } catch (error) {
    console.error('❌ Update energy error:', error);
    res.status(500).json({ success: false, message: 'خطأ في تحديث الطاقة' });
  }
});

module.exports = router;
