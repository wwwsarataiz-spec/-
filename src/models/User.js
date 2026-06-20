// ==========================================
// src/models/User.js - نموذج المستخدم
// ==========================================

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // ===== المعلومات الأساسية =====
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'manager', 'assistant'],
    default: 'user'
  },
  
  // ===== الأرصدة =====
  usdBalance: {
    type: Number,
    default: 0.00
  },
  casinoBalance: {
    type: Number,
    default: 0.00
  },
  giftPoints: {
    type: Number,
    default: 0
  },
  
  // ===== التعدين =====
  miningEnergy: {
    type: Number,
    default: 1000
  },
  lastMiningClick: {
    type: Date,
    default: Date.now
  },
  vipLevel: {
    type: Number,
    default: 1
  },
  
  // ===== الكازينو =====
  freeCasinoSpins: {
    type: Number,
    default: 2
  },
  totalCasinoPlayed: {
    type: Number,
    default: 0
  },
  
  // ===== الإعلانات =====
  watchedAdsCount: {
    type: Number,
    default: 0
  },
  lastAdTime: {
    type: Number,
    default: 0
  },
  
  // ===== الإحالات =====
  referredBy: {
    type: String,
    default: null
  },
  referralCode: {
    type: String,
    default: ''
  },
  
  // ===== حالة الحساب =====
  verified: {
    type: Boolean,
    default: true
  },
  verificationCode: {
    type: String,
    default: ''
  },
  codeExpiry: {
    type: Date,
    default: null
  },
  
  // ===== السحب =====
  withdrawalCount: {
    type: Number,
    default: 0
  },
  lastWithdrawalWeek: {
    type: Number,
    default: 0
  },
  
  // ===== المكافآت =====
  lastDailyClaimDate: {
    type: Date,
    default: null
  },
  
  // ===== الإعدادات =====
  language: {
    type: String,
    default: 'ar'
  },
  
  // ===== الطوابع الزمنية =====
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// تحديث updatedAt تلقائياً قبل الحفظ
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// إنشاء الموديل
const User = mongoose.model('User', UserSchema);

module.exports = User;
