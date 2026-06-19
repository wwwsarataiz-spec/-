const mongoose = require('mongoose');

// ==========================================
// الاتصال بقاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
.catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// ==========================================
// 1. مخطط المستخدمين (User)
// ==========================================
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, default: '', index: true },
  fullName: { type: String, default: 'مستخدم جديد' },
  phoneNumber: { type: String, default: 'غير محدد' },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  usdBalance: { type: Number, default: 0.000 },
  casinoBalance: { type: Number, default: 0.000 },
  giftPoints: { type: Number, default: 0 },           // ⭐ جديد: نقاط الهدايا (غير قابلة للسحب)
  points: { type: Number, default: 0 },
  miningEnergy: { type: Number, default: 1000 },
  miningLevel: { type: Number, default: 1 },
  vipPlanLevel: { type: Number, default: 1 },
  customMiningInvestment: { type: Number, default: 0 },
  lastMiningClick: { type: Date, default: Date.now },
  watchedAdsCount: { type: Number, default: 0 },
  lastAdTime: { type: Number, default: 0 },
  freeCasinoSpins: { type: Number, default: 2 },
  totalCasinoPlayed: { type: Number, default: 0 },
  lastCasinoPlay: { type: Date, default: null },
  referredBy: { type: String, default: null },
  walletAddress: { type: String, default: '' },
  pendingWithdrawals: { type: Number, default: 0 },
  role: { type: String, default: 'user' },
  verified: { type: Boolean, default: false },
  verificationCode: { type: String, default: '' },
  codeExpiry: { type: Date, default: null },
  language: { type: String, default: 'ar' },
  tokenRequests: { type: Array, default: [] },
  lastDailyClaimDate: { type: Date, default: null },
  withdrawalCount: { type: Number, default: 0 },      // ⭐ جديد: عدد مرات السحب هذا الأسبوع
  lastWithdrawalWeek: { type: Number, default: 0 },   // ⭐ جديد: أسبوع آخر سحب
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ==========================================
// 2. مخطط الإعلانات (Ad)
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
// 4. مخطط ألعاب الكازينو (CasinoGame)
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
// 5. مخطط طلبات المعاملات (TransactionRequest)
// ==========================================
const TransactionRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'custom_plan', 'ad_campaign', 'casino_bet'], required: true },
  amount: { type: Number, required: true },
  txHash: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  details: { type: String, default: '' },
  processedBy: { type: String, default: '' },
  processedAt: { type: Date, default: null },
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
// 6. مخطط المعاملات المالية (Transaction)
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
// 7. مخطط الإحصائيات (Stats)
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
// 8. مخطط سجل الإدارة (AdminLog) — إصلاح: لم يعد مكرراً
// ==========================================
const AdminLogSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  action: { type: String, required: true },
  targetId: { type: String, default: '' },
  details: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

// ==========================================
// 9. مخطط خطط التعدين (MiningPlan)
// ==========================================
const MiningPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  dailyReturn: { type: Number, required: true },
  duration: { type: Number, default: 30 },
  level: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// 10. ⭐ جديد: مخطط خطط المستخدم (UserMiningPlan)
// لتتبع اشتراكات المستخدمين في خطط التعدين
// ==========================================
const UserMiningPlanSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  planId: { type: String, required: true },
  planName: { type: String, required: true },
  price: { type: Number, required: true },
  dailyReturn: { type: Number, required: true },
  duration: { type: Number, default: 30 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  lastCollected: { type: Date, default: null },
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
const UserMiningPlan = mongoose.model('UserMiningPlan', UserMiningPlanSchema); // ⭐ جديد

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
    MiningPlan,
    UserMiningPlan  // ⭐ جديد
};
