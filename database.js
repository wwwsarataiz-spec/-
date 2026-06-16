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
  referredBy: { type: String, default: null }, // رابط الإحالة
  lastBonusDate: { type: Date, default: null },
  walletAddress: { type: String, default: '' }, // لمحفظة السحب
  pendingWithdrawals: { type: Number, default: 0 } // طلبات السحب المعلقة
});

const User = mongoose.model('User', UserSchema);

module.exports = { User };
