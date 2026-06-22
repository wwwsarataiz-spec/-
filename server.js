const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// الاتصال بقاعدة بيانات MongoDB Atlas
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
    .then(() => console.log('Connected to MongoDB Atlas Successfully! ✅'))
    .catch(err => console.error('Database connection error ❌:', err));

// نموذج بيانات المستخدمين
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0.000660 },
    miningSpeed: { type: Number, default: 1.00 }
});
const User = mongoose.model('User', userSchema);

// التوجيهات الأساسية للملفات
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// مسار تسجيل حساب جديد وتخزينه في المونجو
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني مسجل بالفعل" });
        }
        const newUser = new User({ fullName, email, phone, password });
        await newUser.save();
        res.status(201).json({ success: true, message: "تم التسجيل بنجاح" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// مسار تسجيل الدخول والتحقق الفعلي
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nexora Core Online on port ${PORT} 🚀`));
