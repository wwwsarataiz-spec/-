const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String },
    balance: { type: Number, default: 0 }, // الرصيد القابل للسحب
    energy: { type: Number, default: 100 }, // طاقة المستخدم
    
    // شجرة الإحالات والعمولات
    referredBy: { type: String, default: null }, // الشخص الذي دعاه
    referralsCount: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },

    // نظام التعدين المؤتمت بناءً على الوقت المنقضي
    miningPackage: { type: String, default: 'Free' }, 
    miningRatePerHour: { type: Number, default: 0.5 }, // كم يربح في الساعة
    lastMiningClaim: { type: Date, default: Date.now }, // آخر وقت استلم فيه الأرباح

    role: { type: String, default: 'user' }, // user أو admin أو supervisor
    isBanned: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', UserSchema);
