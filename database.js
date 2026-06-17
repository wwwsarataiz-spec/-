const mongoose = require('mongoose');

// إعداد الاتصال مع ضمان استقرار الرابط
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح وبأعلى معايير الأمان'))
.catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// --- ١. مخطط المستخدمين المطور والمحمي الشامل ---
const UserSchema = new mongoose.Schema({
  // الحقول القديمة (تم الحفاظ عليها بالكامل لضمان عدم فقدان أي بيانات مسجلة)
  telegramId: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, default: 'مستخدم جديد' },
  phoneNumber: { type: String, default: 'غير محدد' },
  points: { type: Number, default: 0 },
  miningLevel: { type: Number, default: 1 },
  referredBy: { type: String, default: null },
  lastBonusDate: { type: Date, default: null },
  walletAddress: { type: String, default: '' },
  pendingWithdrawals: { type: Number, default: 0 },

  // الإضافات الجديدة لتغطية التحديثات (الرصيد بالدولار، الطاقة، والخطط الاستثمارية)
  usdBalance: { type: Number, default: 0.00 }, // الرصيد الفعلي بالدولار لتفادي التلاعب محلياً
  miningEnergy: { type: Number, default: 1000 }, // عداد الطاقة المحمي بالسيرفر (1000/1000)
  lastMiningClick: { type: Date, default: Date.now }, // لحساب وتدقيق سرعة النقر ومنع الـ Auto-Clicker
  vipPlanLevel: { type: Number, default: 1 }, // مستوى الخطة الاستثمارية (تبدأ من VIP 1 المجاني)
  customMiningInvestment: { type: Number, default: 0 }, // قيمة الخطة المخصصة التي يطلبها العميل بنفسه
  role: { type: String, default: 'user' } // لتحديد الصلاحيات (user أو admin للوحة الإدارة الذاتية)
});

// --- ٢. مخطط نظام الإعلانات الشامل (مشاهدة وإعلان) ---
const AdSchema = new mongoose.Schema({
  title: { type: String, default: 'إعلان ممول' },
  link: { type: String, required: true }, // رابط القناة أو البوت المعلن عنه
  budget: { type: Number, default: 0 }, // الميزانية الإجمالية المدفوعة للحملة
  costPerView: { type: Number, default: 0.10 }, // تكلفة المشاهدة الواحدة التي تذهب للمستخدم
  isActive: { type: Boolean, default: false }, // لا يظهر الإعلان إلا بعد موافقة الإدارة (حماية وتدقيق يدوي)
  advertiserId: { type: String }, // آيدي الشخص الذي قام بطلب الإعلان
  createdAt: { type: Date, default: Date.now }
});

const AdLogSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, index: true },
  adId: { type: mongoose.Schema.Types.ObjectId, required: true },
  viewedAt: { type: Date, default: Date.now }
});

// --- ٣. إضافة مخطط لعمليات التحقق اليدوية (الشحن والسحب والخطط) ---
// هذا القسم يمنع اختراق الرصيد ويجعل لوحة الإدارة الذاتية تعرض لك طلبات التحويل لاعتمادها أو رفضها
const TransactionRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'custom_plan', 'ad_campaign'], required: true },
  amount: { type: Number, required: true },
  txHash: { type: String, default: '' }, // هاش التحويل لإثبات الدفع اليدوي
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, // حالة الطلب
  details: { type: String, default: '' }, // تفاصيل إضافية (مثل رابط الإعلان المطلوب رشه)
  createdAt: { type: Date, default: Date.now }
});

// تعيين الموديلات
const User = mongoose.model('User', UserSchema);
const Ad = mongoose.model('Ad', AdSchema);
const AdLog = mongoose.model('AdLog', AdLogSchema);
const TransactionRequest = mongoose.model('TransactionRequest', TransactionRequestSchema);

// تصدير الموديلات بأمان جاهزة للربط مع الـ Endpoints
module.exports = { User, Ad, AdLog, TransactionRequest };
