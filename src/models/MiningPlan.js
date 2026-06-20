// ==========================================
// src/models/MiningPlan.js - نموذج خطط التعدين
// ==========================================

const mongoose = require('mongoose');

const MiningPlanSchema = new mongoose.Schema({
  // ===== معلومات الخطة =====
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  
  // ===== السعر والعائد =====
  price: {
    type: Number,
    required: true,
    min: 0
  },
  dailyReturn: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    default: 30, // عدد الأيام
    min: 1
  },
  
  // ===== المستوى =====
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // ===== الحالة =====
  isActive: {
    type: Boolean,
    default: true
  },
  
  // ===== الطوابع الزمنية =====
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const MiningPlan = mongoose.model('MiningPlan', MiningPlanSchema);

module.exports = MiningPlan;
