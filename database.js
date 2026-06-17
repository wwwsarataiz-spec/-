const mongoose = require('mongoose');

// إعداد الاتصال مع ضمان استقرار الرابط
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح وبأعلى معايير الأمان'))
.catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// --- ١. مخطط المستخدمين المطور (شامل حماية الكازينو والمحاولات المجانية) ---
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

  // الإضافات السابقة (التعدين والإعلانات)
  usdBalance: { type: Number, default: 0.000 },
  miningEnergy: { type: Number, default: 1000 },
  lastMiningClick: { type: Date, default: Date.now },
  vipPlanLevel: { type: Number, default: 1 },
  customMiningInvestment: { type: Number, default: 0 },
  role: { type: String, default: 'user' },

  // 🔥 إضافات الكازينو الجديدة والأمان ضد الحسابات المتعددة 🔥
  freeCasinoSpins: { type: Number, default: 2 }, // محاولتين مجانيتين لكل حساب جديد
  totalCasinoPlayed: { type: Number, default: 0 }, // عدد المرات الإجمالية للتدقيق
  lastCasinoPlay: { type: Date, default: null } // لمنع السبام والنقرات السريعة جداً
});

// --- ٢. مخطط نظام الإعلانات الحقيقي والمدفوع ---
const AdSchema = new mongoose.Schema({
  title: { type: String, default: 'إعلان حقيقي ممول' },
  link: { type: String, required: true },
  totalBudget: { type: Number, required: true },
  remainingBudget: { type: Number, required: true },
  costPerView: { type: Number, default: 0.001 },
  totalViewsRequired: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: false },
  advertiserId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const AdLogSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, index: true },
  adId: { type: mongoose.Schema.Types.ObjectId, required: true },
  viewedAt: { type: Date, default: Date.now }
});

// --- ٣. مخطط ألعاب الكازينو المنفصلة (لإدارة إعدادات وخوارزمية كل لعبة على حدة) ---
const CasinoGameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true }, // مثل: 'wheel', 'slots', 'dice'
  gameName: { type: String, required: true }, // اسم اللعبة بالعربي للواجهة
  minBet: { type: Number, default: 0.1 }, // الحد الأدنى للرهان بالدولار
  maxBet: { type: Number, default: 100 }, // الحد الأقصى للرهان
  isActive: { type: Boolean, default: true },
  
  // إعدادات الخوارزمية الحاكمة (تتحكم بها أنت كمسؤول لصالح السيرفر)
  houseEdgeSettings: {
    lowRiskWinChance: { type: Number, default: 45 },    // نسبة ربح اللاعب في المخاطرة المنخفضة (أقل من 50%)
    mediumRiskWinChance: { type: Number, default: 35 }, // نسبة ربح اللاعب في المخاطرة المتوسطة
    highRiskWinChance: { type: Number, default: 15 }    // نسبة ربح اللاعب في المخاطرة العالية (صعبة جداً)
  }
});

// --- ٤. مخطط المعاملات والطلبات اليدوية ---
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

// تعيين الموديلات وتجهيزها للاستخدام
const User = mongoose.model('User', UserSchema);
const Ad = mongoose.model('Ad', AdSchema);
const AdLog = mongoose.model('AdLog', AdLogSchema);
const CasinoGame = mongoose.model('CasinoGame', CasinoGameSchema);
const TransactionRequest = mongoose.model('TransactionRequest', TransactionRequestSchema);

module.exports = { User, Ad, AdLog, CasinoGame, TransactionRequest };
