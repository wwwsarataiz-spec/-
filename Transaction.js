// ==========================================
// models/Transaction.js - نموذج المعاملات المالية
// ==========================================

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // ===== المستخدم =====
  userId: { type: String, required: true, index: true },

  // ===== نوع المعاملة =====
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'casino_bet', 'gift', 'investment', 'custom_plan'],
    required: true
  },

  // ===== المبلغ =====
  amount: { type: Number, required: true },

  // ===== هاش المعاملة (للإيداع) =====
  txHash: { type: String, default: '' },

  // ===== صورة الحوالة (للإيداع) =====
  receipt: { type: String, default: '' },

  // ===== الحالة =====
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  // ===== ملاحظات =====
  note: { type: String, default: '' },

  // ===== تاريخ الإنشاء =====
  createdAt: { type: Date, default: Date.now }
});

// إنشاء فهرس مركب للبحث السريع
TransactionSchema.index({ userId: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', TransactionSchema);
module.exports = { Transaction };
