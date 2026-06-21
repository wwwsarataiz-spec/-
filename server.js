const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// 1. الاتصال بقاعدة بيانات MongoDB Atlas السحابية
connectDB();

// 2. الإعدادات الأساسية لتبادل البيانات وحماية السيرفر
app.use(cors());
app.use(express.json());

// 3. تشغيل ملفات الواجهة الفخمة (HTML, CSS, JS) من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// 4. المسارات البرمجية الخلفية لإدارة عمليات المنصة (APIs)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/mining', require('./routes/mining'));
app.use('/api/games', require('./routes/games'));
app.use('/api/admin', require('./routes/admin'));

// 5. نقطة الفحص الأساسية (تستخدمها في موقع Cron-Job لإبقاء السيرفر مستيقظاً 24/7)
app.get('/ping', (req, res) => {
    res.send('Nexora Elite Server is Alive and Running! 🚀');
});

// 6. تحديد منفذ تشغيل الخادم على سيرفر Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running successfully on port ${PORT}`);
});
