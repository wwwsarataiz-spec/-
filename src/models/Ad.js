// ==========================================
// models/Ad.js - نموذج الإعلانات
// ==========================================

const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  title: { type: String, default: 'إعلان ممول' },
  link: { type: String, required: true },
  platform: { type: String, default: 'telegram' },
  totalBudget: { type: Number, required: true },
  remainingBudget: { type: Number, required: true },
  costPerView: { type: Number, default: 0.005 },
  totalViewsRequired: { type: Number, default: 1000 },
  viewsCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  advertiserId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Ad = mongoose.model('Ad', AdSchema);
module.exports = { Ad };
