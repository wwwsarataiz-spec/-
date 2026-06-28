// ==========================================
// Nexora Reborn - Server Entry Point
// ==========================================
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname)));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    message: { success: false, message: 'طلبات كثيرة، حاول لاحقاً' }
});
app.use('/api/', limiter);

// ==========================================
// Database Connection
// ==========================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexora_v3';
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB connected');
        seedAdmin();
    })
    .catch(err => console.error('❌ DB connection error:', err));

// ==========================================
// Models
// ==========================================
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },          // USDT main wallet
    casinoBalance: { type: Number, default: 0 },    // USDT casino
    points: { type: Number, default: 0 },
    freeRounds: { type: Number, default: 2 },
    isAgent: { type: Boolean, default: false },
    language: { type: String, default: 'ar' },
    registrationDate: { type: Date, default: Date.now },
    totalInvested: { type: Number, default: 0 },
    // Mining fields
    miningProgress: { type: Number, default: 0 },
    miningClicks: { type: Number, default: 0 },
    miningMaxClicks: { type: Number, default: 100 },
    miningLastReset: { type: Date, default: Date.now },
    miningActive: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const adSchema = new mongoose.Schema({
    title: String,
    content: String,
    link: String,
    advertiserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    advertiserName: String,
    targetViews: Number,
    currentViews: { type: Number, default: 0 },
    costPerView: { type: Number, default: 0.001 },
    totalCost: Number,
    status: { type: String, enum: ['pending', 'active', 'completed', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    approvedAt: Date,
    completedAt: Date
});
const Ad = mongoose.model('Ad', adSchema);

const adminSchema = new mongoose.Schema({
    password: { type: String, required: true },
    role: { type: String, default: 'superadmin' },
    lastLogin: Date,
    withdrawalBlocked: { type: Boolean, default: false }
});
const Admin = mongoose.model('Admin', adminSchema);

const agentRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fullName: String,
    email: String,
    phone: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: Date
});
const AgentRequest = mongoose.model('AgentRequest', agentRequestSchema);

const agentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    sellPrice: { type: Number, default: 0.01 },
    buyPrice: { type: Number, default: 0.009 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});
const Agent = mongoose.model('Agent', agentSchema);

const marketOrderSchema = new mongoose.Schema({
    type: { type: String, enum: ['buy', 'sell'] },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    points: Number,
    pricePerPoint: Number,
    totalAmount: Number,
    commission: Number,
    netAmount: Number,
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    confirmedAt: Date
});
const MarketOrder = mongoose.model('MarketOrder', marketOrderSchema);

const transactionLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['deposit', 'withdrawal', 'mining_harvest', 'transfer_to_casino', 'casino_win', 'casino_lose', 'free_round_win', 'free_round_reward', 'ad_payment', 'points_exchange'] },
    amount: Number,
    currency: { type: String, default: 'USDT' },
    status: { type: String, default: 'completed' },
    description: String,
    referenceId: String,
    createdAt: { type: Date, default: Date.now }
});
const TransactionLog = mongoose.model('TransactionLog', transactionLogSchema);

// ==========================================
// Helper: Create Initial Admin
// ==========================================
async function seedAdmin() {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const hashedPassword = await bcrypt.hash('wwwtaiz100@gmail.com', 10);
            await new Admin({ password: hashedPassword, role: 'superadmin' }).save();
            console.log('✅ Default admin created (password: wwwtaiz100@gmail.com)');
        }
    } catch (error) {
        console.error('❌ Seed admin error:', error);
    }
}

// ==========================================
// Auth Middleware
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || 'nexora_reborn_secret_2025';
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'غير مصرح' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'رمز غير صالح' });
    }
}

function adminMiddleware(req, res, next) {
    authMiddleware(req, res, async () => {
        const admin = await Admin.findById(req.userId);
        if (!admin) return res.status(403).json({ success: false, message: 'صلاحية غير كافية' });
        next();
    });
}
// ==========================================
// Auth Routes
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً' });
        
        const newUser = new User({ fullName, email, phone, password, balance: 0, casinoBalance: 0, freeRounds: 2 });
        await newUser.save();
        const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, token, user: newUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    res.json({ success: true, user });
});

// ==========================================
// Mining Routes (Manual, Persistent)
// ==========================================
app.post('/api/mining/click', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: 'مستخدم غير موجود' });

        // Reset daily if 24h passed
        const now = Date.now();
        if (now - new Date(user.miningLastReset).getTime() > 24 * 60 * 60 * 1000) {
            user.miningClicks = 0;
            user.miningLastReset = new Date();
        }

        if (user.miningClicks >= user.miningMaxClicks) {
            return res.status(400).json({ success: false, message: 'وصلت للحد الأقصى اليومي (100 ضغطة)' });
        }

        user.miningProgress += 0.001;
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
            lastReset: user.miningLastReset,
            bonus,
            freeRound
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/mining/harvest', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: 'مستخدم غير موجود' });
        if (user.miningProgress <= 0) {
            return res.status(400).json({ success: false, message: 'لا توجد أرباح لتجميعها' });
        }
        const harvested = user.miningProgress;
        user.balance += harvested;
        user.miningProgress = 0;
        await user.save();
        await new TransactionLog({ userId: user._id, type: 'mining_harvest', amount: harvested, description: 'حصاد أرباح التعدين' }).save();
        res.json({ success: true, harvested, newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/mining/status', authMiddleware, async (req, res) => {
    const user = await User.findById(req.userId).select('miningProgress miningClicks miningMaxClicks miningLastReset freeRounds');
    res.json({ success: true, ...user.toObject() });
});

// ==========================================
// Wallet & Casino Transfer
// ==========================================
app.post('/api/wallet/transfer-to-casino', authMiddleware, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: 'مستخدم غير موجود' });
        if (amount <= 0 || isNaN(amount)) return res.status(400).json({ success: false, message: 'مبلغ غير صالح' });
        if (user.balance < amount) return res.status(400).json({ success: false, message: 'رصيد غير كافٍ' });

        user.balance -= amount;
        user.casinoBalance += amount;
        await user.save();
        await new TransactionLog({ userId: user._id, type: 'transfer_to_casino', amount, description: 'تحويل إلى الكازينو' }).save();
        res.json({ success: true, user: { balance: user.balance, casinoBalance: user.casinoBalance } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Casino (Chicken Run) Routes
// ==========================================
app.post('/api/casino/bet', authMiddleware, async (req, res) => {
    try {
        const { betAmount, useFreeRound } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: 'مستخدم غير موجود' });

        if (useFreeRound) {
            if (user.freeRounds <= 0) return res.status(400).json({ success: false, message: 'لا توجد جولات مجانية' });
            user.freeRounds -= 1;
            await user.save();
            return res.json({ success: true, message: 'تم بدء الجولة المجانية' });
        } else {
            if (betAmount <= 0) return res.status(400).json({ success: false, message: 'مبلغ الرهان غير صالح' });
            if (user.casinoBalance < betAmount) return res.status(400).json({ success: false, message: 'رصيد الكازينو غير كافٍ' });
            user.casinoBalance -= betAmount;
            await user.save();
            return res.json({ success: true, message: 'تم خصم الرهان' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/casino/win', authMiddleware, async (req, res) => {
    try {
        const { multiplier, betAmount, useFreeRound } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: 'مستخدم غير موجود' });

        const winnings = useFreeRound ? betAmount * multiplier : betAmount * multiplier;
        if (!useFreeRound) {
            user.casinoBalance += winnings;
        } else {
            user.casinoBalance += winnings; // Add winnings even in free round? Yes, that's typical
        }
        await user.save();
        await new TransactionLog({ userId: user._id, type: 'casino_win', amount: winnings, description: `ربح كازينو (${multiplier}x)` }).save();
        res.json({ success: true, user: { casinoBalance: user.casinoBalance, freeRounds: user.freeRounds } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/casino/lose', authMiddleware, async (req, res) => {
    try {
        const { betAmount } = req.body;
        const user = await User.findById(req.userId);
        // Already deducted on bet, so just log the loss
        await new TransactionLog({ userId: user._id, type: 'casino_lose', amount: betAmount, description: 'خسارة كازينو' }).save();
        res.json({ success: true, user: { casinoBalance: user.casinoBalance } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Ads Routes (with free round every 30 views)
// ==========================================
app.post('/api/ads/create', authMiddleware, async (req, res) => {
    try {
        const { title, content, link, targetViews } = req.body;
        const user = await User.findById(req.userId);
        const totalCost = targetViews * 0.001;
        if (user.balance < totalCost) return res.status(400).json({ success: false, message: `رصيد غير كافٍ (تحتاج ${totalCost.toFixed(2)} USDT)` });
        user.balance -= totalCost;
        const ad = new Ad({ title, content, link, advertiserId: user._id, advertiserName: user.fullName, targetViews, totalCost, status: 'pending' });
        await ad.save();
        await user.save();
        await new TransactionLog({ userId: user._id, type: 'ad_payment', amount: totalCost, description: `دفع إعلان "${title}"` }).save();
        res.status(201).json({ success: true, message: 'تم إرسال الإعلان للمراجعة', ad });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/ads/active', async (req, res) => {
    const ads = await Ad.find({ status: 'active' }).populate('advertiserId', 'fullName');
    res.json({ success: true, ads });
});

app.post('/api/ads/view', authMiddleware, async (req, res) => {
    try {
        const { adId } = req.body;
        const ad = await Ad.findById(adId);
        if (!ad || ad.status !== 'active') return res.status(400).json({ success: false, message: 'الإعلان غير متاح' });

        ad.currentViews += 1;
        if (ad.currentViews >= ad.targetViews) {
            ad.status = 'completed';
            ad.completedAt = new Date();
        }
        await ad.save();

        const user = await User.findById(req.userId);
        user.points += 0.5;
        let freeRoundAwarded = false;
        if (ad.currentViews % 30 === 0) {
            user.freeRounds += 1;
            freeRoundAwarded = true;
            await new TransactionLog({ userId: user._id, type: 'free_round_reward', amount: 0, description: 'مكافأة 30 مشاهدة (جولة مجانية)' }).save();
        }
        await user.save();

        res.json({ success: true, currentViews: ad.currentViews, targetViews: ad.targetViews, completed: ad.status === 'completed', freeRoundAwarded });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Admin Routes (using adminMiddleware for protected ones)
// ==========================================
app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findOne({ role: 'superadmin' });
        if (!admin) return res.status(404).json({ success: false, message: 'لا يوجد حساب إداري' });
        const match = await bcrypt.compare(password, admin.password);
        if (!match) return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
        const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '24h' });
        admin.lastLogin = new Date();
        await admin.save();
        res.json({ success: true, token, role: admin.role });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
    const totalUsers = await User.countDocuments();
    const totalAds = await Ad.countDocuments();
    const pendingAds = await Ad.countDocuments({ status: 'pending' });
    const pendingAgents = await AgentRequest.countDocuments({ status: 'pending' });
    res.json({ success: true, totalUsers, totalAds, pendingAds, pendingAgents });
});

app.post('/api/admin/ads/approve', adminMiddleware, async (req, res) => {
    const { adId } = req.body;
    const ad = await Ad.findByIdAndUpdate(adId, { status: 'active', approvedAt: new Date() }, { new: true });
    if (!ad) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
    res.json({ success: true, message: 'تمت الموافقة على الإعلان' });
});

app.post('/api/admin/ads/reject', adminMiddleware, async (req, res) => {
    const { adId } = req.body;
    const ad = await Ad.findByIdAndUpdate(adId, { status: 'rejected' }, { new: true });
    if (!ad) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
    res.json({ success: true, message: 'تم رفض الإعلان' });
});

app.get('/api/admin/agent-requests', adminMiddleware, async (req, res) => {
    const requests = await AgentRequest.find().populate('userId', 'fullName email').sort({ requestedAt: -1 });
    res.json({ success: true, requests });
});

app.post('/api/admin/agent/approve', adminMiddleware, async (req, res) => {
    const { requestId } = req.body;
    const request = await AgentRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    request.status = 'approved';
    request.reviewedAt = new Date();
    await request.save();
    await User.findByIdAndUpdate(request.userId, { isAgent: true });
    await new Agent({ userId: request.userId }).save();
    res.json({ success: true, message: 'تم اعتماد الوكيل' });
});

app.post('/api/admin/agent/reject', adminMiddleware, async (req, res) => {
    const { requestId } = req.body;
    const request = await AgentRequest.findByIdAndUpdate(requestId, { status: 'rejected', reviewedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    res.json({ success: true, message: 'تم رفض الطلب' });
});

app.get('/api/admin/withdrawal-status', async (req, res) => {
    const admin = await Admin.findOne({ role: 'superadmin' });
    res.json({ success: true, blocked: admin ? admin.withdrawalBlocked : false });
});

app.post('/api/admin/toggle-withdrawal', adminMiddleware, async (req, res) => {
    const { blocked } = req.body;
    await Admin.updateOne({ role: 'superadmin' }, { withdrawalBlocked: blocked });
    res.json({ success: true, message: `تم ${blocked ? 'إيقاف' : 'تفعيل'} السحب` });
});

// ==========================================
// Agent & Market Routes
// ==========================================
app.post('/api/agent/set-prices', authMiddleware, async (req, res) => {
    const { sellPrice, buyPrice } = req.body;
    const agent = await Agent.findOne({ userId: req.userId });
    if (!agent) return res.status(403).json({ success: false, message: 'لست وكيلاً' });
    agent.sellPrice = sellPrice;
    agent.buyPrice = buyPrice;
    await agent.save();
    res.json({ success: true, message: 'تم تحديث الأسعار' });
});

app.get('/api/market/agents', async (req, res) => {
    const agents = await Agent.find({ isActive: true }).populate('userId', 'fullName');
    res.json({ success: true, agents: agents.map(a => ({ 
        id: a.userId._id, 
        name: a.userId.fullName, 
        sellPrice: a.sellPrice, 
        buyPrice: a.buyPrice 
    })) });
});

app.post('/api/market/create-order', authMiddleware, async (req, res) => {
    const { type, agentId, points } = req.body;
    const agent = await Agent.findOne({ userId: agentId, isActive: true });
    if (!agent) return res.status(400).json({ success: false, message: 'الوكيل غير متاح' });
    const pricePerPoint = type === 'buy' ? agent.sellPrice : agent.buyPrice;
    const totalAmount = points * pricePerPoint;
    const commission = totalAmount * 0.05;
    const netAmount = totalAmount - commission;

    const order = new MarketOrder({ type, userId: req.userId, agentId, points, pricePerPoint, totalAmount, commission, netAmount, status: 'pending' });
    await order.save();
    res.json({ success: true, message: 'تم إنشاء الطلب', orderId: order._id });
});

// ==========================================
// Transactions History
// ==========================================
app.get('/api/transactions', authMiddleware, async (req, res) => {
    const transactions = await TransactionLog.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, transactions });
});

// ==========================================
// Fallback for SPA (serve index.html)
// ==========================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// Start Server
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nexora Reborn running on port ${PORT}`));
