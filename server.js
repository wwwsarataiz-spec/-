const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// ===== خدمة الملفات الثابتة (CSS, JS, صور) من الجذر =====
app.use(express.static(__dirname));

// ===== الاتصال بقاعدة البيانات =====
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexora';
mongoose.connect(mongoURI)
    .then(() => console.log('✅ Connected to MongoDB Atlas Successfully!'))
    .catch(err => console.error('❌ Database connection error:', err));

// ===== نموذج المستخدم =====
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0.000660 },
    casinoBalance: { type: Number, default: 5.000000 },
    points: { type: Number, default: 0 },
    approved: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

// ===== نموذج سجل أرباح الإدارة =====
const adminRevenueSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    game: { type: String, required: true },
    userId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const AdminRevenue = mongoose.model('AdminRevenue', adminRevenueSchema);

// ===== المسارات =====
// يجب أن يكون مسار الملفات الرئيسي هو index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== واجهات المصادقة =====
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ success: false, message: "المستخدم مسجل بالفعل!" });
        const newUser = new User({ fullName, email, phone, password });
        await newUser.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة!" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== نقطة نهاية تسجيل خسائر اللاعب =====
app.post('/api/admin/loss', async (req, res) => {
    try {
        const { amount, game, userId } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'مبلغ غير صالح' });
        }
        const revenueEntry = new AdminRevenue({
            amount: amount,
            game: game || 'unknown',
            userId: userId || 'guest'
        });
        await revenueEntry.save();
        res.json({ success: true, message: 'تم تسجيل الخسارة للإدارة' });
    } catch (error) {
        console.error('خطأ في تسجيل الخسارة:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== نقطة نهاية لجلب إحصائيات الإدارة =====
app.get('/api/admin/revenue', async (req, res) => {
    try {
        const total = await AdminRevenue.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const count = await AdminRevenue.countDocuments();
        res.json({
            success: true,
            totalRevenue: total.length > 0 ? total[0].total : 0,
            totalTransactions: count
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== تشغيل الخادم =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nexora Core Online on port ${PORT}`));
