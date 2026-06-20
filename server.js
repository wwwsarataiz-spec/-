// ==========================================
// server.js — الخادم الرئيسي
// ==========================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ==========================================
// الاتصال بقاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// ==========================================
// إعداد التطبيق
// ==========================================
const app = express();

// الأمان
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://telegram.org"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "https://nexora-backend-ko1u.onrender.com"]
    }
  }
}));

// السماح بالطلبات من الواجهة
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// الحد من الطلبات (منع الهجمات)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب لكل IP
  message: { success: false, message: '⛔ كثرة الطلبات، انتظر 15 دقيقة' }
});
app.use('/api/', limiter);

// قراءة البيانات القادمة
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// الملفات الثابتة (الواجهة الأمامية)
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// المسارات (Routes)
// ==========================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/mining', require('./routes/mining'));
app.use('/api/casino', require('./routes/casino'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/tokens', require('./routes/tokens'));

// ==========================================
// الصفحة الرئيسية
// ==========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// معالجة الأخطاء العامة
// ==========================================
app.use((err, req, res, next) => {
  console.error('❌ خطأ في الخادم:', err);
  res.status(500).json({ 
    success: false, 
    message: '❌ خطأ في الخادم الداخلي' 
  });
});

// ==========================================
// تشغيل الخادم
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
});
