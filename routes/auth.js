// ==========================================
// routes/auth.js - نظام المصادقة (تسجيل ودخول)
// ==========================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');

// ==========================================
// دالة مساعدة لتوليد التوكن
// ==========================================
function generateToken(user) {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ==========================================
// 1. تسجيل حساب جديد
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phoneNumber, referralCode } = req.body;

    // التحقق من البيانات المطلوبة
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ الاسم، البريد الإلكتروني وكلمة المرور مطلوبة'
      });
    }

    // التحقق من طول كلمة المرور
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    // التحقق من عدم وجود البريد
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '❌ هذا البريد الإلكتروني مسجل بالفعل'
      });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // إنشاء المستخدم
    const newUser = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phoneNumber: phoneNumber || '',
      referredBy: referralCode || null,
      verified: true, // تفعيل تلقائي (بدون بريد إلكتروني)
      freeCasinoSpins: 2, // هدية التسجيل
      role: 'user'
    });

    await newUser.save();

    // توليد التوكن
    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: '✅ تم إنشاء الحساب بنجاح!',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        usdBalance: newUser.usdBalance,
        casinoBalance: newUser.casinoBalance,
        giftPoints: newUser.giftPoints,
        freeSpins: newUser.freeCasinoSpins
      }
    });

  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ أثناء التسجيل'
    });
  }
});

// ==========================================
// 2. تسجيل الدخول
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    // البحث عن المستخدم
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '❌ البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // التحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '❌ البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // توليد التوكن
    const token = generateToken(user);

    res.json({
      success: true,
      message: '✅ تم تسجيل الدخول بنجاح!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        usdBalance: user.usdBalance,
        casinoBalance: user.casinoBalance,
        giftPoints: user.giftPoints,
        freeSpins: user.freeCasinoSpins
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ أثناء تسجيل الدخول'
    });
  }
});

// ==========================================
// 3. استعادة كلمة المرور (نسيت كلمة السر)
// ==========================================
router.post('/forgot-password', async (req, res) => {
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
        message: '❌ لم يتم العثور على هذا البريد'
      });
    }

    // توليد رمز استعادة (6 أرقام)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // حفظ الرمز في قاعدة البيانات (مع صلاحية 30 دقيقة)
    user.verificationCode = resetCode;
    user.codeExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    // في الإنتاج: إرسال البريد الإلكتروني
    // هنا نعرض الرمز في الكونسول للتجربة
    console.log(`🔑 رمز استعادة كلمة المرور لـ ${email}: ${resetCode}`);

    res.json({
      success: true,
      message: '✅ تم إرسال رمز الاستعادة إلى بريدك الإلكتروني',
      // ⚠️ فقط للتجربة، احذف هذا السطر في الإنتاج
      resetCode: resetCode
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ أثناء إرسال الرمز'
    });
  }
});

// ==========================================
// 4. إعادة تعيين كلمة المرور
// ==========================================
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '❌ جميع الحقول مطلوبة'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    // التحقق من الرمز
    if (user.verificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: '❌ رمز غير صحيح'
      });
    }

    if (user.codeExpiry && new Date() > new Date(user.codeExpiry)) {
      return res.status(400).json({
        success: false,
        message: '❌ انتهت صلاحية الرمز'
      });
    }

    // تشفير كلمة المرور الجديدة
    user.password = await bcrypt.hash(newPassword, 10);
    user.verificationCode = '';
    user.codeExpiry = null;
    await user.save();

    res.json({
      success: true,
      message: '✅ تم تغيير كلمة المرور بنجاح!'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: '❌ حدث خطأ أثناء تغيير كلمة المرور'
    });
  }
});

// ==========================================
// 5. التحقق من التوكن (للجلسات)
// ==========================================
router.get('/verify-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '❌ غير مصرح'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ المستخدم غير موجود'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        usdBalance: user.usdBalance,
        casinoBalance: user.casinoBalance,
        giftPoints: user.giftPoints,
        freeSpins: user.freeCasinoSpins
      }
    });

  } catch (error) {
    console.error('❌ Verify token error:', error);
    res.status(401).json({
      success: false,
      message: '❌ توكن غير صالح'
    });
  }
});

module.exports = router;
