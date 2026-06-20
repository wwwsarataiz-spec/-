// ==========================================
// middleware/rateLimit.js - الحد من الطلبات
// ==========================================

const rateLimit = require('express-rate-limit');

// ==========================================
// حد عام لجميع الطلبات (100 طلب لكل IP كل 15 دقيقة)
// ==========================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب
  message: {
    success: false,
    message: '⛔ كثرة الطلبات من هذا الجهاز، يرجى الانتظار 15 دقيقة'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// حد خاص لتسجيل الدخول (5 محاولات لكل IP كل 10 دقائق)
// ==========================================
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 دقائق
  max: 5, // 5 محاولات فقط
  message: {
    success: false,
    message: '⛔ كثرة محاولات تسجيل الدخول، يرجى الانتظار 10 دقائق'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// حد خاص لإنشاء الحسابات (3 محاولات لكل IP كل ساعة)
// ==========================================
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ساعة
  max: 3, // 3 محاولات فقط
  message: {
    success: false,
    message: '⛔ كثرة محاولات إنشاء الحسابات، يرجى الانتظار ساعة'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// حد خاص للعاب الكازينو (50 طلب لكل IP كل 5 دقائق)
// ==========================================
const casinoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 دقائق
  max: 50, // 50 طلب
  message: {
    success: false,
    message: '⛔ كثرة الطلبات على الكازينو، يرجى الانتظار 5 دقائق'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  casinoLimiter,
};
