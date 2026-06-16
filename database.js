const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
  miningLevel: { type: Number, default: 1 },
  referredBy: String
});

const User = mongoose.model('User', UserSchema);
module.exports = { mongoose, User };
