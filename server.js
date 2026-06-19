// ==========================================
// server.js — السيرفر الرئيسي (Express API)
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
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات'))
  .catch(err => console.error('❌ فشل الاتصال:', err));

// ==========================================
// إعداد Express
// ==========================================
const app = express();

// حماية ضد القرصنة (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://telegram.org"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://nexora-backend-ko1u.onrender.com"]
    }
  }
}));

// السماح للواجهة بالتواصل
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// حماية ضد الهجوم (Rate Limiting)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب لكل IP
  message: { 
    success: false, 
    message: '⛔ كثرة الطلبات، انتظر 15 دقيقة' 
  },
  standardHeaders: true,
  legacyHeaders: false
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
  console.error('❌ خطأ:', err);
  res.status(500).json({ 
    success: false, 
    message: '❌ خطأ في السيرفر' 
  });
});

// ==========================================
// تشغيل السيرفر
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Nexora Elite Server يعمل على المنفذ ${PORT}`);
  console.log(`📍 الرابط: ${process.env.FRONTEND_URL || `http://localhost:${PORT}`}`);
});

// معالجة الأخطاء غير المتوقعة
process.on('unhandledRejection', (err) => {
  console.error('❌ خطأ غير متوقع:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ خطأ فادح:', err);
  process.exit(1);
});
