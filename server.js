// ==========================================
// server.js - الخادم الرئيسي (بدون مجلدات)
// ==========================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URL || process.env.MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات'))
  .catch(err => console.error('❌ فشل الاتصال:', err.message));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ===== استيراد المسارات (من الجذر مباشرة، بدون مجلدات) =====
app.use('/api/auth', require('./auth'));
app.use('/api/user', require('./user'));
app.use('/api/mining', require('./mining'));
app.use('/api/casino', require('./casino'));
app.use('/api/tokens', require('./tokens'));
app.use('/api/market', require('./market'));
app.use('/api/chat', require('./chat'));
app.use('/api/wallet', require('./wallet'));
app.use('/api/admin', require('./admin'));

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
});
