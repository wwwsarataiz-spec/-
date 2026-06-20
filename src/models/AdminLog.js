// ==========================================
// src/models/AdminLog.js - سجل نشاط الإدارة
// ==========================================

const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
  // ===== المسؤول =====
  adminId: {
    type: String,
    required: true,
    index: true
  },
  
  // ===== الإجراء =====
  action: {
    type: String,
    required: true,
    enum: [
      'add_admin',
      'remove_admin',
      'modify_balance',
      'modify_casino_balance',
      'send_gift_points',
      'approve_deposit',
      'reject_deposit',
      'approve_withdrawal',
      'reject_withdrawal',
      'approve_token',
      'reject_token',
      'delete_user',
      'ban_user'
    ]
  },
  
  // ===== المستهدف =====
  targetId: {
    type: String,
    default: ''
  },
  
  // ===== التفاصيل =====
  details: {
    type: String,
    default: ''
  },
  
  // ===== الطوابع الزمنية =====
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const AdminLog = mongoose.model('AdminLog', AdminLogSchema);

module.exports = AdminLog;
