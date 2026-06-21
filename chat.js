// ==========================================
// routes/chat.js - نظام الدردشة
// ==========================================

const express = require('express');
const router = express.Router();
const { User } = require('../models/User');

// ==========================================
// تخزين رسائل الدردشة مؤقتاً (في الإنتاج تستخدم قاعدة بيانات)
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

    if (message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'الرسالة فارغة' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const chatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      message: message.trim(),
      timestamp: new Date(),
      read: false
    };

    chatMessages.push(chatMessage);

    // الحفاظ على آخر 100 رسالة فقط
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
    console.error('❌ Get chat error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الرسائل' });
  }
});

// ==========================================
// 3. جلب الرسائل غير المقروءة
// ==========================================
router.get('/unread', (req, res) => {
  try {
    const unread = chatMessages.filter(m => !m.read);
    res.json({ success: true, count: unread.length, messages: unread });

  } catch (error) {
    console.error('❌ Get unread error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الرسائل غير المقروءة' });
  }
});

// ==========================================
// 4. تحديد رسائل كمقروءة
// ==========================================
router.post('/mark-read', (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, message: 'البيانات غير مكتملة' });
    }

    chatMessages = chatMessages.map(m => {
      if (messageIds.includes(m.id)) {
        return { ...m, read: true };
      }
      return m;
    });

    res.json({
      success: true,
      message: `✅ تم تحديد ${messageIds.length} رسالة كمقروءة`
    });

  } catch (error) {
    console.error('❌ Mark read error:', error);
    res.status(500).json({ success: false, message: 'خطأ في تحديد الرسائل كمقروءة' });
  }
});

// ==========================================
// 5. حذف رسالة (للمشرف فقط)
// ==========================================
router.delete('/message/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'معرف الرسالة مطلوب' });
    }

    const admin = await User.findOne({ email: adminEmail });
    if (!admin || (admin.role !== 'admin' && admin.role !== 'super' && admin.role !== 'support')) {
      return res.status(403).json({ success: false, message: 'غير مصرح' });
    }

    const index = chatMessages.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
    }

    chatMessages.splice(index, 1);

    res.json({
      success: true,
      message: '✅ تم حذف الرسالة'
    });

  } catch (error) {
    console.error('❌ Delete chat error:', error);
    res.status(500).json({ success: false, message: 'خطأ في حذف الرسالة' });
  }
});

module.exports = router;
