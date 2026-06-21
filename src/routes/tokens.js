// ==========================================
// routes/tokens.js - إنشاء العملات الرقمية
// ==========================================

const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { Transaction } = require('../models/Transaction');

// ==========================================
// 1. إنشاء عملة جديدة
// ==========================================
router.post('/create', async (req, res) => {
    try {
        const {
            email,
            tokenName,
            tokenSymbol,
            network,
            totalSupply,
            decimals,
            logo,
            txId,
            walletConnected
        } = req.body;

        // التحقق من البيانات الأساسية
        if (!email || !tokenName || !tokenSymbol || !network) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        // التحقق من رمز العملة (3-5 أحرف إنجليزية)
        if (!/^[A-Z]{3,5}$/.test(tokenSymbol)) {
            return res.status(400).json({ success: false, message: 'رمز العملة يجب أن يكون 3-5 أحرف إنجليزية' });
        }

        // التحقق من الشبكة
        const validNetworks = ['TRC-20', 'ERC-20', 'BEP-20'];
        if (!validNetworks.includes(network)) {
            return res.status(400).json({ success: false, message: 'شبكة غير مدعومة' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        // التحقق من الدفع (إما TxID أو رصيد كافٍ)
        const fee = 10; // رسوم ثابتة 10 USDT
        let paymentMethod = '';

        if (walletConnected) {
            // في حالة ربط المحفظة، نعتبر الدفع مؤكداً (محاكاة)
            paymentMethod = 'wallet';
        } else if (txId && txId.trim().length > 0) {
            // استخدام TxID كإثبات دفع
            paymentMethod = 'txid';
            // التحقق من عدم تكرار TxID
            const existing = await Transaction.findOne({ txHash: txId });
            if (existing) {
                return res.json({ success: false, message: 'معرف المعاملة مستخدم مسبقاً' });
            }
        } else {
            // الدفع من الرصيد
            if (user.balance < fee) {
                return res.json({ success: false, message: `رصيد غير كافٍ! تحتاج ${fee} USDT` });
            }
            user.balance -= fee;
            paymentMethod = 'balance';
        }

        // إنشاء سجل العملة
        const tokenData = {
            name: tokenName,
            symbol: tokenSymbol,
            network: network,
            totalSupply: totalSupply || 1000000,
            decimals: decimals || 18,
            logo: logo || '',
            txId: txId || '',
            paymentMethod: paymentMethod,
            createdAt: new Date(),
            status: 'created'
        };

        if (!user.tokens) user.tokens = [];
        user.tokens.push(tokenData);
        await user.save();

        // تسجيل المعاملة
        const transaction = new Transaction({
            userId: user._id,
            type: 'custom_plan',
            amount: fee,
            txHash: txId || '',
            status: 'approved',
            note: `إنشاء عملة ${tokenName} (${tokenSymbol}) على شبكة ${network}`
        });
        await transaction.save();

        res.json({
            success: true,
            message: `✅ تم إنشاء العملة ${tokenName} (${tokenSymbol}) على شبكة ${network} بنجاح! سيتم إرسال العقد إلى محفظتك.`,
            token: tokenData,
            newBalance: user.balance
        });

    } catch (error) {
        console.error('❌ Create token error:', error);
        res.status(500).json({ success: false, message: 'خطأ في إنشاء العملة' });
    }
});

// ==========================================
// 2. جلب عملات المستخدم
// ==========================================
router.post('/my-tokens', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        res.json({
            success: true,
            tokens: user.tokens || []
        });

    } catch (error) {
        console.error('❌ My tokens error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب العملات' });
    }
});

// ==========================================
// 3. جلب جميع العملات (للمشرف)
// ==========================================
router.get('/all', async (req, res) => {
    try {
        const users = await User.find({ tokens: { $exists: true, $ne: [] } });
        const allTokens = [];

        users.forEach(user => {
            (user.tokens || []).forEach(token => {
                allTokens.push({
                    ...token.toObject ? token.toObject() : token,
                    owner: user.email,
                    ownerName: user.username
                });
            });
        });

        // ترتيب حسب التاريخ (الأحدث أولاً)
        allTokens.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            tokens: allTokens
        });

    } catch (error) {
        console.error('❌ All tokens error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب العملات' });
    }
});

module.exports = router;
