// ==========================================
// src/models/Ad.js - نموذج الإعلانات المدفوعة
// ==========================================

const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  // ===== معلومات الإعلان =====
  title: {
    type: String,
    default: 'إعلان ممول'
  },
  link: {
    type: String,
    required: true,
    trim: true
  },
  platform: {
    type: String,
    enum: ['telegram', 'youtube', 'website', 'other'],
    default: 'telegram'
  },
  
  // ===== الميزانية =====
  totalBudget: {
    type: Number,
    required: true,
    min: 0
  },
  remainingBudget: {
    type: Number,
    required: true,
    min: 0
  },
  costPerView: {
    type: Number,
    default: 0.005
  },
  
  // ===== المشاهدات =====
  totalViewsRequired: {
    type: Number,
    default: 1000,
    min: 100
  },
  viewsCount: {
    type: Number,
    default: 0
  },
  
  // ===== الحالة =====
  isActive: {
    type: Boolean,
    default: true
  },
  
  // ===== المعلن =====
  advertiserId: {
    type: String,
    required: true,
    index: true
  },
  
  // ===== الطوابع الزمنية =====
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  }
});

// إنشاء الموديل
const Ad = mongoose.model('Ad', AdSchema);

module.exports = Ad;
