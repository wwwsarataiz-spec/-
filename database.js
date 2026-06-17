const mongoose = require('mongoose');

// إعداد الاتصال مع ضمان استقرار الرابط
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح وبأعلى معايير الأمان'))
.catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// --- ١. مخطط المستخدمين المطور والمحمي الشامل ---
const UserSchema = new mongoose.Schema({
  // الحقول القديمة (مضمونة ومحفوظة بالكامل)
  telegramId: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, default: 'مستخدم جديد' },
  phoneNumber: { type: String, default: 'غير محدد' },
  points: { type: Number, default: 0 },
  miningLevel: { type: Number, default: 1 },
  referredBy: { type: String, default: null },
  lastBonusDate: { type: Date, default: null },
  walletAddress: { type: String, default: '' },
  pendingWithdrawals: { type: Number, default: 0 },

  // الإضافات الجديدة للتوافق مع الواجهة
  usdBalance: { type: Number, default: 0.000 }, // رصيد الدولار بدقة 3 خانات عشرية للاحتساب الدقيق
  miningEnergy: { type: Number, default: 1000 },
  lastMiningClick: { type: Date, default: Date.now },
  vipPlanLevel: { type: Number, default: 1 },
  customMiningInvestment: { type: Number, default: 0 },
  role: { type: String, default: 'user' }
});

// --- ٢. مخطط نظام الإعلانات الحقيقي والمدفوع (حسب رغبتك تماماً) ---
const AdSchema = new mongoose.Schema({
  title: { type: String, default: 'إعلان حقيقي ممول' },
  link: { type: String, required: true },          // رابط القناة أو البوت الخاص بالمعلن
  totalBudget: { type: Number, required: true },    // الميزانية الإجمالية المدفوعة للإدارة (مثلاً 10$)
  remainingBudget: { type: Number, required: true },// الميزانية المتبقية (يُخصم منها مع كل مشاهدة)
  costPerView: { type: Number, default: 0.001 },    // القيمة الدقيقة للمشاهدة الواحدة التي تذهب للمستخدم
  totalViewsRequired: { type: Number, default: 0 }, // عدد المشاهدات الكلي المطلوبة (الميزانية ÷ 0.001)
  viewsCount: { type: Number, default: 0 },          // عدد المشاهدات الحالية التي حصل عليها الإعلان فعلياً
  isActive: { type: Boolean, default: false },      // لا يظهر للعملاء إلا بعد أن يوافق الآدمين ويثبت الدفع اليدوي
  advertiserId: { type: String, required: true },   // آيدي العميل (المعلن) الذي أنشأ الحملة
  createdAt: { type: Date, default: Date.now }
});

// سجل المشاهدات لمنع المستخدم من مشاهدة نفس الإعلان مرتين والتلاعب
const AdLogSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, index: true },
  adId: { type: mongoose.Schema.Types.ObjectId, required: true },
  viewedAt: { type: Date, default: Date.now }
});

// --- ٣. مخطط المعاملات والطلبات اليدوية ---
const TransactionRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'custom_plan', 'ad_campaign'], required: true },
  amount: { type: Number, required: true },
  txHash: { type: String, default: '' }, 
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, 
  details: { type: String, default: '' }, // يحمل رابط الإعلان أو تفاصيل الخطة المخصصة
  createdAt: { type: Date, default: Date.now }
});

// تعيين الموديلات
const User = mongoose.model('User', UserSchema);
const Ad = mongoose.model('Ad', AdSchema);
const AdLog = mongoose.model('AdLog', AdLogSchema);
const TransactionRequest = mongoose.model('TransactionRequest', TransactionRequestSchema);

module.exports = { User, Ad, AdLog, TransactionRequest };
