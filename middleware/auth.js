// ==========================================
// middleware/auth.js — الحارس الشخصي
// يتحقق من هوية المستخدم قبل السماح له بالوصول
// ==========================================

const jwt = require('jsonwebtoken');
const { User } = require('../database');

// التحقق من تسجيل الدخول (JWT Token)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    // لو ما فيه توكن = ما مسجل دخول
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: '❌ يجب تسجيل الدخول أولاً' 
        });
    }
    
    // فك التشفير والتحقق
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: '❌ التوكن غير صالح أو منتهي الصلاحية' 
            });
        }
        
        // جلب بيانات المستخدم من قاعدة البيانات
        try {
            const user = await User.findOne({ email: decoded.email });
            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: '❌ المستخدم غير موجود' 
                });
            }
            req.user = user; // نحفظ المستخدم في الطلب للاستخدام لاحقاً
            next(); // نكمل للمسار التالي
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: '❌ خطأ في التحقق من الهوية' 
            });
        }
    });
}

// التحقق من أنه مشرف
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: '⛔ صلاحيات غير كافية - يجب أن تكون مشرفاً' 
        });
    }
    next();
}

// التحقق من أنه مشرف أو مدير
function requireManager(req, res, next) {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'manager')) {
        return res.status(403).json({ 
            success: false, 
            message: '⛔ صلاحيات غير كافية' 
        });
    }
    next();
}

module.exports = { 
    authenticateToken, 
    requireAdmin, 
    requireManager 
};
