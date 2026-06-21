// ==========================================
// auth.js - نظام المصادقة (بدون مجلدات)
// ==========================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('./User');  // ← من الجذر، وليس من مجلد
const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phone, telegram, referralCode } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'جميع الحقول المطلوبة' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور 6 أحرف على الأقل' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'البريد مسجل بالفعل' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = email.substring(0, 4) + Math.random().toString(36).substring(2, 6);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      phone: phone || 'غير محدد',
      telegram: telegram || 'غير محدد',
      referralCode: newReferralCode,
      referredBy: referralCode || null,
      freeSpins: 2,
      role: 'user'
    });
    await user.save();
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        if (!referrer.referrals) referrer.referrals = [];
        referrer.referrals.push(email);
        await referrer.save();
      }
    }
    const token = generateToken(user);
    res.status(201).json({
      success: true,
      message: '✅ تم إنشاء الحساب بنجاح',
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ success: false, message: 'خطأ في التسجيل' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'البريد وكلمة المرور مطلوبة' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'بيانات غير صحيحة' });
    }
    if (user.banned) {
      return res.status(403).json({ success: false, message: '🚫 هذا الحساب محظور' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'بيانات غير صحيحة' });
    }
    const token = generateToken(user);
    res.json({
      success: true,
      message: '✅ تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance: user.balance,
        casinoBalance: user.casinoBalance,
        giftPoints: user.giftPoints,
        freeSpins: user.freeSpins
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, message: 'خطأ في تسجيل الدخول' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'البريد غير موجود' });
    }
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = resetCode;
    user.codeExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    console.log(`🔑 رمز استعادة كلمة المرور لـ ${email}: ${resetCode}`);
    res.json({
      success: true,
      message: '✅ تم إرسال رمز الاستعادة',
      resetCode: resetCode
    });
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ success: false, message: 'خطأ في إرسال الرمز' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    if (user.verificationCode !== code) {
      return res.status(400).json({ success: false, message: 'رمز غير صحيح' });
    }
    if (user.codeExpiry && new Date() > new Date(user.codeExpiry)) {
      return res.status(400).json({ success: false, message: 'انتهت صلاحية الرمز' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.verificationCode = null;
    user.codeExpiry = null;
    await user.save();
    res.json({
      success: true,
      message: '✅ تم تغيير كلمة المرور بنجاح'
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ success: false, message: 'خطأ في تغيير كلمة المرور' });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance: user.balance,
        casinoBalance: user.casinoBalance,
        giftPoints: user.giftPoints,
        freeSpins: user.freeSpins
      }
    });
  } catch (error) {
    console.error('❌ Verify error:', error);
    res.status(401).json({ success: false, message: 'توكن غير صالح' });
  }
});

module.exports = router;
