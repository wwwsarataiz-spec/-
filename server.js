const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

// ===== خدمة الملفات الثابتة =====
app.use(express.static(__dirname));

// ===== الاتصال بقاعدة البيانات =====
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexora';
mongoose.connect(mongoURI)
    .then(() => console.log('✅ Connected to MongoDB Atlas Successfully!'))
    .catch(err => console.error('❌ Database connection error:', err));

// ===== نماذج البيانات =====

// نموذج المستخدم (معدل: إضافة حقل 'isAgent')
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0.000660 },
    casinoBalance: { type: Number, default: 5.000000 },
    points: { type: Number, default: 0 },
    approved: { type: Boolean, default: false },
    isAgent: { type: Boolean, default: false } // هل المستخدم وكيل معتمد؟
});
const User = mongoose.model('User', userSchema);

// نموذج سجل أرباح الإدارة (موجود سابقاً)
const adminRevenueSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    game: { type: String, required: true },
    userId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const AdminRevenue = mongoose.model('AdminRevenue', adminRevenueSchema);

// نموذج الإعلانات (موجود سابقاً)
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

// ===== النماذج الجديدة =====

// 1. نموذج المسؤولين (Admin)
const adminSchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true },
    pin: { type: String, required: true }, // مشفر بـ bcrypt
    role: { type: String, default: 'admin' }, // 'superadmin' أو 'admin'
    createdBy: { type: String }, // معرف المشرف الذي أضافه
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true }
});
const Admin = mongoose.model('Admin', adminSchema);

// 2. نموذج محاولات الدخول الفاشلة (لمنع هجمات القوة العمياء)
const failedLoginSchema = new mongoose.Schema({
    ip: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastAttempt: { type: Date, default: Date.now },
    blockedUntil: { type: Date } // إذا تجاوز 10 محاولات، يُحظر حتى هذا الوقت
});
const FailedLogin = mongoose.model('FailedLogin', failedLoginSchema);

// 3. نموذج طلبات الوكالة (Agent Requests)
const agentRequestSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    status: { type: String, default: 'pending' }, // pending, approved, rejected
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: String } // معرف المسؤول الذي راجع الطلب
});
const AgentRequest = mongoose.model('AgentRequest', agentRequestSchema);

// 4. نموذج الوكلاء (Agents)
const agentSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    sellPrice: { type: Number, required: true, default: 0.01 }, // سعر البيع لكل نقطة
    buyPrice: { type: Number, required: true, default: 0.009 }, // سعر الشراء لكل نقطة
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const Agent = mongoose.model('Agent', agentSchema);

// 5. نموذج عمليات سوق النقاط (Market Orders)
const marketOrderSchema = new mongoose.Schema({
    type: { type: String, enum: ['buy', 'sell'], required: true }, // شراء أو بيع
    userId: { type: String, required: true },
    agentId: { type: String, required: true }, // معرف الوكيل الذي يتعامل معه
    points: { type: Number, required: true }, // عدد النقاط
    pricePerPoint: { type: Number, required: true }, // سعر النقطة
    totalAmount: { type: Number, required: true }, // إجمالي المبلغ (نقاط × سعر)
    commission: { type: Number, required: true }, // 5% عمولة المنصة
    netAmount: { type: Number, required: true }, // المبلغ الصافي بعد العمولة
    status: { type: String, default: 'pending' }, // pending, completed, cancelled
    createdAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date },
    confirmedBy: { type: String } // معرف الوكيل الذي أكد العملية
});
const MarketOrder = mongoose.model('MarketOrder', marketOrderSchema);

// 6. نموذج سجل المعاملات (Transaction Log)
const transactionLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, enum: ['deposit', 'withdraw', 'market_buy', 'market_sell', 'game_loss', 'game_win', 'ad_reward', 'mining'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USDT' },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    description: { type: String },
    referenceId: { type: String }, // معرف العملية المرتبطة (مثل معرف طلب السحب أو أمر السوق)
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const TransactionLog = mongoose.model('TransactionLog', transactionLogSchema);

// ===== المسارات العامة =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== واجهات المصادقة (موجودة سابقاً) =====
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

// ===== نقطة نهاية تسجيل خسائر اللاعب (موجودة) =====
app.post('/api/admin/loss', async (req, res) => {
    try {
        const { amount, game, userId } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'مبلغ غير صالح' });
        }
        const revenueEntry = new AdminRevenue({ amount, game, userId: userId || 'guest' });
        await revenueEntry.save();
        res.json({ success: true, message: 'تم تسجيل الخسارة للإدارة' });
    } catch (error) {
        console.error('خطأ في تسجيل الخسارة:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== نقطة نهاية جلب إحصائيات الإدارة (موجودة) =====
app.get('/api/admin/revenue', async (req, res) => {
    try {
        const total = await AdminRevenue.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
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

// ===== نقاط نهاية الإعلانات (موجودة) =====
app.post('/api/ads/create', async (req, res) => {
    try {
        const { title, content, link, targetViews, userId, userName } = req.body;
        if (!title || !content || !link || !targetViews || !userId) {
            return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
        }
        if (targetViews < 1) {
            return res.status(400).json({ success: false, message: 'عدد المشاهدات يجب أن يكون أكبر من 0' });
        }
        const costPerView = 0.001;
        const totalCost = targetViews * costPerView;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }
        if (user.balance < totalCost) {
            return res.status(400).json({ 
                success: false, 
                message: `عذراً، رصيدك غير كافٍ لإتمام نشر الإعلان (تحتاج ${totalCost.toFixed(2)} USDT). يرجى شحن محفظتك أولاً.` 
            });
        }
        user.balance = Math.max(0, user.balance - totalCost);
        await user.save();
        const newAd = new Ad({
            title,
            content,
            link,
            targetViews,
            advertiserId: userId,
            advertiserName: userName || user.fullName,
            costPerView,
            totalCost,
            status: 'pending'
        });
        await newAd.save();
        // تسجيل المعاملة
        const transaction = new TransactionLog({
            userId: userId,
            type: 'ad_payment',
            amount: totalCost,
            status: 'completed',
            description: `دفع تكلفة نشر إعلان "${title}"`,
            referenceId: newAd._id.toString()
        });
        await transaction.save();
        res.status(201).json({ success: true, message: '✅ تم إرسال الإعلان للمراجعة.', ad: newAd });
    } catch (error) {
        console.error('خطأ في إنشاء الإعلان:', error);
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

// ---- الدوال المساعدة ----

// التحقق من حظر IP
async function isIpBlocked(ip) {
    const record = await FailedLogin.findOne({ ip });
    if (!record) return false;
    if (record.blockedUntil && new Date() < record.blockedUntil) {
        return true; // لا يزال محظوراً
    }
    // إذا انتهى وقت الحظر، نعيد تعيين المحاولات
    if (record.blockedUntil && new Date() >= record.blockedUntil) {
        record.attempts = 0;
        record.blockedUntil = null;
        await record.save();
        return false;
    }
    return false;
}

// تسجيل محاولة فاشلة
async function recordFailedLogin(ip) {
    let record = await FailedLogin.findOne({ ip });
    if (!record) {
        record = new FailedLogin({ ip, attempts: 0 });
    }
    record.attempts += 1;
    record.lastAttempt = new Date();
    if (record.attempts >= 10) {
        // حظر لمدة ساعة
        record.blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
    }
    await record.save();
    return record;
}

// إنشاء سجل معاملة
async function createTransaction(userId, type, amount, status, description, referenceId = null) {
    const transaction = new TransactionLog({
        userId,
        type,
        amount,
        status,
        description,
        referenceId,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    await transaction.save();
    return transaction;
}

// ---- 1. إدارة المسؤولين ----

// تسجيل دخول المسؤول (مسار سري)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { ip, pin } = req.body;
        // التحقق من حظر IP
        if (await isIpBlocked(ip)) {
            return res.status(403).json({ success: false, message: 'تم حظر هذا الIP مؤقتاً بسبب كثرة المحاولات الخاطئة. حاول بعد ساعة.' });
        }
        // البحث عن المسؤول بهذا IP
        const admin = await Admin.findOne({ ip });
        if (!admin) {
            await recordFailedLogin(ip);
            return res.status(401).json({ success: false, message: 'IP غير مصرح به' });
        }
        // التحقق من PIN
        const isPinValid = await bcrypt.compare(pin, admin.pin);
        if (!isPinValid) {
            await recordFailedLogin(ip);
            return res.status(401).json({ success: false, message: 'رمز PIN غير صحيح' });
        }
        // نجاح الدخول
        admin.lastLogin = new Date();
        await admin.save();
        // إعادة تعيين محاولات الفشل
        const record = await FailedLogin.findOne({ ip });
        if (record) {
            record.attempts = 0;
            record.blockedUntil = null;
            await record.save();
        }
        res.json({ success: true, message: 'تم تسجيل الدخول بنجاح', role: admin.role });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// إضافة مسؤول جديد (فقط للمشرف الرئيسي)
app.post('/api/admin/add', async (req, res) => {
    try {
        const { ip, pin, role, createdBy } = req.body;
        // التحقق من أن من يضيف هو المشرف الرئيسي (createdBy يجب أن يكون 'superadmin')
        if (createdBy !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'غير مصرح بإضافة مسؤولين' });
        }
        const existing = await Admin.findOne({ ip });
        if (existing) {
            return res.status(400).json({ success: false, message: 'هذا الIP مسجل مسبقاً' });
        }
        const hashedPin = await bcrypt.hash(pin, 10);
        const newAdmin = new Admin({ ip, pin: hashedPin, role: role || 'admin', createdBy });
        await newAdmin.save();
        res.json({ success: true, message: 'تم إضافة المسؤول بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- 2. طلبات الوكالة ----

// تقديم طلب ليصبح تاجراً (وكيل)
app.post('/api/agent/request', async (req, res) => {
    try {
        const { userId, fullName, email, phone } = req.body;
        // التحقق من وجود طلب سابق
        const existing = await AgentRequest.findOne({ userId, status: 'pending' });
        if (existing) {
            return res.status(400).json({ success: false, message: 'لديك طلب قيد المراجعة بالفعل' });
        }
        // التحقق من أنه ليس وكيلاً بالفعل
        const user = await User.findById(userId);
        if (user.isAgent) {
            return res.status(400).json({ success: false, message: 'أنت بالفعل وكيل معتمد' });
        }
        const request = new AgentRequest({ userId, fullName, email, phone, status: 'pending' });
        await request.save();
        // تسجيل معاملة
        await createTransaction(userId, 'agent_request', 0, 'pending', 'طلب التقدم للوكالة');
        res.json({ success: true, message: '✅ تم إرسال طلبك، ستراجع الإدارة الطلب قريباً' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// جلب طلبات الوكالة (للإدارة)
app.get('/api/agent/requests', async (req, res) => {
    try {
        const requests = await AgentRequest.find().sort({ requestedAt: -1 });
        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// الموافقة على طلب وكالة
app.post('/api/agent/approve', async (req, res) => {
    try {
        const { requestId, adminId } = req.body;
        const request = await AgentRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'تمت مراجعة هذا الطلب مسبقاً' });
        // تحديث حالة الطلب
        request.status = 'approved';
        request.reviewedAt = new Date();
        request.reviewedBy = adminId;
        await request.save();
        // جعل المستخدم وكيلاً
        const user = await User.findById(request.userId);
        if (user) {
            user.isAgent = true;
            await user.save();
            // إنشاء حساب وكيل بأسعار افتراضية
            const agent = new Agent({ userId: user._id, sellPrice: 0.01, buyPrice: 0.009 });
            await agent.save();
            // تسجيل معاملة
            await createTransaction(user._id, 'agent_approval', 0, 'completed', 'تم اعتمادك كوكيل في منصة نكسورا');
        }
        res.json({ success: true, message: '✅ تم اعتماد الوكيل بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// رفض طلب وكالة
app.post('/api/agent/reject', async (req, res) => {
    try {
        const { requestId, adminId } = req.body;
        const request = await AgentRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'تمت مراجعة هذا الطلب مسبقاً' });
        request.status = 'rejected';
        request.reviewedAt = new Date();
        request.reviewedBy = adminId;
        await request.save();
        res.json({ success: true, message: '❌ تم رفض الطلب' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- 3. سوق النقاط ----

// تعيين أسعار البيع والشراء للوكيل
app.post('/api/agent/set-prices', async (req, res) => {
    try {
        const { userId, sellPrice, buyPrice } = req.body;
        // التحقق من أن المستخدم وكيل
        const user = await User.findById(userId);
        if (!user || !user.isAgent) {
            return res.status(403).json({ success: false, message: 'أنت لست وكيلاً معتمداً' });
        }
        // التحقق من صحة الأسعار
        if (sellPrice <= 0 || buyPrice <= 0 || sellPrice <= buyPrice) {
            return res.status(400).json({ success: false, message: 'يجب أن يكون سعر البيع أكبر من سعر الشراء وأكبر من 0' });
        }
        let agent = await Agent.findOne({ userId });
        if (!agent) {
            agent = new Agent({ userId, sellPrice, buyPrice });
        } else {
            agent.sellPrice = sellPrice;
            agent.buyPrice = buyPrice;
            agent.updatedAt = new Date();
        }
        await agent.save();
        res.json({ success: true, message: '✅ تم تحديث الأسعار بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// جلب قائمة البيع (مرتبة من الأعلى سعراً للأقل)
app.get('/api/market/sell-orders', async (req, res) => {
    try {
        // نريد الوكلاء النشطين مع أسعار بيعهم
        const agents = await Agent.find({ isActive: true }).populate('userId', 'fullName email phone').sort({ sellPrice: -1 });
        const result = agents.map(agent => ({
            agentId: agent.userId._id,
            fullName: agent.userId.fullName,
            email: agent.userId.email,
            phone: agent.userId.phone,
            sellPrice: agent.sellPrice,
            buyPrice: agent.buyPrice
        }));
        res.json({ success: true, agents: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// جلب قائمة الشراء (مرتبة من الأقل سعراً للأعلى)
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
        res.json({ success: true, agents: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// إنشاء أمر شراء/بيع
app.post('/api/market/order', async (req, res) => {
    try {
        const { type, userId, agentId, points } = req.body; // type: 'buy' أو 'sell'
        // التحقق من المستخدم
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        // التحقق من الوكيل
        const agent = await Agent.findOne({ userId: agentId });
        if (!agent || !agent.isActive) return res.status(404).json({ success: false, message: 'الوكيل غير نشط' });
        // تحديد السعر حسب النوع
        let pricePerPoint;
        if (type === 'buy') {
            pricePerPoint = agent.sellPrice; // المستخدم يشتري من الوكيل بسعر البيع
        } else if (type === 'sell') {
            pricePerPoint = agent.buyPrice; // المستخدم يبيع للوكيل بسعر الشراء
        } else {
            return res.status(400).json({ success: false, message: 'نوع العملية غير صحيح' });
        }
        const totalAmount = points * pricePerPoint;
        const commission = totalAmount * 0.05; // 5% عمولة
        const netAmount = totalAmount - commission; // المبلغ الصافي للوكيل

        // التحقق من الرصيد:
        if (type === 'buy') {
            // شراء نقاط: يدفع المستخدم USDT
            if (user.balance < totalAmount) {
                return res.status(400).json({ success: false, message: `رصيدك غير كافٍ (تحتاج ${totalAmount.toFixed(4)} USDT)` });
            }
            // خصم USDT من المستخدم
            user.balance = Math.max(0, user.balance - totalAmount);
        } else { // 'sell'
            // بيع نقاط: يدفع الوكيل USDT للمستخدم، لكننا سنتعامل مع النقاط
            if (user.points < points) {
                return res.status(400).json({ success: false, message: `نقاطك غير كافية (لديك ${user.points} نقطة)` });
            }
            // خصم النقاط من المستخدم (سيتم تجميدها لحين التأكيد)
            user.points -= points;
        }

        // إنشاء الأمر بحالة معلقة
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

        // تسجيل معاملة معلقة
        await createTransaction(
            userId,
            type === 'buy' ? 'market_buy' : 'market_sell',
            totalAmount,
            'pending',
            `عملية ${type === 'buy' ? 'شراء' : 'بيع'} نقاط (${points} نقطة) مع الوكيل ${agent.userId}`,
            order._id.toString()
        );

        // حفظ التغييرات على المستخدم
        await user.save();

        res.json({ 
            success: true, 
            message: `✅ تم إنشاء طلب ${type === 'buy' ? 'شراء' : 'بيع'} النقاط بنجاح. يرجى التواصل مع الوكيل لإتمام الصفقة.`,
            orderId: order._id
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// تأكيد عملية معلقة من قبل الوكيل (يصبح مكتملاً)
app.post('/api/market/confirm', async (req, res) => {
    try {
        const { orderId, agentId } = req.body;
        const order = await MarketOrder.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'الأمر غير موجود' });
        if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'هذا الأمر ليس معلقاً' });
        // التحقق من أن الوكيل هو نفسه
        if (order.agentId !== agentId) {
            return res.status(403).json({ success: false, message: 'أنت لست الوكيل المسؤول عن هذه العملية' });
        }
        // تحديث حالة الأمر
        order.status = 'completed';
        order.confirmedAt = new Date();
        order.confirmedBy = agentId;
        await order.save();

        // تحديث أرصدة المستخدم والوكيل حسب نوع العملية
        const user = await User.findById(order.userId);
        const agentUser = await User.findById(order.agentId);
        if (!user || !agentUser) {
            return res.status(404).json({ success: false, message: 'أحد المستخدمين غير موجود' });
        }

        if (order.type === 'buy') {
            // شراء نقاط: المستخدم دفع USDT، الآن يحصل على النقاط
            user.points = (user.points || 0) + order.points;
            // الوكيل يحصل على المبلغ الصافي (بعد خصم العمولة)
            agentUser.balance = (agentUser.balance || 0) + order.netAmount;
            // إضافة العمولة إلى أرباح الإدارة
            adminRevenue += order.commission;
        } else { // 'sell'
            // بيع نقاط: المستخدم خصم نقاطه، الوكيل يدفع USDT
            // الوكيل يدفع المبلغ الصافي للمستخدم (بعد خصم العمولة)
            user.balance = (user.balance || 0) + order.netAmount;
            // خصم المبلغ من الوكيل (مع تجاهل العمولة التي حصلت عليها المنصة)
            agentUser.balance = Math.max(0, agentUser.balance - order.totalAmount);
            // العمولة تذهب للإدارة
            adminRevenue += order.commission;
        }

        // تحديث سجل المعاملات
        await TransactionLog.findOneAndUpdate(
            { referenceId: order._id.toString() },
            { status: 'completed', updatedAt: new Date() }
        );

        // تسجيل معاملة جديدة للمبلغ الصافي
        await createTransaction(
            order.userId,
            order.type === 'buy' ? 'market_buy_completed' : 'market_sell_completed',
            order.netAmount,
            'completed',
            `تم إتمام عملية ${order.type === 'buy' ? 'شراء' : 'بيع'} النقاط (${order.points} نقطة)`
        );

        await user.save();
        await agentUser.save();

        res.json({ success: true, message: '✅ تم تأكيد العملية بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---- 4. سجل المعاملات ----

// جلب معاملات المستخدم
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

// جلب كل المعاملات (للإدارة)
app.get('/api/transactions/all', async (req, res) => {
    try {
        const transactions = await TransactionLog.find().sort({ createdAt: -1 });
        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== تشغيل الخادم =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nexora Core Online on port ${PORT}`));
