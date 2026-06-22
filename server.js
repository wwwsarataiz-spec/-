const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// الاتصال بقاعدة البيانات
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
    .then(() => console.log('Connected to MongoDB Atlas Successfully! ✅'))
    .catch(err => console.error('Database connection error ❌:', err));

// هيكل بيانات المستخدمين
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0.000660 },
    miningSpeed: { type: Number, default: 1.00 }
});
const User = mongoose.model('User', userSchema);

// ===== التعديل هنا: كل المسارات تذهب إلى index.html =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// ===== انتهى التعديل =====

// خدمة ملفات التنسيق والصور
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// واجهات الـ API (لم نلمسها)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ success: false, message: "المستخدم مسجل بالفعل!" });
        
        const newUser = new User({ fullName, email, phone, password });
        await newUser.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة!" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nexora Core Online on port ${PORT} 🚀`));
