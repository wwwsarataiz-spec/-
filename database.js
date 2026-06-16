const mongoose = require('mongoose');

// إعداد الاتصال مع ضمان استقرار الرابط
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, default: 'مستخدم جديد' },
  phoneNumber: { type: String, default: 'غير محدد' },
  points: { type: Number, default: 0 },
  miningLevel: { type: Number, default: 1 },
  referredBy: { type: String, default: null },
  lastBonusDate: { type: Date, default: null },
  walletAddress: { type: String, default: '' },
  pendingWithdrawals: { type: Number, default: 0 }
});

// --- إضافة نظام الإعلانات (إضافة فقط دون التأثير على ما سبق) ---
const AdSchema = new mongoose.Schema({
  title: String,
  link: String,
  budget: { type: Number, default: 0 },
  costPerView: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

const AdLogSchema = new mongoose.Schema({
  telegramId: String,
  adId: mongoose.Schema.Types.ObjectId,
  viewedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Ad = mongoose.model('Ad', AdSchema);
const AdLog = mongoose.model('AdLog', AdLogSchema);

module.exports = { User, Ad, AdLog };
