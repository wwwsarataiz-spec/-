const mongoose = require('mongoose');

// ==========================================
// الاتصال بقاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
.catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// ==========================================
// 1. مخطط المستخدمين (الأساسي فقط)
// ==========================================
const UserSchema = new mongoose.Schema({
  fullName: { type: String, default: 'مستخدم جديد' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, default: 'غير محدد' },
  role: { type: String, default: 'user' },
  usdBalance: { type: Number, default: 0 },
  casinoBalance: { type: Number, default: 0 },
  freeCasinoSpins: { type: Number, default: 2 },
  verified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// 2. مخطط الإعلانات (للتشغيل الأساسي)
// ==========================================
const AdSchema = new mongoose.Schema({
  link: { type: String, required: true },
  totalBudget: { type: Number, required: true },
  remainingBudget: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
  advertiserId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// 3. مخطط المعاملات (للتشغيل الأساسي)
// ==========================================
const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// إنشاء الموديلات وتصديرها
// ==========================================
const User = mongoose.model('User', UserSchema);
const Ad = mongoose.model('Ad', AdSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = { User, Ad, Transaction };
