// ==========================================
// routes/admin.js — لوحة الإدارة + النقاط + السحب
// ==========================================

const express = require('express');
const { User, Transaction, TransactionRequest, AdminLog, Stats } = require('../database');
const { authenticateToken, requireAdmin, requireManager } = require('../middleware/auth');
const router = express.Router();

// ========== جلب بيانات لوحة الإدارة ==========
router.get('/dashboard-data', authenticateToken, requireManager, async (req, res) => {
    try {
        const users = await User.find({}).select('-password').limit(100);
        const requests = await TransactionRequest.find({})
            .sort({ createdAt: -1 })
            .limit(50);
        
        const usersCount = await User.countDocuments();
        const pendingCount = await TransactionRequest.countDocuments({ status: 'pending' });
        
        // حساب إجمالي الأرصدة
        let totalBalance = 0;
        users.forEach(u => {
            totalBalance += (u.usdBalance || 0);
        });
        
        res.json({
            success: true,
            usersCount,
            pendingCount,
            totalBalance: totalBalance.toFixed(2),
            users,
            requests
        });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في جلب البيانات' 
        });
    }
});

// ========== معالجة طلب (قبول/رفض) ==========
router.post('/process-request', authenticateToken, requireManager, async (req, res) => {
    try {
        const { requestId, action } = req.body;
        const admin = req.user;
        
        const request = await TransactionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ الطلب غير موجود' 
            });
        }
        
        if (request.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: '❌ الطلب تم معالجته مسبقاً' 
            });
        }
        
        request.status = action === 'approve' ? 'approved' : 'rejected';
        request.processedBy = admin.email;
        request.processedAt = new Date();
        await request.save();
        
        // إذا كان قبول إيداع
        if (action === 'approve' && request.type === 'deposit') {
            const user = await User.findById(request.userId);
            if (user) {
                user.usdBalance = (user.usdBalance || 0) + request.amount;
                await user.save();
            }
        }
        
        // إذا كان قبول سحب
        if (action === 'approve' && request.type === 'withdrawal') {
            // لا شيء هنا — الرصيد تم خصمه عند الطلب
        }
        
        // تسجيل في سجل الإدارة
        await AdminLog.create({
            adminId: admin._id.toString(),
            action: `${action}_request`,
            targetId: request.userId,
            details: `تم ${action === 'approve' ? 'قبول' : 'رفض'} طلب ${request.type} بمبلغ ${request.amount}`
        });
        
        res.json({
            success: true,
            message: `✅ تم ${action === 'approve' ? 'القبول' : 'الرفض'} بنجاح`
        });
        
    } catch (error) {
        console.error('Process request error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في المعالجة' 
        });
    }
});

// ========== تعديل رصيد مستخدم ==========
router.post('/modify-balance', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, newBalance } = req.body;
        const admin = req.user;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ المستخدم غير موجود' 
            });
        }
        
        const oldBalance = user.usdBalance || 0;
        user.usdBalance = parseFloat(newBalance);
        await user.save();
        
        // تسجيل في السجل
        await AdminLog.create({
            adminId: admin._id.toString(),
            action: 'modify_balance',
            targetId: user._id.toString(),
            details: `تعديل رصيد من ${oldBalance} إلى ${newBalance}`
        });
        
        res.json({
            success: true,
            message: '✅ تم تحديث الرصيد بنجاح'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في التحديث' 
        });
    }
});

// ========== إرسال نقاط هدايا (Gift Points) ==========
// النقاط تُلعب في الكازينو لكن لا تُسحب
router.post('/send-gift-points', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, points } = req.body;
        const admin = req.user;
        const pointsAmount = parseFloat(points) || 0;
        
        if (pointsAmount <= 0 || pointsAmount > 1000000) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ المبلغ يجب أن يكون بين 1 و 1,000,000 نقطة' 
            });
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ المستخدم غير موجود' 
            });
        }
        
        user.giftPoints = (user.giftPoints || 0) + pointsAmount;
        await user.save();
        
        // تسجيل في السجل
        await AdminLog.create({
            adminId: admin._id.toString(),
            action: 'send_gift_points',
            targetId: user._id.toString(),
            details: `إرسال ${pointsAmount} نقطة هدية إلى ${email}`
        });
        
        res.json({
            success: true,
            message: `✅ تم إرسال ${pointsAmount} نقطة هدية إلى ${user.fullName}`,
            newGiftPoints: user.giftPoints
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في إرسال النقاط' 
        });
    }
});

// ========== إرسال رصيد كازينو ==========
router.post('/send-casino-balance', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, amount } = req.body;
        const admin = req.user;
        const casinoAmount = parseFloat(amount) || 0;
        
        if (casinoAmount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ المبلغ يجب أن يكون أكبر من 0' 
            });
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '❌ المستخدم غير موجود' 
            });
        }
        
        user.casinoBalance = (user.casinoBalance || 0) + casinoAmount;
        await user.save();
        
        await AdminLog.create({
            adminId: admin._id.toString(),
            action: 'send_casino_balance',
            targetId: user._id.toString(),
            details: `إرسال ${casinoAmount} رصيد كازينو إلى ${email}`
        });
        
        res.json({
            success: true,
            message: `✅ تم إرسال ${casinoAmount} USDT رصيد كازينو`,
            newCasinoBalance: user.casinoBalance
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في الإرسال' 
        });
    }
});

// ========== طلب سحب (من المستخدم) ==========
// السحب 3 مرات فقط في الأسبوع
router.post('/withdraw', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = req.user;
        const withdrawAmount = parseFloat(amount) || 0;
        
        // التحقق من المبلغ
        if (withdrawAmount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ أدخل مبلغاً صحيحاً' 
            });
        }
        
        if (user.usdBalance < withdrawAmount) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ رصيد غير كافٍ' 
            });
        }
        
        // التحقق من حد السحب الأسبوعي (3 مرات)
        const currentWeek = getWeekNumber(new Date());
        if (user.lastWithdrawalWeek === currentWeek && user.withdrawalCount >= 3) {
            return res.status(403).json({ 
                success: false, 
                message: '⛔ لقد تجاوزت حد السحب الأسبوعي (3 مرات). انت الأسبوع القادم!' 
            });
        }
        
        // إنشاء طلب السحب
        const request = new TransactionRequest({
            userId: user._id.toString(),
            type: 'withdrawal',
            amount: withdrawAmount,
            status: 'pending',
            details: 'طلب سحب من المستخدم'
        });
        await request.save();
        
        // خصم الرصيد مؤقتاً
        user.usdBalance -= withdrawAmount;
        
        // تحديث عداد السحب الأسبوعي
        if (user.lastWithdrawalWeek !== currentWeek) {
            user.lastWithdrawalWeek = currentWeek;
            user.withdrawalCount = 1;
        } else {
            user.withdrawalCount += 1;
        }
        
        await user.save();
        
        res.json({
            success: true,
            message: '✅ تم إرسال طلب السحب للمراجعة',
            newBalance: user.usdBalance,
            withdrawalCount: user.withdrawalCount,
            remainingWithdrawals: 3 - user.withdrawalCount
        });
        
    } catch (error) {
        console.error('Withdraw error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في طلب السحب' 
        });
    }
});

// ========== إيداع (إشعار من المستخدم) ==========
router.post('/deposit', authenticateToken, async (req, res) => {
    try {
        const { amount, txHash } = req.body;
        const user = req.user;
        const depositAmount = parseFloat(amount) || 0;
        
        if (depositAmount <= 0 || !txHash) {
            return res.status(400).json({ 
                success: false, 
                message: '❌ أدخل المبلغ وهاش التحويل' 
            });
        }
        
        // إنشاء طلب إيداع
        const request = new TransactionRequest({
            userId: user._id.toString(),
            type: 'deposit',
            amount: depositAmount,
            txHash,
            status: 'pending',
            details: 'إيداع جديد بانتظار التحقق'
        });
        await request.save();
        
        res.json({
            success: true,
            message: '✅ تم إرسال إثبات الإيداع للمراجعة'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في الإيداع' 
        });
    }
});

// ========== إحصائيات عامة ==========
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalDeposits = await TransactionRequest.aggregate([
            { $match: { type: 'deposit', status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalWithdrawals = await TransactionRequest.aggregate([
            { $match: { type: 'withdrawal', status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        res.json({
            success: true,
            totalUsers,
            totalDeposits: (totalDeposits[0]?.total || 0).toFixed(2),
            totalWithdrawals: (totalWithdrawals[0]?.total || 0).toFixed(2)
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: '❌ خطأ في جلب الإحصائيات' 
        });
    }
});

// ========== دالة مساعدة: رقم الأسبوع ==========
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = router;
