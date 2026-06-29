const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname)));

// ===== قاعدة بيانات مؤقتة =====
const users = [];
let nextId = 1;

const JWT_SECRET = 'nexora_super_secret_key_2026';

// ===== دوال مساعدة =====
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ===== API: تسجيل / دخول (كما هو) =====

app.post('/api/register', (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  }
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
  }
  const newUser = {
    id: nextId++,
    name,
    phone,
    email,
    password,
    balance: 0,
    // حقول التعدين
    miningCounter: 0,          // عدد النقرات الحالي (0-100)
    miningEarnings: 0,         // الأرباح المتراكمة من التعدين
    lastMineTime: null,        // وقت آخر نقرة (بتوقيت UTC)
    miningCooldown: 24 * 60 * 60 * 1000, // 24 ساعة بالمللي
  };
  users.push(newUser);
  const token = generateToken(newUser);
  res.status(201).json({
    message: 'تم إنشاء الحساب بنجاح',
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      balance: newUser.balance,
      miningCounter: newUser.miningCounter,
      miningEarnings: newUser.miningEarnings,
    }
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبان' });
  }
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }
  const token = generateToken(user);
  res.json({
    message: 'تم تسجيل الدخول بنجاح',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      balance: user.balance,
      miningCounter: user.miningCounter,
      miningEarnings: user.miningEarnings,
    }
  });
});

app.get('/api/user', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'غير مصرح' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      balance: user.balance,
      miningCounter: user.miningCounter,
      miningEarnings: user.miningEarnings,
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

// ===== نظام التعدين =====

// نقطة نهاية التعدين (نقرة)
app.post('/api/mine', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'غير مصرح' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const now = Date.now();
    const last = user.lastMineTime || 0;
    const cooldown = user.miningCooldown;

    // إذا مضت 24 ساعة منذ آخر نقرة، نُعيد تعيين العداد والأرباح (بدء دورة جديدة)
    if (last > 0 && (now - last) >= cooldown) {
      user.miningCounter = 0;
      user.miningEarnings = 0;
      user.lastMineTime = null;
    }

    // التحقق من أن العداد لم يصل إلى الحد الأقصى (100)
    if (user.miningCounter >= 100) {
      return res.status(400).json({
        message: 'لقد وصلت إلى الحد الأقصى للتعدين (100 نقرة). قم بالحصاد أولاً.',
        miningCounter: user.miningCounter,
        miningEarnings: user.miningEarnings,
      });
    }

    // زيادة العداد بمقدار 1 وإضافة مكافأة (مثلاً 0.01 وحدة)
    user.miningCounter += 1;
    const reward = 0.01;
    user.miningEarnings = parseFloat((user.miningEarnings + reward).toFixed(4));
    user.lastMineTime = now;

    res.json({
      message: 'تم التعدين بنجاح',
      miningCounter: user.miningCounter,
      miningEarnings: user.miningEarnings,
      balance: user.balance,
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

// نقطة نهاية الحصاد (نقل الأرباح إلى الرصيد)
app.post('/api/harvest', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'غير مصرح' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // لا يمكن الحصاد إذا لم يكن هناك أرباح
    if (user.miningEarnings <= 0) {
      return res.status(400).json({
        message: 'لا توجد أرباح للحصاد. قم بالتعدين أولاً.',
        miningEarnings: user.miningEarnings,
      });
    }

    // إضافة الأرباح إلى الرصيد الرئيسي
    user.balance = parseFloat((user.balance + user.miningEarnings).toFixed(4));
    // إعادة تعيين عداد التعدين والأرباح
    user.miningCounter = 0;
    user.miningEarnings = 0;
    user.lastMineTime = Date.now(); // نبدأ دورة جديدة

    res.json({
      message: 'تم الحصاد بنجاح',
      balance: user.balance,
      miningCounter: user.miningCounter,
      miningEarnings: user.miningEarnings,
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

// ===== الصفحة الرئيسية =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== تشغيل السيرفر =====
app.listen(PORT, () => {
  console.log(`🚀 Nexora server running on port ${PORT}`);
});
