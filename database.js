const mongoose = require('mongoose');

// إعداد الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
.catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// ==========================================
// 1. مخطط المستخدمين (User) - الأكثر شمولاً
// ==========================================
const UserSchema = new mongoose.Schema({
  // الحقول الأساسية للتواصل
  telegramId: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, default: 'مستخدم جديد' },
  phoneNumber: { type: String, default: 'غير محدد' },
  email: { type: String, default: '' },
  password: { type: String, default: '' },
  
  // الحقول المالية
  usdBalance: { type: Number, default: 0.000 },
  casinoBalance: { type: Number, default: 0.000 },
  points: { type: Number, default: 0 },
  
  // التعدين والطاقة
  miningEnergy: { type: Number, default: 1000 },
  miningLevel: { type: Number, default: 1 },
  vipPlanLevel: { type: Number, default: 1 },
  customMiningInvestment: { type: Number, default: 0 },
  lastMiningClick: { type: Date, default: Date.now },
  
  // الإعلانات
  watchedAdsCount: { type: Number, default: 0 },
  lastAdTime: { type: Number, default: 0 },
  
  // الكازينو
  freeCasinoSpins: { type: Number, default: 2 },
  totalCasinoPlayed: { type: Number, default: 0 },
  lastCasinoPlay: { type: Date, default: null },
  
  // الإحالات
  referredBy: { type: String, default: null },
  walletAddress: { type: String, default: '' },
  pendingWithdrawals: { type: Number, default: 0 },
  
  // الصلاحيات والأمان
  role: { type: String, default: 'user' }, // user, admin, manager, assistant
  verified: { type: Boolean, default: false },
  verificationCode: { type: String, default: '' },
  codeExpiry: { type: Date, default: null },
  
  // الإعدادات الشخصية
  language: { type: String, default: 'ar' },
  
  // طلبات العملات المفتوحة
  tokenRequests: { type: Array, default: [] },
  
  // المكافآت اليومية
  lastDailyClaimDate: { type: Date, default: null },
  
  // تاريخ الإنشاء والتحديث
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ==========================================
// 2. مخطط الإعلانات (Ad) - المدفوعة فقط
// ==========================================
const AdSchema = new mongoose.Schema({
  title: { type: String, default: 'إعلان حقيقي ممول' },
  link: { type: String, required: true },
  totalBudget: { type: Number, required: true },
  remainingBudget: { type: Number, required: true },
  costPerView: { type: Number, default: 0.005 },
  totalViewsRequired: { type: Number, default: 1000 },
  viewsCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: false },
  advertiserId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// 3. مخطط سجل مشاهدة الإعلانات (AdLog)
// ==========================================
const AdLogSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, index: true },
  adId: { type: mongoose.Schema.Types.ObjectId, required: true },
  viewedAt: { type: Date, default: Date.now }
});

// ==========================================
// 4. مخطط ألعاب الكازينو (CasinoGame) - للإدارة
// ==========================================
const CasinoGameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  gameName: { type: String, required: true },
  minBet: { type: Number, default: 0.1 },
  maxBet: { type: Number, default: 100 },
  isActive: { type: Boolean, default: true },
  houseEdgeSettings: {
    lowRiskWinChance: { type: Number, default: 45 },
    mediumRiskWinChance: { type: Number, default: 35 },
    highRiskWinChance: { type: Number, default: 15 }
  }
});

// ==========================================
// 5. مخطط طلبات المعاملات (TransactionRequest) - المعلقة
// ==========================================
const TransactionRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'custom_plan', 'ad_campaign', 'casino_bet'], required: true },
  amount: { type: Number, required: true },
  txHash: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  details: { type: String, default: '' },
  adminDepositWallets: {
    type: Object,
    default: {
      USDT: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46",
      SOL: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46",
      BNB: "0x2975dc1f8188c30b2a4be0ec27e33494da66cb46"
    }
  },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// 6. مخطط المعاملات المالية (Transaction) - النهائية
// ==========================================
const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  txHash: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// 7. مخطط الإحصائيات (Stats) - للتحديث التلقائي
// ==========================================
const StatsSchema = new mongoose.Schema({
  totalUsers: { type: Number, default: 0 },
  totalDeposits: { type: Number, default: 0 },
  totalWithdrawals: { type: Number, default: 0 },
  totalDepositsAmount: { type: Number, default: 0 },
  totalWithdrawalsAmount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

// ==========================================
// 8. مخطط سجل الإدارة (AdminLog) - للمتابعة
// ==========================================
const AdminLogSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  action: { type: String, required: true },
  targetId: { type: String, default: '' },
  details: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

// ==========================================
// 9. مخطط خطط التعدين (MiningPlan) - متعددة
// ==========================================
const MiningPlanSchema = new mongoose.Schema({
  name: { type: String, required: true }, // برونزي، فضي، ذهبي، ماسي
  price: { type: Number, required: true },
  dailyReturn: { type: Number, required: true }, // النسبة المئوية
  minDays: { type: Number, default: 7 },
  maxDays: { type: Number, default: 30 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// إنشاء الموديلات
// ==========================================
const User = mongoose.model('User', UserSchema);
const Ad = mongoose.model('Ad', AdSchema);
const AdLog = mongoose.model('AdLog', AdLogSchema);
const CasinoGame = mongoose.model('CasinoGame', CasinoGameSchema);
const TransactionRequest = mongoose.model('TransactionRequest', TransactionRequestSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Stats = mongoose.model('Stats', StatsSchema);
const AdminLog = mongoose.model('AdminLog', AdminLogSchema);
const MiningPlan = mongoose.model('MiningPlan', MiningPlanSchema);

// ==========================================
// تصدير الموديلات
// ==========================================
module.exports = { 
    User, 
    Ad, 
    AdLog, 
    CasinoGame, 
    TransactionRequest,
    Transaction,
    Stats,
    AdminLog,
    MiningPlan
};
