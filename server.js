const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// الاتصال بقاعدة البيانات
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

// التوجيهات الأساسية للملفات المدمجة
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// نظام التوثيق والتسجيل الفعلي
app.post('/api/auth/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) res.json({ success: true, user });
    else res.status(401).json({ success: false, message: "البيانات غير صحيحة" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nexora Core Online on port ${PORT} 🚀`));
