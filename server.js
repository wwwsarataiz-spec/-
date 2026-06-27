const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(express.json());

// الاتصال بقاعدة بيانات Supabase / MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexora')
    .then(() => console.log('✅ Supabase/MongoDB Connected'))
    .catch(err => console.error('❌ Database Connection Error:', err));

// --- Schema & Models ---
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    balance: { type: Number, default: 0 },
    casinoBalance: { type: Number, default: 0 },
    miningProgress: { type: Number, default: 0 },
    miningClicks: { type: Number, default: 0 },
    freeRounds: { type: Number, default: 3 },
    points: { type: Number, default: 0 },
    isAgent: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// --- Middleware للتحقق من التوكن ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'صلاحية منتهية' });

    jwt.verify(token, process.env.JWT_SECRET || 'NEXORA_SECRET_KEY', (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'توكن غير صالحة' });
        req.user = user;
        next();
    });
};

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, password, phone } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ fullName, email, password: hashedPassword, phone });
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET || 'NEXORA_SECRET_KEY', { expiresIn: '7d' });
        res.json({ success: true, token, user: newUser });
    } catch (err) {
        res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل بالفعل' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ success: false, message: 'بيانات الاعتماد خاطئة' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'NEXORA_SECRET_KEY', { expiresIn: '7d' });
    res.json({ success: true, token, user });
});

app.post('/api/auth/verify-session', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.json({ success: false });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'NEXORA_SECRET_KEY');
        const user = await User.findById(decoded.id);
        if (user) res.json({ success: true, user });
        else res.json({ success: false });
    } catch { res.json({ success: false }); }
});

// --- Mining Routes ---
app.post('/api/mining/click', async (req, res) => {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (user && user.miningClicks < 100) {
        user.miningClicks += 1;
        user.miningProgress += 0.001;
        await user.save();
        return res.json({ success: true, miningClicks: user.miningClicks, miningProgress: user.miningProgress });
    }
    res.json({ success: false, message: 'فشل التعدين' });
});

app.post('/api/mining/harvest', async (req, res) => {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (user && user.miningProgress > 0) {
        const harvested = user.miningProgress;
        user.balance += harvested;
        user.miningProgress = 0;
        await user.save();
        return res.json({ success: true, newBalance: user.balance, harvested });
    }
    res.json({ success: false, message: 'لا يوجد رصيد' });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
