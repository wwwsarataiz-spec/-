// ==========================================
// models/User.js - نموذج المستخدم
// ==========================================

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // المعلومات الأساسية
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String, default: 'غير محدد' },
    telegram: { type: String, default: 'غير محدد' },

    // الأرصدة
    balance: { type: Number, default: 0 },
    casinoBalance: { type: Number, default: 0 },
    giftPoints: { type: Number, default: 0 },

    // التعدين
    miningEnergy: { type: Number, default: 1000 },
    miningLevel: { type: Number, default: 1 },

    // الكازينو
    freeSpins: { type: Number, default: 2 },
    totalCasinoPlayed: { type: Number, default: 0 },

    // الإعلانات
    watchedAdsCount: { type: Number, default: 0 },
    lastAdTime: { type: Number, default: 0 },

    // الإحالات
    referralCode: { type: String, unique: true },
    referredBy: { type: String, default: null },
    referrals: { type: Array, default: [] },

    // الصلاحيات والحالة
    role: { type: String, default: 'user' }, // user, admin, super, finance, support, monitor
    banned: { type: Boolean, default: false },

    // التحقق
    verified: { type: Boolean, default: false },
    verificationCode: { type: String, default: '' },
    codeExpiry: { type: Date, default: null },

    // الاستثمارات
    investments: { type: Array, default: [] },

    // العملات المنشأة
    tokens: { type: Array, default: [] },

    // الإعدادات
    language: { type: String, default: 'ar' },

    // التواقيت
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// تحديث updatedAt تلقائياً
UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const User = mongoose.model('User', UserSchema);
module.exports = { User };
