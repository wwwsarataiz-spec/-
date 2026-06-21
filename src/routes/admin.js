// ==========================================
// routes/admin.js - لوحة التحكم الإدارية
// ==========================================

const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { Transaction } = require('../models/Transaction');
const { AdminLog } = require('../models/AdminLog');

// ==========================================
// 1. جلب لوحة التحكم الكاملة
// ==========================================
router.get('/dashboard', async (req, res) => {
    try {
        const users = await User.find();
        const transactions = await Transaction.find();
        const pending = transactions.filter(t => t.status === 'pending');
        const deposits = transactions.filter(t => t.type === 'deposit' && t.status === 'approved');
        const withdrawals = transactions.filter(t => t.type === 'withdrawal' && t.status === 'approved');
        
        const totalDeposits = deposits.reduce((s, t) => s + t.amount, 0);
        const totalWithdrawals = withdrawals.reduce((s, t) => s + t.amount, 0);
        const totalGifts = users.reduce((s, u) => s + (u.giftPoints || 0), 0);
        const netProfit = totalDeposits - totalWithdrawals - totalGifts;

        // آخر 20 سجل من سجل العمليات
        const logs = await AdminLog.find().sort({ timestamp: -1 }).limit(20);

        res.json({
            success: true,
            stats: {
                totalUsers: users.length,
                totalDeposits,
                totalWithdrawals,
                totalGifts,
                netProfit,
                pendingRequests: pending.length
            },
            users: users.map(u => ({
                id: u._id,
                username: u.username,
                email: u.email,
                balance: u.balance,
                casinoBalance: u.casinoBalance,
                giftPoints: u.giftPoints,
                role: u.role,
                banned: u.banned,
                createdAt: u.createdAt
            })),
            pendingRequests: pending.map(t => ({
                id: t._id,
                userId: t.userId,
                type: t.type,
                amount: t.amount,
                txHash: t.txHash,
                receipt: t.receipt,
                createdAt: t.createdAt
            })),
            logs
        });

    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
    }
});

// ==========================================
// 2. معالجة طلب (قبول/رفض)
// ==========================================
router.post('/process-request', async (req, res) => {
    try {
        const { requestId, action, adminEmail } = req.body;

        if (!requestId || !action) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const transaction = await Transaction.findById(requestId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        }

        if (transaction.status !== 'pending') {
            return res.json({ success: false, message: 'تم معالجة هذا الطلب مسبقاً' });
        }

        const user = await User.findById(transaction.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        if (action === 'approve') {
            transaction.status = 'approved';
            if (transaction.type === 'deposit') {
                user.balance = (user.balance || 0) + transaction.amount;
            } else if (transaction.type === 'withdrawal') {
                // السحب تم خصمه مسبقاً عند الطلب
            }
            await user.save();
        } else if (action === 'reject') {
            transaction.status = 'rejected';
            if (transaction.type === 'withdrawal') {
                user.balance = (user.balance || 0) + transaction.amount;
                await user.save();
            }
        } else {
            return res.status(400).json({ success: false, message: 'إجراء غير صالح' });
        }

        await transaction.save();

        // تسجيل في سجل العمليات
        const log = new AdminLog({
            adminId: adminEmail || 'system',
            action: action === 'approve' ? 'قبول طلب' : 'رفض طلب',
            targetId: user._id,
            details: `${action === 'approve' ? 'قبول' : 'رفض'} ${transaction.type} بمبلغ ${transaction.amount} للمستخدم ${user.email}`
        });
        await log.save();

        res.json({
            success: true,
            message: `✅ تم ${action === 'approve' ? 'قبول' : 'رفض'} الطلب بنجاح`
        });

    } catch (error) {
        console.error('❌ Process request error:', error);
        res.status(500).json({ success: false, message: 'خطأ في معالجة الطلب' });
    }
});

// ==========================================
// 3. تعديل رصيد مستخدم
// ==========================================
router.post('/modify-balance', async (req, res) => {
    try {
        const { email, newBalance, adminEmail } = req.body;

        if (!email || newBalance === undefined) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        const oldBalance = user.balance;
        user.balance = newBalance;
        await user.save();

        // تسجيل في سجل العمليات
        const log = new AdminLog({
            adminId: adminEmail || 'system',
            action: 'تعديل رصيد',
            targetId: user._id,
            details: `تعديل رصيد ${user.email} من ${oldBalance} إلى ${newBalance}`
        });
        await log.save();

        res.json({
            success: true,
            message: `✅ تم تحديث رصيد ${user.email} إلى ${newBalance}`,
            newBalance: user.balance
        });

    } catch (error) {
        console.error('❌ Modify balance error:', error);
        res.status(500).json({ success: false, message: 'خطأ في تعديل الرصيد' });
    }
});

// ==========================================
// 4. إرسال نقاط هدايا
// ==========================================
router.post('/send-gift', async (req, res) => {
    try {
        const { email, points, adminEmail } = req.body;

        if (!email || !points || points <= 0) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        user.giftPoints = (user.giftPoints || 0) + points;
        await user.save();

        // تسجيل في سجل العمليات
        const log = new AdminLog({
            adminId: adminEmail || 'system',
            action: 'إرسال هدايا',
            targetId: user._id,
            details: `إرسال ${points} نقطة هدايا للمستخدم ${user.email}`
        });
        await log.save();

        res.json({
            success: true,
            message: `✅ تم إرسال ${points} نقطة هدايا للمستخدم ${user.email}`
        });

    } catch (error) {
        console.error('❌ Send gift error:', error);
        res.status(500).json({ success: false, message: 'خطأ في إرسال الهدايا' });
    }
});

// ==========================================
// 5. تعطيل/تفعيل حساب
// ==========================================
router.post('/toggle-ban', async (req, res) => {
    try {
        const { email, ban, adminEmail } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        if (user.role === 'admin' || user.role === 'super') {
            return res.json({ success: false, message: 'لا يمكن تعطيل مشرف كامل' });
        }

        user.banned = ban;
        await user.save();

        // تسجيل في سجل العمليات
        const log = new AdminLog({
            adminId: adminEmail || 'system',
            action: ban ? 'تعطيل حساب' : 'تفعيل حساب',
            targetId: user._id,
            details: `${ban ? 'تعطيل' : 'تفعيل'} حساب ${user.email}`
        });
        await log.save();

        res.json({
            success: true,
            message: `✅ تم ${ban ? 'تعطيل' : 'تفعيل'} حساب ${user.email}`
        });

    } catch (error) {
        console.error('❌ Toggle ban error:', error);
        res.status(500).json({ success: false, message: 'خطأ في تعطيل الحساب' });
    }
});

// ==========================================
// 6. تغيير صلاحية مستخدم
// ==========================================
router.post('/set-role', async (req, res) => {
    try {
        const { email, role, adminEmail } = req.body;

        if (!email || !role) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const validRoles = ['user', 'admin', 'super', 'finance', 'support', 'monitor'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'صلاحية غير صالحة' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        user.role = role;
        await user.save();

        // تسجيل في سجل العمليات
        const log = new AdminLog({
            adminId: adminEmail || 'system',
            action: 'تغيير صلاحية',
            targetId: user._id,
            details: `تغيير صلاحية ${user.email} إلى ${role}`
        });
        await log.save();

        res.json({
            success: true,
            message: `✅ تم تغيير صلاحية ${user.email} إلى ${role}`
        });

    } catch (error) {
        console.error('❌ Set role error:', error);
        res.status(500).json({ success: false, message: 'خطأ في تغيير الصلاحية' });
    }
});

// ==========================================
// 7. إحصائيات مالية (للإدارة)
// ==========================================
router.get('/financial-stats', async (req, res) => {
    try {
        const users = await User.find();
        const transactions = await Transaction.find();

        const deposits = transactions.filter(t => t.type === 'deposit' && t.status === 'approved');
        const withdrawals = transactions.filter(t => t.type === 'withdrawal' && t.status === 'approved');
        const pending = transactions.filter(t => t.status === 'pending');

        const totalDeposits = deposits.reduce((s, t) => s + t.amount, 0);
        const totalWithdrawals = withdrawals.reduce((s, t) => s + t.amount, 0);
        const totalGifts = users.reduce((s, u) => s + (u.giftPoints || 0), 0);
        const netProfit = totalDeposits - totalWithdrawals - totalGifts;

        // إحصائيات يومية (آخر 30 يوم)
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const recentTransactions = transactions.filter(t => new Date(t.createdAt).getTime() > thirtyDaysAgo);

        const dailyStats = {};
        recentTransactions.forEach(t => {
            const day = new Date(t.createdAt).toISOString().split('T')[0];
            if (!dailyStats[day]) dailyStats[day] = { deposits: 0, withdrawals: 0 };
            if (t.type === 'deposit' && t.status === 'approved') {
                dailyStats[day].deposits += t.amount;
            }
            if (t.type === 'withdrawal' && t.status === 'approved') {
                dailyStats[day].withdrawals += t.amount;
            }
        });

        // تحويل إلى مصفوفة
        const dailyData = Object.entries(dailyStats).map(([date, data]) => ({
            date,
            deposits: data.deposits,
            withdrawals: data.withdrawals
        })).sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            success: true,
            summary: {
                totalDeposits,
                totalWithdrawals,
                totalGifts,
                netProfit,
                pendingRequests: pending.length
            },
            dailyData,
            totalUsers: users.length
        });

    } catch (error) {
        console.error('❌ Financial stats error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات' });
    }
});

// ==========================================
// 8. جلب سجل العمليات (Audit Log)
// ==========================================
router.get('/logs', async (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.query;
        const logs = await AdminLog.find()
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await AdminLog.countDocuments();

        res.json({
            success: true,
            logs,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });

    } catch (error) {
        console.error('❌ Logs error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب السجل' });
    }
});

// ==========================================
// 9. نظام الإحالات (شجرة الإحالات)
// ==========================================
router.get('/referral-tree', async (req, res) => {
    try {
        const users = await User.find();
        const topUsers = users.filter(u => !u.referredBy);

        function buildTree(user, allUsers, depth = 0) {
            const referrals = allUsers.filter(u => u.referredBy === user.email);
            return {
                username: user.username,
                email: user.email,
                referralCode: user.referralCode,
                referrals: referrals.map(u => buildTree(u, allUsers, depth + 1)),
                depth
            };
        }

        const tree = topUsers.map(u => buildTree(u, users));

        res.json({ success: true, tree });

    } catch (error) {
        console.error('❌ Referral tree error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب شجرة الإحالات' });
    }
});

module.exports = router;
