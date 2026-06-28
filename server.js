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

// نموذج المستخدم (معدل)
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
    // حقول التعدين الجديدة (حفظ التقدم)
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
            console.log(`✅ Admin created with password: ${defaultPassword}`);
        }
    } catch (error) {
        console.error('❌ Seed admin error:', error);
    }
}

// ===== الدوال المساعدة =====
const JWT_SECRET = process.env.JWT_SECRET || 'nexora_super_secret_key_2025';

async function createTransaction(userId, type, amount, status, description, referenceId = null) {
    const transaction = new TransactionLog({ userId, type, amount, status, description, referenceId });
    await transaction.save();
    return transaction;
}

// ===== واجهات المصادقة =====
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ success: false, message: 'البريد مسجل بالفعل' });

        const newUser = new User({
            fullName,
            email,
            phone,
            password,
            balance: 0,
            casinoBalance: 0,
            freeRounds: 2,
            miningProgress: 0,
            miningClicks: 0,
            miningLastReset: new Date()
        });
        await newUser.save();
        res.status(201).json({ success: true, message: 'تم التسجيل بنجاح', user: newUser });
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
            res.status(401).json({ success: false, message: 'بيانات خاطئة' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
        if (user.balance < amount) {
            return res.status(400).json({ success: false, message: 'الرصيد غير كافٍ' });
        }
        user.balance -= amount;
        user.casinoBalance += amount;
        await user.save();
        await createTransaction(userId, 'transfer_to_casino', amount, 'completed', 'تحويل إلى الكازينو');
        res.json({ success: true, message: 'تم التحويل', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== واجهات التعدين الجديدة (حفظ التقدم) =====
app.post('/api/mining/click', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        // التحقق من إعادة الضبط اليومي
        const now = Date.now();
        const lastReset = new Date(user.miningLastReset).getTime();
        if (now - lastReset > 24 * 60 * 60 * 1000) {
            user.miningClicks = 0;
            user.miningLastReset = new Date();
        }

        if (user.miningClicks >= user.miningMaxClicks) {
            return res.status(400).json({
                success: false,
                message: `وصلت للحد الأقصى اليومي (${user.miningMaxClicks} ضغطة)`
            });
        }

        // ربح الضغطة
        const clickReward = 0.001;
        user.miningProgress += clickReward;
        user.miningClicks += 1;

        // مكافآت إضافية
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

        if (user.miningProgress <= 0) {
            return res.status(400).json({ success: false, message: 'لا توجد أرباح للحصاد' });
        }

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

        const now = Date.now();
        const lastReset = new Date(user.miningLastReset).getTime();
        const hoursSinceReset = (now - lastReset) / (60 * 60 * 1000);
        const resetIn = Math.max(0, 24 - hoursSinceReset);

        res.json({
            success: true,
            miningProgress: user.miningProgress,
            miningClicks: user.miningClicks,
            remaining: user.miningMaxClicks - user.miningClicks,
            resetIn: Math.ceil(resetIn),
            freeRounds: user.freeRounds
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== واجهات الإعلانات (مع منح جولات مجانية) =====
app.post('/api/ads/create', async (req, res) => {
    try {
        const { title, content, link, targetViews, userId, userName } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        const totalCost = targetViews * 0.001;
        if (user.balance < totalCost) {
            return res.status(400).json({ success: false, message: `رصيد غير كافٍ (تحتاج ${totalCost.toFixed(2)} USDT)` });
        }

        user.balance -= totalCost;
        const ad = new Ad({
            title,
            content,
            link,
            advertiserId: userId,
            advertiserName: userName || user.fullName,
            targetViews,
            totalCost,
            status: 'pending'
        });
        await ad.save();
        await user.save();
        await createTransaction(userId, 'ad_payment', totalCost, 'completed', `دفع تكلفة إعلان "${title}"`);

        res.status(201).json({ success: true, message: 'تم إرسال الإعلان للمراجعة', ad });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/ads/active', async (req, res) => {
    try {
        const ads = await Ad.find({ status: 'active' }).sort({ createdAt: -1 });
        res.json({ success: true, ads });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/ads/all', async (req, res) => {
    try {
        const ads = await Ad.find().sort({ createdAt: -1 });
        res.json({ success: true, ads });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ads/approve', async (req, res) => {
    try {
        const { adId } = req.body;
        const ad = await Ad.findById(adId);
        if (!ad) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
        ad.status = 'active';
        ad.approvedAt = new Date();
        await ad.save();
        res.json({ success: true, message: 'تمت الموافقة على الإعلان' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ads/reject', async (req, res) => {
    try {
        const { adId } = req.body;
        const ad = await Ad.findById(adId);
        if (!ad) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
        ad.status = 'rejected';
        await ad.save();
        res.json({ success: true, message: 'تم رفض الإعلان' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ads/view', async (req, res) => {
    try {
        const { adId, userId } = req.body;
        const ad = await Ad.findById(adId);
        if (!ad) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
        if (ad.status !== 'active') return res.status(400).json({ success: false, message: 'الإعلان غير نشط' });
        if (ad.currentViews >= ad.targetViews) {
            ad.status = 'completed';
            ad.completedAt = new Date();
            await ad.save();
            return res.status(400).json({ success: false, message: 'الإعلان مكتمل' });
        }

        ad.currentViews += 1;
        await ad.save();

        const user = await User.findById(userId);
        if (user) {
            user.points += 0.5;
            // كل 30 مشاهدة = جولة مجانية
            if (ad.currentViews % 30 === 0) {
                user.freeRounds += 1;
                await createTransaction(userId, 'free_round_reward', 0, 'completed', 'مكافأة 30 مشاهدة (جولة مجانية)');
            }
            await user.save();
        }

        res.json({
            success: true,
            message: 'تم تسجيل المشاهدة',
            currentViews: ad.currentViews,
            targetViews: ad.targetViews,
            completed: ad.currentViews >= ad.targetViews
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/ads/delete', async (req, res) => {
    try {
        const { adId } = req.body;
        await Ad.findByIdAndDelete(adId);
        res.json({ success: true, message: 'تم حذف الإعلان' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== واجهات الإدارة =====
app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findOne({ role: 'superadmin' });
        if (!admin) return res.status(404).json({ success: false, message: 'الإدارة غير موجودة' });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });

        admin.lastLogin = new Date();
        await admin.save();
        const token = jwt.sign({ id: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, role: admin.role, withdrawalBlocked: admin.withdrawalBlocked });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Middleware للتحقق من صلاحية الإدارة
async function verifyAdmin(req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, message: 'غير مصرح' });
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'رمز غير صالح' });
    }
}

// ===== طلبات الوكالة =====
app.post('/api/agent/request', async (req, res) => {
    try {
        const { userId, fullName, email, phone } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        const existing = await AgentRequest.findOne({ userId });
        if (existing) {
            if (existing.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'طلبك لا يزال تحت الدراسة',
                    isDuplicate: true
                });
            }
            if (existing.status === 'approved') {
                return res.status(400).json({ success: false, message: 'أنت بالفعل وكيل' });
            }
        }

        // الشروط: 30 يوم + استثمار 100 دولار
        const daysSinceRegister = (Date.now() - new Date(user.registrationDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRegister < 30) {
            return res.status(400).json({
                success: false,
                message: `يجب أن يمر 30 يوم (تبقى ${Math.ceil(30 - daysSinceRegister)} يوم)`
            });
        }
        if (user.totalInvested < 100) {
            return res.status(400).json({
                success: false,
                message: `يجب استثمار 100 دولار على الأقل (لديك ${user.totalInvested})`
            });
        }

        const request = new AgentRequest({ userId, fullName, email, phone, status: 'pending' });
        await request.save();
        res.json({ success: true, message: 'تم إرسال طلب الوكالة' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/agent/requests', verifyAdmin, async (req, res) => {
    const requests = await AgentRequest.find().sort({ requestedAt: -1 });
    res.json({ success: true, requests });
});

app.post('/api/agent/approve', verifyAdmin, async (req, res) => {
    try {
        const { requestId } = req.body;
        const request = await AgentRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        request.status = 'approved';
        request.reviewedAt = new Date();
        await request.save();

        const user = await User.findById(request.userId);
        if (user) {
            user.isAgent = true;
            await user.save();
            const agent = new Agent({ userId: user._id });
            await agent.save();
        }
        res.json({ success: true, message: 'تم اعتماد الوكيل' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/agent/reject', verifyAdmin, async (req, res) => {
    try {
        const { requestId } = req.body;
        const request = await AgentRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        request.status = 'rejected';
        request.reviewedAt = new Date();
        await request.save();
        res.json({ success: true, message: 'تم رفض الطلب' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== سوق النقاط =====
app.post('/api/agent/set-prices', async (req, res) => {
    try {
        const { userId, sellPrice, buyPrice } = req.body;
        const user = await User.findById(userId);
        if (!user || !user.isAgent) return res.status(403).json({ success: false, message: 'لست وكيلاً' });

        let agent = await Agent.findOne({ userId });
        if (!agent) agent = new Agent({ userId });
        agent.sellPrice = sellPrice;
        agent.buyPrice = buyPrice;
        await agent.save();
        res.json({ success: true, message: 'تم تحديث الأسعار' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/market/sell-orders', async (req, res) => {
    try {
        const agents = await Agent.find({ isActive: true }).populate('userId', 'fullName email phone');
        const result = agents.map(agent => ({
            agentId: agent.userId._id,
            fullName: agent.userId.fullName,
            email: agent.userId.email,
            phone: agent.userId.phone,
            sellPrice: agent.sellPrice,
            buyPrice: agent.buyPrice
        }));
        res.json({ success: true, agents: result, count: result.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/market/buy-orders', async (req, res) => {
    try {
        const agents = await Agent.find({ isActive: true }).populate('userId', 'fullName email phone');
        const result = agents.map(agent => ({
            agentId: agent.userId._id,
            fullName: agent.userId.fullName,
            email: agent.userId.email,
            phone: agent.userId.phone,
            sellPrice: agent.sellPrice,
            buyPrice: agent.buyPrice
        }));
        res.json({ success: true, agents: result, count: result.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/market/order', async (req, res) => {
    try {
        const { type, userId, agentId, points } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        const agent = await Agent.findOne({ userId: agentId });
        if (!agent || !agent.isActive) return res.status(404).json({ success: false, message: 'الوكيل غير نشط' });

        const pricePerPoint = type === 'buy' ? agent.sellPrice : agent.buyPrice;
        const totalAmount = points * pricePerPoint;
        const commission = totalAmount * 0.05;
        const netAmount = totalAmount - commission;

        if (type === 'buy') {
            if (user.balance < totalAmount) return res.status(400).json({ success: false, message: 'رصيد غير كافٍ' });
            user.balance -= totalAmount;
        } else {
            if (user.points < points) return res.status(400).json({ success: false, message: 'نقاط غير كافية' });
            user.points -= points;
        }

        const order = new MarketOrder({
            type,
            userId,
            agentId,
            points,
            pricePerPoint,
            totalAmount,
            commission,
            netAmount,
            status: 'pending'
        });
        await order.save();
        await user.save();
        res.json({ success: true, message: 'تم إنشاء الطلب', orderId: order._id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== سجل المعاملات =====
app.get('/api/transactions', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
        const transactions = await TransactionLog.find({ userId }).sort({ createdAt: -1 });
        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== حالة السحب =====
app.get('/api/admin/withdrawal-status', async (req, res) => {
    const admin = await Admin.findOne({ role: 'superadmin' });
    res.json({ success: true, blocked: admin ? admin.withdrawalBlocked : false });
});

app.post('/api/admin/toggle-withdrawal', verifyAdmin, async (req, res) => {
    const { blocked } = req.body;
    const admin = await Admin.findOne({ role: 'superadmin' });
    if (!admin) return res.status(404).json({ success: false, message: 'الإدارة غير موجودة' });
    admin.withdrawalBlocked = blocked;
    await admin.save();
    res.json({ success: true, message: `تم ${blocked ? 'إيقاف' : 'تفعيل'} السحب` });
});

// ===== تشغيل الخادم =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nexora server running on port ${PORT}`));
