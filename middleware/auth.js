// ==========================================
// middleware/auth.js - التحقق من التوكن (JWT)
// ==========================================

const jwt = require('jsonwebtoken');
const User = require('../src/models/User');

// ==========================================
// دالة التحقق من التوكن
// ==========================================
async function authMiddleware(req, res, next) {
  try {
    // استخراج التوكن من الهيدر
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '❌ غير مصرح: التوكن مطلوب'
      });
    }

    const token = authHeader.split(' ')[1];

    // التحقق من صحة التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // جلب المستخدم من قاعدة البيانات
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '❌ غير مصرح: المستغير غير موجود'
      });
    }

    // إضافة المستخدم إلى الطلب
    req.user = user;
    next();

  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: '❌ غير مصرح: توكن غير صالح'
    });
  }
}

// ==========================================
// دالة التحقق من صلاحية المدير
// ==========================================
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '⛔ غير مصرح: صلاحيات المدير مطلوبة'
    });
  }
  next();
}

// ==========================================
// دالة التحقق من صلاحية المدير أو المساعد
// ==========================================
function managerMiddleware(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'manager')) {
    return res.status(403).json({
      success: false,
      message: '⛔ غير مصرح: صلاحيات المدير أو المساعد مطلوبة'
    });
  }
  next();
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  managerMiddleware
};
