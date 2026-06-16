const mongoose = require('mongoose');

// ربط قاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to Database'))
  .catch(err => console.error('❌ Database Connection Error:', err));

// تعريف مستخدم النظام
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  fullName: String,
  phoneNumber: String,
  balance: { type: Number, default: 0 },
  walletAddress: { type: String, default: "" },
  miningLevel: { type: Number, default: 1 }
});

const User = mongoose.model('User', UserSchema);

module.exports = { User };
