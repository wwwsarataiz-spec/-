// ==========================================
// routes/chat.js - نظام الدردشة
// ==========================================

const express = require('express');
const router = express.Router();
const { User } = require('../models/User');

// ==========================================
// تخزين الرسائل مؤقتاً (في الإنتاج تستخدم قاعدة بيانات)
// ==========================================
let chatMessages = [];

// ==========================================
// 1. إرسال رسالة
// ==========================================
router.post('/send', async (req, res) => {
    try {
        const { email, message } = req.body;

        if (!email || !message) {
            return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
        }

        if (message.length > 500) {
            return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً (حد أقصى 500 حرف)' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        const chatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            userId: user._id,
            username: user.username,
            email: user.email,
            role: user.role || 'user',
            message: message.trim(),
            timestamp: new Date(),
            read: false
        };

        chatMessages.push(chatMessage);

        // الاحتفاظ بآخر 100 رسالة فقط
        if (chatMessages.length > 100) {
            chatMessages = chatMessages.slice(-100);
        }

        res.json({
            success: true,
            message: '✅ تم إرسال الرسالة',
            chatMessage
        });

    } catch (error) {
        console.error('❌ Send chat error:', error);
        res.status(500).json({ success: false, message: 'خطأ في إرسال الرسالة' });
    }
});

// ==========================================
// 2. جلب الرسائل (آخر 50 رسالة)
// ==========================================
router.get('/messages', (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const messages = chatMessages.slice(-parseInt(limit));
        res.json({ success: true, messages });

    } catch (error) {
        console.error('❌ Get messages error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الرسائل' });
    }
});

// ==========================================
// 3. جلب رسائل مستخدم معين
// ==========================================
router.post('/user-messages', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }

        const messages = chatMessages.filter(m => m.email === email);
        res.json({ success: true, messages });

    } catch (error) {
        console.error('❌ User messages error:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الرسائل' });
    }
});

// ==========================================
// 4. تحديث حالة القراءة (للمشرف)
// ==========================================
router.post('/mark-read', async (req, res) => {
    try {
        const { messageId } = req.body;

        if (!messageId) {
            return res.status(400).json({ success: false, message: 'معرف الرسالة مطلوب' });
        }

        const message = chatMessages.find(m => m.id === messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        }

        message.read = true;
        res.json({ success: true, message: '✅ تم تحديث حالة القراءة' });

    } catch (error) {
        console.error('❌ Mark read error:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحديث الحالة' });
    }
});

// ==========================================
// 5. حذف رسالة (للمشرف فقط)
// ==========================================
router.post('/delete', async (req, res) => {
    try {
        const { messageId } = req.body;

        if (!messageId) {
            return res.status(400).json({ success: false, message: 'معرف الرسالة مطلوب' });
        }

        const index = chatMessages.findIndex(m => m.id === messageId);
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        }

        chatMessages.splice(index, 1);
        res.json({ success: true, message: '✅ تم حذف الرسالة' });

    } catch (error) {
        console.error('❌ Delete message error:', error);
        res.status(500).json({ success: false, message: 'خطأ في حذف الرسالة' });
    }
});

module.exports = router;
