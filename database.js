const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ DB Connected'))
  .catch(err => console.error('❌ DB Error:', err));

// 1. هيكل المستخدم (تم تحديثه)
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
  walletAddress: String
});

// 2. هيكل الإعلانات (للمعلنين)
const AdSchema = new mongoose.Schema({
  title: String,
  link: String,
  budget: Number,       // الميزانية الإجمالية للحملة
  costPerView: Number,  // تكلفة المشاهدة الواحدة
  isActive: { type: Boolean, default: true }
});

// 3. سجل المشاهدات (لمنع الغش - حماية 24 ساعة)
const AdLogSchema = new mongoose.Schema({
  telegramId: String,
  adId: mongoose.Schema.Types.ObjectId,
  viewedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Ad = mongoose.model('Ad', AdSchema);
const AdLog = mongoose.model('AdLog', AdLogSchema);

module.exports = { User, Ad, AdLog };
