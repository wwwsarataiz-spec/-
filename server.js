// ==========================================
// server.js - الخادم الرئيسي (بدون مجلد public)
// ==========================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// الاتصال بقاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message));

// ==========================================
// دروع الأمان
// ==========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://telegram.org"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "*"]
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: '⛔ كثرة الطلبات، انتظر 15 دقيقة' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== تقديم الملفات الثابتة من الجذر (بدون مجلد public) =====
app.use(express.static(__dirname));

// ==========================================
// استيراد المسارات
// ==========================================
try {
  const authRoutes = require('./routes/auth');
  const userRoutes = require('./routes/user');
  const miningRoutes = require('./routes/mining');
  const casinoRoutes = require('./routes/casino');
  const tokenRoutes = require('./routes/tokens');
  const marketRoutes = require('./routes/market');
  const chatRoutes = require('./routes/chat');
  const walletRoutes = require('./routes/wallet');
  const adminRoutes = require('./routes/admin');

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/mining', miningRoutes);
  app.use('/api/casino', casinoRoutes);
  app.use('/api/tokens', tokenRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/admin', adminRoutes);

  console.log('✅ تم تحميل جميع المسارات بنجاح');
} catch (err) {
  console.error('❌ خطأ في تحميل المسارات:', err.message);
}

// ==========================================
// الصفحة الرئيسية (من الجذر)
// ==========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// معالجة الأخطاء العامة
// ==========================================
app.use((err, req, res, next) => {
  console.error('❌ خطأ في الخادم:', err);
  res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
});

// ==========================================
// تشغيل الخادم
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Nexora Elite يعمل على المنفذ ${PORT}`);
});
