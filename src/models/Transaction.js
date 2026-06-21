// ==========================================
// models/Transaction.js - نموذج المعاملات
// ==========================================

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'casino_bet', 'gift', 'investment'], required: true },
  amount: { type: Number, required: true },
  txHash: { type: String, default: '' },
  receipt: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', TransactionSchema);
module.exports = { Transaction };
