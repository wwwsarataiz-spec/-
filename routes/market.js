// ==========================================
// routes/market.js - سوق نقاط الهدايا
// ==========================================

const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { Transaction } = require('../models/Transaction');

// ==========================================
// تخزين عروض السوق مؤقتاً (في الإنتاج تستخدم قاعدة بيانات)
// ==========================================
let marketListings = [];
let disputes = [];

// ==========================================
// 1. عرض نقاط للبيع
// ==========================================
router.post('/list', async (req, res) => {
    try {
        const { email, points, price } = req.body;

        if (!email || !points || !price) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        if (points <= 0 || price <= 0) {
            return res.status(400).json({ success: false, message: 'القيم يجب أن تكون موجبة' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        if ((user.giftPoints || 0) < points) {
            return res.json({ success: false, message: 'ليس لديك نقاط كافية' });
        }

        // خصم النقاط من المستخدم
        user.giftPoints -= points;
        await user.save();

        // إضافة العرض إلى السوق
        const listing = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            seller: email,
            sellerName: user.username,
            sellerPhone: user.phone || 'غير محدد',
            sellerTelegram: user.telegram || 'غير محدد',
            points,
            price,
            date: new Date(),
            sold: false,
            reserved: false,
            reservedBy: null
        };

        marketListings.push(listing);

        // تسجيل المعاملة
        const transaction = new Transaction({
            userId: user._id,
            type: 'gift',
            amount: points,
            note: `عرض ${points} نقطة للبيع بسعر ${price} USDT`,
            status: 'approved'
        });
        await transaction.save();

        res.json({
            success: true,
            message: `✅ تم عرض ${points} نقطة للبيع بسعر ${price} USDT`,
            listing
        });

    } catch (error) {
        console.error('❌ List points error:', error);
        res.status(500).json({ success: false, message: 'خطأ في عرض النقاط' });
    }
});

// ==========================================
// 2. جلب العروض المتاحة
// ==========================================
router.get('/listings', (req, res) => {
    try {
        const active = marketListings.filter(l => !l.sold && !l.reserved);
        res.json({ success: true, listings: active });

    } catch (error) {
        console.error('❌ Get listings error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب العروض' });
    }
});

// ==========================================
// 3. حجز وشراء نقاط
// ==========================================
router.post('/buy', async (req, res) => {
    try {
        const { listingId, buyerEmail } = req.body;

        if (!listingId || !buyerEmail) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const listing = marketListings.find(l => l.id === listingId);
        if (!listing) {
            return res.status(404).json({ success: false, message: 'العرض غير موجود' });
        }

        if (listing.sold || listing.reserved) {
            return res.json({ success: false, message: 'هذا العرض غير متاح حالياً' });
        }

        if (listing.seller === buyerEmail) {
            return res.json({ success: false, message: 'لا يمكنك شراء نقاطك الخاصة' });
        }

        const buyer = await User.findOne({ email: buyerEmail });
        if (!buyer) {
            return res.status(404).json({ success: false, message: 'المشتري غير موجود' });
        }

        if (buyer.balance < listing.price) {
            return res.json({ success: false, message: 'رصيد غير كافٍ' });
        }

        const seller = await User.findOne({ email: listing.seller });
        if (!seller) {
            return res.status(404).json({ success: false, message: 'البائع غير موجود' });
        }

        // خصم من المشتري
        buyer.balance -= listing.price;

        // إضافة النقاط للمشتري
        buyer.giftPoints = (buyer.giftPoints || 0) + listing.points;

        // إضافة المبلغ للبائع
        seller.balance = (seller.balance || 0) + listing.price;

        await buyer.save();
        await seller.save();

        // تحديث حالة العرض
        listing.sold = true;
        listing.reserved = true;
        listing.reservedBy = buyerEmail;

        // تسجيل المعاملات
        const transactionBuy = new Transaction({
            userId: buyer._id,
            type: 'gift',
            amount: listing.price,
            note: `شراء ${listing.points} نقطة من ${listing.seller}`,
            status: 'approved'
        });
        await transactionBuy.save();

        const transactionSell = new Transaction({
            userId: seller._id,
            type: 'gift',
            amount: listing.price,
            note: `بيع ${listing.points} نقطة لـ ${buyerEmail}`,
            status: 'approved'
        });
        await transactionSell.save();

        res.json({
            success: true,
            message: `✅ تم شراء ${listing.points} نقطة بنجاح`,
            newBalance: buyer.balance,
            newGiftPoints: buyer.giftPoints
        });

    } catch (error) {
        console.error('❌ Buy points error:', error);
        res.status(500).json({ success: false, message: 'خطأ في شراء النقاط' });
    }
});

// ==========================================
// 4. تقديم بلاغ (نزاع)
// ==========================================
router.post('/dispute', async (req, res) => {
    try {
        const { listingId, reporterEmail, reason } = req.body;

        if (!listingId || !reporterEmail) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const listing = marketListings.find(l => l.id === listingId);
        if (!listing) {
            return res.status(404).json({ success: false, message: 'العرض غير موجود' });
        }

        const dispute = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            listingId,
            reporter: reporterEmail,
            seller: listing.seller,
            points: listing.points,
            price: listing.price,
            reason: reason || 'نزاع على الصفقة',
            status: 'pending',
            date: new Date()
        };

        disputes.push(dispute);

        res.json({
            success: true,
            message: '✅ تم تقديم البلاغ، سيتم النظر فيه من الإدارة',
            dispute
        });

    } catch (error) {
        console.error('❌ Dispute error:', error);
        res.status(500).json({ success: false, message: 'خطأ في تقديم البلاغ' });
    }
});

// ==========================================
// 5. حل النزاع (للمشرف فقط)
// ==========================================
router.post('/resolve-dispute', async (req, res) => {
    try {
        const { disputeId, resolution, adminEmail } = req.body;

        if (!disputeId || !resolution) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        const dispute = disputes.find(d => d.id === disputeId);
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'البلاغ غير موجود' });
        }

        if (dispute.status !== 'pending') {
            return res.json({ success: false, message: 'تم حل هذا البلاغ مسبقاً' });
        }

        dispute.status = 'resolved';
        dispute.resolution = resolution;
        dispute.resolvedAt = new Date();
        dispute.resolvedBy = adminEmail || 'system';

        // تسجيل في سجل العمليات (سيتم إضافته لاحقاً)

        res.json({
            success: true,
            message: '✅ تم حل النزاع بنجاح',
            dispute
        });

    } catch (error) {
        console.error('❌ Resolve dispute error:', error);
        res.status(500).json({ success: false, message: 'خطأ في حل النزاع' });
    }
});

// ==========================================
// 6. جلب البلاغات المعلقة (للمشرف)
// ==========================================
router.get('/disputes/pending', (req, res) => {
    try {
        const pending = disputes.filter(d => d.status === 'pending');
        res.json({ success: true, disputes: pending });

    } catch (error) {
        console.error('❌ Get disputes error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب البلاغات' });
    }
});

module.exports = router;
