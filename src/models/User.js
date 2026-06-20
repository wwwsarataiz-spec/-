// ==========================================
// src/models/User.js - نموذج المستخدم
// ==========================================

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // ===== معلومات الحساب =====
  fullName: {
    type: String,
    required: true,
    trim: true,
    default: 'مستخدم جديد'
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    default: 'غير محدد'
  },
  password: {
    type: String,
    required: true
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

  // ===== الكازينو =====
  freeCasinoSpins: {
    type: Number,
    default: 2
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
    unique: true,
    sparse: true
  },

  // ===== الصلاحيات =====
  role: {
    type: String,
    enum: ['user', 'admin', 'manager', 'assistant'],
    default: 'user'
  },

  // ===== الحالة =====
  verified: {
    type: Boolean,
    default: true   // ✅ تم إلغاء تفعيل البريد الإلكتروني مؤقتاً
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // ===== الإعدادات =====
  language: {
    type: String,
    enum: ['ar', 'en'],
    default: 'ar'
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

  // ===== الطوابع الزمنية =====
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ===== إنشاء كود إحالة فريد قبل الحفظ =====
UserSchema.pre('save', async function(next) {
  if (!this.referralCode) {
    this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);
