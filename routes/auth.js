// ==========================================
// routes/auth.js — تسجيل الدخول والتسجيل
// ==========================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../database');
const router = express.Router();

// دالة إنشاء التوكن
function generateToken(user) {
    return jwt.sign(
        { 
            email: user.email, 
            id: user._id, 
            role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' } // صالح لـ 30 يوم
    );
}

// ========== التسجيل (Register) ==========
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;
        
        // التحقق من البيانات
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ البريد الإلكتروني وكلمة المرور مطلوبان' 
            });
        }
        
        // التحقق من طول كلمة المرور
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل' 
            });
        }
        
        // التحقق من عدم وجود المستخدم
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                message: '❌ البريد الإلكتروني مستخدم بالفعل' 
            });
        }
        
        // تشفير كلمة المرور (bcrypt)
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // إنشاء المستخدم الجديد
        const newUser = new User({
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName: name || 'مستخدم جديد',
            phoneNumber: phone || 'غير محدد',
            verified: true,
            role: 'user',
            usdBalance: 0,
            casinoBalance: 0,
            giftPoints: 0,          // نقاط الهدايا (غير قابلة للسحب)
            freeCasinoSpins: 2,
            withdrawalCount: 0,    // عدد مرات السحب هذا الأسبوع
            lastWithdrawalWeek: 0, // أسبوع آخر سحب
            createdAt: new Date()
        });
        
        await newUser.save();
        
        // إنشاء التوكن
        const token = generateToken(newUser);
        
        res.status(201).json({
            success: true,
            message: '✅ تم إنشاء الحساب بنجاح!',
            token,
            user: {
                email: newUser.email,
                name: newUser.fullName,
                role: newUser.role
            }
        });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في إنشاء الحساب' 
        });
    }
});

// ========== تسجيل الدخول (Login) ==========
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
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ 
                success: false, 
                message: '❌ البريد الإلكتروني أو كلمة المرور غير صحيحة' 
            });
        }
        
        // إنشاء التوكن
        const token = generateToken(user);
        
        res.json({
            success: true,
            message: '✅ تم تسجيل الدخول بنجاح!',
            token,
            user: {
                email: user.email,
                name: user.fullName,
                role: user.role,
                balance: user.usdBalance,
                casinoBalance: user.casinoBalance,
                giftPoints: user.giftPoints || 0,
                freeSpins: user.freeCasinoSpins
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في تسجيل الدخول' 
        });
    }
});

// ========== استعادة كلمة المرور ==========
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ لم يتم العثور على هذا البريد' 
            });
        }
        
        // إنشاء رمز التحقق (6 أرقام)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = resetCode;
        user.codeExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 دقيقة
        await user.save();
        
        // في الإنتاج: إرسال البريد الإلكتروني
        // الآن: نطبع في الكونسول للتجربة
        console.log(`🔑 رمز استعادة كلمة المرور لـ ${email}: ${resetCode}`);
        
        res.json({
            success: true,
            message: '✅ تم إرسال رمز التحقق! تحقق من بريدك الإلكتروني',
            resetCode // إزالة هذا في الإنتاج!
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في إرسال الرمز' 
        });
    }
});

// ========== تغيير كلمة المرور ==========
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.verificationCode !== code || user.codeExpiry < new Date()) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ رمز غير صالح أو منتهي الصلاحية' 
            });
        }
        
        // تشفير كلمة المرور الجديدة
        user.password = await bcrypt.hash(newPassword, 12);
        user.verificationCode = '';
        user.codeExpiry = null;
        await user.save();
        
        res.json({ 
            success: true, 
            message: '✅ تم تغيير كلمة المرور بنجاح!' 
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في تغيير كلمة المرور' 
        });
    }
});

module.exports = router;
