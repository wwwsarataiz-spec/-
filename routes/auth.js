// ==========================================
// routes/auth.js — تسجيل الدخول والتسجيل
// ==========================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User'); // سيتم إنشاء هذا الملف لاحقاً
const router = express.Router();

// ==========================================
// دالة إنشاء التوكن
// ==========================================
function generateToken(user) {
    return jwt.sign(
        { 
            email: user.email, 
            id: user._id, 
            role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

// ==========================================
// 1. التسجيل (Register)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;
        
        // التحقق من البيانات الأساسية
        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ البريد الإلكتروني، الاسم، وكلمة المرور مطلوبة' 
            });
        }
        
        // التحقق من طول كلمة المرور
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل' 
            });
        }
        
        // التحقق من عدم وجود المستخدم مسبقاً
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                message: '❌ هذا البريد الإلكتروني مستخدم بالفعل' 
            });
        }
        
        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // إنشاء المستخدم الجديد
        const newUser = new User({
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName: name,
            phoneNumber: phone || 'غير محدد',
            role: 'user',
            verified: true, // للتجربة، سنفعل الحساب تلقائياً
            usdBalance: 0,
            casinoBalance: 0,
            giftPoints: 0,
            freeCasinoSpins: 2,
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
                role: newUser.role,
                balance: newUser.usdBalance,
                casinoBalance: newUser.casinoBalance,
                freeSpins: newUser.freeCasinoSpins
            }
        });
        
    } catch (error) {
        console.error('❌ خطأ في التسجيل:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ حدث خطأ في إنشاء الحساب' 
        });
    }
});

// ==========================================
// 2. تسجيل الدخول (Login)
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
        
        // إنشاء التوكن
        const token = generateToken(user);
        
        res.json({
            success: true,
            message: '✅ تم تسجيل الدخول بنجاح!',
            token,
            user: {
                id: user._id,
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
        console.error('❌ خطأ في تسجيل الدخول:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ حدث خطأ في تسجيل الدخول' 
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
        
        // إنشاء رمز تحقق عشوائي (6 أرقام)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = resetCode;
        user.codeExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 دقيقة
        await user.save();
        
        // في الوقت الحالي، نطبع الرمز في الكونسول للتجربة
        console.log(`🔑 رمز استعادة كلمة المرور لـ ${email}: ${resetCode}`);
        
        // هنا سيتم إرسال البريد الإلكتروني في المرحلة القادمة
        // await sendResetEmail(email, resetCode);
        
        res.json({
            success: true,
            message: '✅ تم إرسال رمز التحقق إلى بريدك الإلكتروني',
            // فقط للتجربة: نرسل الرمز في الرد (سيتم حذفه في الإنتاج)
            resetCode: process.env.NODE_ENV === 'development' ? resetCode : undefined
        });
        
    } catch (error) {
        console.error('❌ خطأ في استعادة كلمة المرور:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ حدث خطأ في إرسال الرمز' 
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
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ المستخدم غير موجود' 
            });
        }
        
        // التحقق من صحة الرمز وصلاحيته
        if (user.verificationCode !== code) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ رمز غير صحيح' 
            });
        }
        
        if (user.codeExpiry && new Date() > new Date(user.codeExpiry)) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ انتهت صلاحية الرمز، يرجى طلب رمز جديد' 
            });
        }
        
        // تشفير كلمة المرور الجديدة
        user.password = await bcrypt.hash(newPassword, 12);
        user.verificationCode = null;
        user.codeExpiry = null;
        await user.save();
        
        res.json({ 
            success: true, 
            message: '✅ تم تغيير كلمة المرور بنجاح!' 
        });
        
    } catch (error) {
        console.error('❌ خطأ في إعادة تعيين كلمة المرور:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ حدث خطأ في تغيير كلمة المرور' 
        });
    }
});

module.exports = router;
