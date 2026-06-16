const mongoose = require('mongoose');

// تعريف هيكل المستخدم الموحد للمشروع
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
  miningLevel: { type: Number, default: 1 },
  referredBy: String
});

const User = mongoose.model('User', UserSchema);

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

module.exports = { User };
