const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

// ===== خدمة الملفات الثابتة =====
app.use(express.static(__dirname));

// ===== الاتصال بقاعدة البيانات =====
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexora';
mongoose.connect(mongoURI)
    .then(() => {
        console.log('✅ Connected to MongoDB Atlas Successfully!');
        seedAdmin();
    })
    .catch(err => console.error('❌ Database connection error:', err));

// ===== النماذج =====

// نموذج المستخدم (معدل)
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    casinoBalance: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    approved: { type: Boolean, default: false },
    isAgent: { type: Boolean, default: false },
    language: { type: String, default: 'ar' },
    registrationDate: { type: Date, default: Date.now },
    totalInvested: { type: Number, default: 0 },
    freeRounds: { type: Number, default: 2 },
    // حقول التعدين المستمر (جديدة)
    miningProgress: { type: Number, default: 0 },
    miningActive: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// نموذج سجل أرباح الإدارة
const adminRevenueSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    game: { type: String, required: true },
    userId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const AdminRevenue = mongoose.model('AdminRevenue', adminRevenueSchema);

// نموذج الإعلانات
const adSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    link: { type: String, required: true },
    advertiserId: { type: String, required: true },
    advertiserName: { type: String, required: true },
    targetViews: { type: Number, required: true },
    currentViews: { type: Number, default: 0 },
    costPerView: { type: Number, default: 0.001 },
    totalCost: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    completedAt: { type: Date }
});
const Ad = mongoose.model('Ad', adSchema);

// نموذج المسؤولين (معدل - بدون IP)
const adminSchema = new mongoose.Schema({
    password: { type: String, required: true }, // مشفر
    role: { type: String, default: 'superadmin' },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    withdrawalBlocked: { type: Boolean, default: false }
});
const Admin = mongoose.model('Admin', adminSchema);

// نموذج محاولات الدخول الفاشلة (للإدارة)
const failedLoginSchema = new mongoose.Schema({
    ip: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastAttempt: { type: Date, default: Date.now },
    blockedUntil: { type: Date }
});
const FailedLogin = mongoose.model('FailedLogin', failedLoginSchema);

// نموذج طلبات الوكالة
const agentRequestSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    status: { type: String, default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: String }
});
const AgentRequest = mongoose.model('AgentRequest', agentRequestSchema);

// نموذج الوكلاء
const agentSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    sellPrice: { type: Number, required: true, default: 0.01 },
    buyPrice: { type: Number, required: true, default: 0.009 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const Agent = mongoose.model('Agent', agentSchema);

// نموذج عمليات سوق النقاط
const marketOrderSchema = new mongoose.Schema({
    type: { type: String, enum: ['buy', 'sell'], required: true },
    userId: { type: String, required: true },
    agentId: { type: String, required: true },
    points: { type: Number, required: true },
    pricePerPoint: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    commission: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date },
    confirmedBy: { type: String }
});
const MarketOrder = mongoose.model('MarketOrder', marketOrderSchema);

// نموذج سجل المعاملات
const transactionLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USDT' },
    status: { type: String, default: 'pending' },
    description: { type: String },
    referenceId: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const TransactionLog = mongoose.model('TransactionLog', transactionLogSchema);

// نموذج نقاط الهدايا (للمسابقات)
const giftPointsSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    points: { type: Number, required: true },
    reason: { type: String, default: 'مسابقة أو جائزة' },
    createdAt: { type: Date, default: Date.now }
});
const GiftPoints = mongoose.model('GiftPoints', giftPointsSchema);

// ===== دالة تهيئة المسؤول الأول =====
async function seedAdmin() {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            console.log('🚀 جاري إنشاء المسؤول الأول...');
            const defaultPassword = 'wwwtaiz100@gmail.com';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            const newAdmin = new Admin({
                password: hashedPassword,
                role: 'superadmin',
                withdrawalBlocked: false
            });
            await newAdmin.save();
            console.log(`✅ تم إنشاء المسؤول الأول بنجاح!`);
            console.log(`🔐 كلمة المرور: ${defaultPassword}`);
            console.log(`⚠️ يرجى تغييرها فور تسجيل الدخول.`);
        } else {
            console.log(`👑 يوجد ${adminCount} مسؤول(ين) في النظام.`);
        }
    } catch (error) {
        console.error('❌ خطأ في تهيئة المسؤول:', error);
    }
}

// ===== الدوال المساعدة =====
const JWT_SECRET = process.env.JWT_SECRET || 'nexora_super_secret_key_2025';

async function isIpBlocked(ip) {
    const record = await FailedLogin.findOne({ ip });
    if (!record) return false;
    if (record.blockedUntil && new Date() < record.blockedUntil) return true;
    if (record.blockedUntil && new Date() >= record.blockedUntil) {
        record.attempts = 0;
        record.blockedUntil = null;
        await record.save();
        return false;
    }
    return false;
}

async function recordFailedLogin(ip) {
    let record = await FailedLogin.findOne({ ip });
    if (!record) record = new FailedLogin({ ip, attempts: 0 });
    record.attempts += 1;
    record.lastAttempt = new Date();
    if (record.attempts >= 10) record.blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
    await record.save();
    return record;
}

async function createTransaction(userId, type, amount, status, description, referenceId = null) {
    const transaction = new TransactionLog({ userId, type, amount, status, description, referenceId, updatedAt: new Date() });
    await transaction.save();
    return transaction;
}

// ===== المسارات العامة =====
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
        const newUser = new User({ 
            fullName, 
            email, 
            phone, 
            password,
            balance: 0,
            casinoBalance: 0,
            freeRounds: 2,
            miningProgress: 0,
            miningActive: false
        });
        await newUser.save();
        res.status(201).json({ success: true, message: "تم التسجيل بنجاح!", user: newUser });
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
        res.json({ success: true, message: 'تم تحديث البيانات بنجاح', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== تحديث حالة التعدين (حفظ التقدم) =====
app.post('/api/user/update-mining', async (req, res) => {
    try {
        const { userId, miningProgress, miningActive } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (miningProgress !== undefined) user.miningProgress = miningProgress;
        if (miningActive !== undefined) user.miningActive = miningActive;
        await user.save();
        res.json({ success: true, message: 'تم تحديث حالة التعدين', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== التحويل من المحفظة إلى الكازينو =====
app.post('/api/wallet/transfer-to-casino', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (user.balance < amount) {
            return res.status(400).json({ success: false, message: 'لا يوجد لديك رصيد كافٍ في المحفظة' });
        }
        user.balance = Math.max(0, user.balance - amount);
        user.casinoBalance = (user.casinoBalance || 0) + amount;
        await user.save();
        await createTransaction(userId, 'transfer_to_casino', amount, 'completed', `تحويل من المحفظة إلى الكازينو`);
        res.json({ success: true, message: 'تم التحويل بنجاح', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== نقاط نهاية الإعلانات =====
app.post('/api/ads/create', async (req, res) => {
    try {
        const { title, content, link, targetViews, userId, userName } = req.body;
        if (!title || !content || !link || !targetViews || !userId) return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
        if (targetViews < 1) return res.status(400).json({ success: false, message: 'عدد المشاهدات يجب أن يكون أكبر من 0' });
        const costPerView = 0.001;
        const totalCost = targetViews * costPerView;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (user.balance < totalCost) return res.status(400).json({ success: false, message: `عذراً، رصيدك غير كافٍ (تحتاج ${totalCost.toFixed(2)} USDT)` });
        user.balance = Math.max(0, user.balance - totalCost);
        await user.save();
        const newAd = new Ad({ title, content, link, targetViews, advertiserId: userId, advertiserName: userName || user.fullName, costPerView, totalCost, status: 'pending' });
        await newAd.save();
        await createTransaction(userId, 'ad_payment', totalCost, 'completed', `دفع تكلفة نشر إعلان "${title}"`, newAd._id.toString());
        res.status(201).json({ success: true, message: '✅ تم إرسال الإعلان للمراجعة.', ad: newAd });
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

app.get('/api/ads/active', async (req, res) => {
    try {
        const ads = await Ad.find({ status: 'active' }).sort({ createdAt: -1 });
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
        if (ad.status !== 'pending') return res.status(400).json({ success: false, message: 'الإعلان ليس في حالة انتظار' });
        ad.status = 'active';
        ad.approvedAt = new Date();
        await ad.save();
        res.json({ success: true, message: '✅ تم الموافقة على الإعلان ونشره', ad });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ads/reject', async (req, res) => {
    try {
        const { adId } = req.body;
        const ad = await Ad.findById(adId);
        if (!ad) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
        if (ad.status !== 'pending') return res.status(400).json({ success: false, message: 'الإعلان ليس في حالة انتظار' });
        ad.status = 'rejected';
        await ad.save();
        res.json({ success: true, message: '❌ تم رفض الإعلان', ad });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ads/view', async (req, res) => {
    try {
        const { adId, userId } = req.body;
        const ad = await Ad.findById(adId);
        if (!ad) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
        if (ad.status !== 'active') return res.status(400).json({ success: false, message: 'هذا الإعلان غير نشط حالياً' });
        if (ad.currentViews >= ad.targetViews) {
            ad.status = 'completed';
            ad.completedAt = new Date();
            await ad.save();
            return res.status(400).json({ success: false, message: 'هذا الإعلان قد اكتمل' });
        }
        ad.currentViews += 1;
        await ad.save();
        const user = await User.findById(userId);
        if (user) {
            user.points = (user.points || 0) + 0.5;
            // كل 30 مشاهدة = جولة مجانية
            if (ad.currentViews % 30 === 0) {
                user.freeRounds = (user.freeRounds || 0) + 1;
                await createTransaction(userId, 'free_round_reward', 0, 'completed', 'مكافأة مشاهدة 30 إعلاناً (جولة مجانية)');
            }
            await user.save();
        }
        res.json({ success: true, message: '✅ تم تسجيل المشاهدة', currentViews: ad.currentViews, targetViews: ad.targetViews, completed: ad.currentViews >= ad.targetViews });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/ads/delete', async (req, res) => {
    try {
        const { adId } = req.body;
        const ad = await Ad.findByIdAndDelete(adId);
        if (!ad) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
        res.json({ success: true, message: '✅ تم حذف الإعلان' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================================================
// نقاط النهاية الجديدة (الإدارة، سوق النقاط، الوكالة، المعاملات)
// ================================================================

// ---- تسجيل دخول الإدارة (محمي بكلمة مرور) ----
app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findOne({ role: 'superadmin' });
        if (!admin) return res.status(404).json({ success: false, message: 'الإدارة غير موجودة' });
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
        }
        admin.lastLogin = new Date();
        await admin.save();
        const token = jwt.sign({ id: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, role: admin.role, withdrawalBlocked: admin.withdrawalBlocked });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// التحقق من صلاحية المسؤول (Middleware)
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

// ---- لوحة الإدارة (محمية) ----
app.get('/api/admin/dashboard', verifyAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalBalance = (await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]))[0]?.total || 0;
        const totalWithdrawals = (await TransactionLog.aggregate([{ $match: { type: 'withdraw', status: 'pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]))[0]?.total || 0;
        const totalRevenue = (await AdminRevenue.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]))[0]?.total || 0;
        res.json({ success: true, stats: { totalUsers, totalBalance, totalWithdrawals, totalRevenue } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- طلبات الوكالة (مع شروط صارمة) ----
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
                    message: 'عزيزي المستخدم، نود إفادتك بأن طلب الانضمام الخاص بك كتاجر لا يزال تحت الدراسة. لا يتطلب منك اتخاذ أي إجراء إضافي حالياً.',
                    isDuplicate: true
                });
            }
            if (existing.status === 'approved') {
                return res.status(400).json({ success: false, message: 'أنت بالفعل وكيل معتمد' });
            }
        }
        if (user.isAgent) return res.status(400).json({ success: false, message: 'أنت بالفعل وكيل معتمد' });

        const daysSinceRegister = (Date.now() - new Date(user.registrationDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRegister < 30) {
            return res.status(400).json({ 
                success: false, 
                message: `⚠️ يجب أن يكون قد مضى على حسابك 30 يوماً على الأقل (تبقى ${Math.ceil(30 - daysSinceRegister)} يوم).` 
            });
        }
        if (user.totalInvested < 100) {
            return res.status(400).json({ 
                success: false, 
                message: `⚠️ يجب أن يكون إجمالي استثماراتك في خطط التعدين 100 دولار على الأقل (لديك ${user.totalInvested} دولار).` 
            });
        }
        const activeAds = await Ad.find({ advertiserId: userId, status: 'active' });
        const buyAds = activeAds.filter(a => a.type === 'buy');
        const sellAds = activeAds.filter(a => a.type === 'sell');
        if (buyAds.length >= 1) {
            return res.status(400).json({ success: false, message: '⚠️ لديك بالفعل إعلان شراء نشط. يمكنك فتح إعلان واحد فقط لكل نوع.' });
        }
        if (sellAds.length >= 1) {
            return res.status(400).json({ success: false, message: '⚠️ لديك بالفعل إعلان بيع نشط. يمكنك فتح إعلان واحد فقط لكل نوع.' });
        }

        const request = new AgentRequest({ userId, fullName, email, phone, status: 'pending' });
        await request.save();
        await createTransaction(userId, 'agent_request', 0, 'pending', 'طلب التقدم للوكالة');
        res.json({ success: true, message: '✅ تم إرسال طلبك، ستراجع الإدارة الطلب قريباً' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/agent/requests', verifyAdmin, async (req, res) => {
    try {
        const requests = await AgentRequest.find().sort({ requestedAt: -1 });
        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/agent/approve', verifyAdmin, async (req, res) => {
    try {
        const { requestId } = req.body;
        const request = await AgentRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'تمت مراجعة هذا الطلب مسبقاً' });
        request.status = 'approved';
        request.reviewedAt = new Date();
        await request.save();
        const user = await User.findById(request.userId);
        if (user) {
            user.isAgent = true;
            await user.save();
            const agent = new Agent({ userId: user._id, sellPrice: 0.01, buyPrice: 0.009 });
            await agent.save();
            await createTransaction(user._id, 'agent_approval', 0, 'completed', 'تم اعتمادك كوكيل في منصة نكسورا');
        }
        res.json({ success: true, message: '✅ تم اعتماد الوكيل بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/agent/reject', verifyAdmin, async (req, res) => {
    try {
        const { requestId } = req.body;
        const request = await AgentRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'تمت مراجعة هذا الطلب مسبقاً' });
        request.status = 'rejected';
        request.reviewedAt = new Date();
        await request.save();
        res.json({ success: true, message: '❌ تم رفض الطلب' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- سوق النقاط ----
app.post('/api/agent/set-prices', async (req, res) => {
    try {
        const { userId, sellPrice, buyPrice } = req.body;
        const user = await User.findById(userId);
        if (!user || !user.isAgent) return res.status(403).json({ success: false, message: 'أنت لست وكيلاً معتمداً' });
        if (sellPrice <= 0 || buyPrice <= 0 || sellPrice <= buyPrice) return res.status(400).json({ success: false, message: 'يجب أن يكون سعر البيع أكبر من سعر الشراء وأكبر من 0' });
        let agent = await Agent.findOne({ userId });
        if (!agent) agent = new Agent({ userId, sellPrice, buyPrice });
        else { agent.sellPrice = sellPrice; agent.buyPrice = buyPrice; agent.updatedAt = new Date(); }
        await agent.save();
        res.json({ success: true, message: '✅ تم تحديث الأسعار بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/market/sell-orders', async (req, res) => {
    try {
        const agents = await Agent.find({ isActive: true }).populate('userId', 'fullName email phone').sort({ sellPrice: -1 });
        const result = agents.map(agent => ({
            agentId: agent.userId._id,
            fullName: agent.userId.fullName,
            email: agent.userId.email,
            phone: agent.userId.phone,
            sellPrice: agent.sellPrice,
            buyPrice: agent.buyPrice
        }));
        const count = result.length;
        res.json({ success: true, agents: result, count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/market/buy-orders', async (req, res) => {
    try {
        const agents = await Agent.find({ isActive: true }).populate('userId', 'fullName email phone').sort({ buyPrice: 1 });
        const result = agents.map(agent => ({
            agentId: agent.userId._id,
            fullName: agent.userId.fullName,
            email: agent.userId.email,
            phone: agent.userId.phone,
            sellPrice: agent.sellPrice,
            buyPrice: agent.buyPrice
        }));
        const count = result.length;
        res.json({ success: true, agents: result, count });
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
        let pricePerPoint;
        if (type === 'buy') pricePerPoint = agent.sellPrice;
        else if (type === 'sell') pricePerPoint = agent.buyPrice;
        else return res.status(400).json({ success: false, message: 'نوع العملية غير صحيح' });
        const totalAmount = points * pricePerPoint;
        const commission = totalAmount * 0.05;
        const netAmount = totalAmount - commission;

        if (type === 'buy') {
            if (user.balance < totalAmount) return res.status(400).json({ success: false, message: `رصيدك غير كافٍ (تحتاج ${totalAmount.toFixed(4)} USDT)` });
            user.balance = Math.max(0, user.balance - totalAmount);
        } else {
            if (user.points < points) return res.status(400).json({ success: false, message: `نقاطك غير كافية (لديك ${user.points} نقطة)` });
            user.points -= points;
        }

        const order = new MarketOrder({ type, userId, agentId, points, pricePerPoint, totalAmount, commission, netAmount, status: 'pending' });
        await order.save();
        await createTransaction(userId, type === 'buy' ? 'market_buy' : 'market_sell', totalAmount, 'pending', `عملية ${type === 'buy' ? 'شراء' : 'بيع'} نقاط (${points} نقطة)`, order._id.toString());
        await user.save();

        res.json({ success: true, message: `✅ تم إنشاء طلب ${type === 'buy' ? 'شراء' : 'بيع'} النقاط بنجاح.`, orderId: order._id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/market/confirm', async (req, res) => {
    try {
        const { orderId, agentId } = req.body;
        const order = await MarketOrder.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'الأمر غير موجود' });
        if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'هذا الأمر ليس معلقاً' });
        if (order.agentId !== agentId) return res.status(403).json({ success: false, message: 'أنت لست الوكيل المسؤول عن هذه العملية' });
        order.status = 'completed';
        order.confirmedAt = new Date();
        order.confirmedBy = agentId;
        await order.save();

        const user = await User.findById(order.userId);
        const agentUser = await User.findById(order.agentId);
        if (!user || !agentUser) return res.status(404).json({ success: false, message: 'أحد المستخدمين غير موجود' });

        if (order.type === 'buy') {
            user.points = (user.points || 0) + order.points;
            agentUser.balance = (agentUser.balance || 0) + order.netAmount;
            adminRevenue += order.commission;
        } else {
            user.balance = (user.balance || 0) + order.netAmount;
            agentUser.balance = Math.max(0, agentUser.balance - order.totalAmount);
            adminRevenue += order.commission;
        }

        await TransactionLog.findOneAndUpdate({ referenceId: order._id.toString() }, { status: 'completed', updatedAt: new Date() });
        await createTransaction(order.userId, order.type === 'buy' ? 'market_buy_completed' : 'market_sell_completed', order.netAmount, 'completed', `تم إتمام عملية ${order.type === 'buy' ? 'شراء' : 'بيع'} النقاط`);
        await user.save();
        await agentUser.save();

        res.json({ success: true, message: '✅ تم تأكيد العملية بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- سجل المعاملات ----
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

app.get('/api/transactions/all', verifyAdmin, async (req, res) => {
    try {
        const transactions = await TransactionLog.find().sort({ createdAt: -1 });
        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- حالة السحب ----
app.get('/api/admin/withdrawal-status', async (req, res) => {
    try {
        const admin = await Admin.findOne({ role: 'superadmin' });
        if (!admin) return res.status(404).json({ success: false, message: 'الإدارة غير موجودة' });
        res.json({ success: true, blocked: admin.withdrawalBlocked || false });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/toggle-withdrawal', verifyAdmin, async (req, res) => {
    try {
        const { blocked } = req.body;
        const admin = await Admin.findOne({ role: 'superadmin' });
        if (!admin) return res.status(404).json({ success: false, message: 'الإدارة غير موجودة' });
        admin.withdrawalBlocked = blocked;
        await admin.save();
        res.json({ success: true, message: `تم ${blocked ? 'إيقاف' : 'تفعيل'} السحب مؤقتاً` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- إرسال نقاط الهدايا (للمسابقات) ----
app.post('/api/admin/gift-points', verifyAdmin, async (req, res) => {
    try {
        const { userId, points, reason } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        user.points = (user.points || 0) + points;
        await user.save();
        const gift = new GiftPoints({ userId, points, reason: reason || 'هدية من الإدارة' });
        await gift.save();
        await createTransaction(userId, 'gift_points', points, 'completed', `هدية نقاط (${reason || 'مسابقة'})`);
        res.json({ success: true, message: `✅ تم إرسال ${points} نقطة إلى ${user.fullName}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- تحديث إعدادات لعبة الدجاجة (لوحة الإدارة) ----
app.post('/api/admin/update-chicken-game', verifyAdmin, async (req, res) => {
    try {
        const { riskMultiplier, baseReward } = req.body;
        global.chickenGameSettings = { riskMultiplier, baseReward };
        res.json({ success: true, message: '✅ تم تحديث إعدادات لعبة الدجاجة' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== تشغيل الخادم =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nexora Core Online on port ${PORT}`));
