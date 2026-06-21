// ==========================================
// models/AdminLog.js - سجل العمليات الإدارية
// ==========================================

const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
  // ===== المشرف =====
  adminId: { type: String, required: true },

  // ===== الإجراء =====
  action: { type: String, required: true },

  // ===== المستهدف =====
  targetId: { type: String, default: '' },

  // ===== التفاصيل =====
  details: { type: String, default: '' },

  // ===== التاريخ =====
  timestamp: { type: Date, default: Date.now }
});

// إنشاء فهرس للبحث السريع
AdminLogSchema.index({ timestamp: -1 });
AdminLogSchema.index({ adminId: 1 });

const AdminLog = mongoose.model('AdminLog', AdminLogSchema);
module.exports = { AdminLog };
