const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ===== الاتصال بقاعدة البيانات =====
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexora';
mongoose.connect(mongoURI)
    .then(() => {
        console.log('✅ Connected to MongoDB successfully');
        seedAdmin();
    })
    .catch(err => console.error('❌ Database connection error:', err));

// ===== نماذج البيانات =====

// نموذج المستخدم (معدل لحفظ التعدين)
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    casinoBalance: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    freeRounds: { type: Number, default: 2 },
    isAgent: { type: Boolean, default: false },
    language: { type: String, default: 'ar' },
    registrationDate: { type: Date, default: Date.now },
    totalInvested: { type: Number, default: 0 },
    miningProgress: { type: Number, default: 0 },
    miningClicks: { type: Number, default: 0 },
    miningMaxClicks: { type: Number, default: 100 },
    miningLastReset: { type: Date, default: Date.now },
    miningActive: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// نموذج الإعلانات
const adSchema = new mongoose.Schema({
    title: String,
    content: String,
    link: String,
    advertiserId: String,
    advertiserName: String,
    targetViews: Number,
    currentViews: { type: Number, default: 0 },
    costPerView: { type: Number, default: 0.001 },
    totalCost: Number,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    approvedAt: Date,
    completedAt: Date
});
const Ad = mongoose.model('Ad', adSchema);

// نموذج المسؤولين
const adminSchema = new mongoose.Schema({
    password: { type: String, required: true },
    role: { type: String, default: 'superadmin' },
    lastLogin: Date,
    withdrawalBlocked: { type: Boolean, default: false }
});
const Admin = mongoose.model('Admin', adminSchema);

// نموذج طلبات الوكالة
const agentRequestSchema = new mongoose.Schema({
    userId: String,
    fullName: String,
    email: String,
    phone: String,
    status: { type: String, default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: Date
});
const AgentRequest = mongoose.model('AgentRequest', agentRequestSchema);

// نموذج الوكلاء
const agentSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    sellPrice: { type: Number, default: 0.01 },
    buyPrice: { type: Number, default: 0.009 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});
const Agent = mongoose.model('Agent', agentSchema);

// نموذج عمليات السوق
const marketOrderSchema = new mongoose.Schema({
    type: { type: String, enum: ['buy', 'sell'] },
    userId: String,
    agentId: String,
    points: Number,
    pricePerPoint: Number,
    totalAmount: Number,
    commission: Number,
    netAmount: Number,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    confirmedAt: Date
});
const MarketOrder = mongoose.model('MarketOrder', marketOrderSchema);

// نموذج سجل المعاملات
const transactionLogSchema = new mongoose.Schema({
    userId: String,
    type: String,
    amount: Number,
    currency: { type: String, default: 'USDT' },
    status: { type: String, default: 'pending' },
    description: String,
    referenceId: String,
    createdAt: { type: Date, default: Date.now }
});
const TransactionLog = mongoose.model('TransactionLog', transactionLogSchema);

// ===== دالة تهيئة المسؤول الأول =====
async function seedAdmin() {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            console.log('🚀 Creating initial admin...');
            const defaultPassword = 'wwwtaiz100@gmail.com';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            const newAdmin = new Admin({
                password: hashedPassword,
                role: 'superadmin',
                withdrawalBlocked: false
            });
            await newAdmin.save();
            console.log(`✅ Admin created successfully`);
        }
    } catch (error) {
        console.error('❌ Seed admin error:', error);
    }
}

const JWT_SECRET = process.env.JWT_SECRET || 'nexora_super_secret_key_2025';

async function createTransaction(userId, type, amount, status, description, referenceId = null) {
    const transaction = new TransactionLog({ userId, type, amount, status, description, referenceId });
    await transaction.save();
    return transaction;
}

// ===== واجهات المصادقة المحمية بالتوكن لمنع الخروج الفجائي =====
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ success: false, message: 'البريد مسجل بالفعل' });

        const newUser = new User({
            fullName, email, phone, password,
            balance: 0, casinoBalance: 0, freeRounds: 2,
            miningProgress: 0, miningClicks: 0, miningLastReset: new Date()
        });
        await newUser.save();
        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ success: true, message: 'تم التسجيل بنجاح', token, user: newUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (user) {
            const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
            res.json({ success: true, token, user });
        } else {
            res.status(401).json({ success: false, message: 'بيانات الدخول خاطئة' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/verify-session', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, message: 'الرمز غير موجود' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(404).json({ success: false, message: 'المستند غير موجود' });
        }
    } catch (error) {
        res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة' });
    }
});

// ===== تحديث بيانات المستخدم =====
app.post('/api/user/update', async (req, res) => {
    try {
        const { userId, fullName, password, language } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (fullName) user.fullName = fullName;
        if (password) user.password = password;
        if (language) user.language = language;
        await user.save();
        res.json({ success: true, message: 'تم التحديث', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== التحويل إلى الكازينو =====
app.post('/api/wallet/transfer-to-casino', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (user.balance < amount) return res.status(400).json({ success: false, message: 'الرصيد غير كافٍ' });
        
        user.balance -= amount;
        user.casinoBalance += amount;
        await user.save();
        await createTransaction(userId, 'transfer_to_casino', amount, 'completed', 'تحويل إلى الكازينو');
        res.json({ success: true, message: 'تم التحويل', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== واجهات التعدين اليدوي وحفظ التقدم =====
app.post('/api/mining/click', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        const now = Date.now();
        const lastReset = new Date(user.miningLastReset).getTime();
        if (now - lastReset > 24 * 60 * 60 * 1000) {
            user.miningClicks = 0;
            user.miningLastReset = new Date();
        }

        if (user.miningClicks >= user.miningMaxClicks) {
            return res.status(400).json({ success: false, message: `وصلت للحد الأقصى اليومي (${user.miningMaxClicks} ضغطة)` });
        }

        const clickReward = 0.001;
        user.miningProgress += clickReward;
        user.miningClicks += 1;

        let bonus = 0;
        let freeRound = false;
        if (user.miningClicks % 10 === 0) {
            bonus = 0.005;
            user.miningProgress += bonus;
        }
        if (user.miningClicks % 50 === 0) {
            user.freeRounds += 1;
            freeRound = true;
        }

        await user.save();
        res.json({
            success: true,
            miningProgress: user.miningProgress,
            miningClicks: user.miningClicks,
            remaining: user.miningMaxClicks - user.miningClicks,
            bonus,
            freeRound
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/mining/harvest', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (user.miningProgress <= 0) return res.status(400).json({ success: false, message: 'لا توجد أرباح للحصاد' });

        user.balance += user.miningProgress;
        const harvested = user.miningProgress;
        user.miningProgress = 0;
        await user.save();
        await createTransaction(userId, 'mining_harvest', harvested, 'completed', 'حصاد أرباح التعدين');

        res.json({ success: true, harvested, newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/mining/status', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        res.json({
            success: true,
            miningProgress: user.miningProgress,
            miningClicks: user.miningClicks,
            remaining: user.miningMaxClicks - user.miningClicks,
            freeRounds: user.freeRounds
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== واجهات الإعلانات والتحكم وسوق النقاط =====
app.post('/api/ads/create', async (req, res) => {
    try {
        const { title, content, link, targetViews, userId, userName } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        const totalCost = targetViews * 0.001;
        if (user.balance < totalCost) return res.status(400).json({ success: false, message: `رصيد غير كافٍ` });

        user.balance -= totalCost;
        const ad = new Ad({ title, content, link, advertiserId: userId, advertiserName: userName || user.fullName, targetViews, totalCost });
        await ad.save();
        await user.save();
        res.status(201).json({ success: true, ad });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/ads/active', async (req, res) => {
    const ads = await Ad.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, ads });
});

// ===== تشغيل الخادم =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nexora server running on port ${PORT}`));
