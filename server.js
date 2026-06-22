const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 1. الاتصال الآمن والمستقر بقاعدة البيانات
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
    .then(() => console.log('Connected to MongoDB Atlas Successfully! ✅'))
    .catch(err => console.error('Database connection error ❌:', err));

// 2. بناء قواعد البيانات (Schemas) للمستخدمين والعمليات
const userSchema = new mongoose.Schema({
    fullName: String,
    email: { type: String, unique: true },
    phone: String,
    password: String,
    balance: { type: Number, default: 0.00 },
    miningSpeed: { type: Number, default: 1.00 }
});
const User = mongoose.model('User', userSchema);

// 3. مسارات الاستجابة وتوجيه المستخدمين (Routes)
app.post('/api/auth/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json({ success: true, message: "تم تسجيل الحساب بنجاح!" });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة!" });
    }
});

// تشغيل خادم الويب
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT} 🚀`);
});
