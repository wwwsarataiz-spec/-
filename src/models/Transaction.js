// ==========================================
// src/models/Transaction.js - نموذج المعاملات المالية
// ==========================================

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // ===== المستخدم =====
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // ===== نوع المعاملة =====
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'casino_win', 'casino_loss', 'admin_adjustment', 'gift'],
    required: true
  },
  
  // ===== المبلغ =====
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // ===== العملة =====
  currency: {
    type: String,
    default: 'USDT'
  },
  
  // ===== حالة المعاملة =====
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  
  // ===== هاش التحويل (للإيداع/السحب) =====
  txHash: {
    type: String,
    default: '',
    trim: true
  },
  
  // ===== ملاحظات إضافية =====
  note: {
    type: String,
    default: ''
  },
  
  // ===== من قام بالمعالجة (للمسؤول) =====
  processedBy: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date,
    default: null
  },
  
  // ===== الطوابع الزمنية =====
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// إنشاء الموديل
const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;
