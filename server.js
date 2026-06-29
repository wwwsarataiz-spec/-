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

// ===== خدمة الملفات الثابتة =====
// نخدم جميع الملفات في نفس المجلد (index.html, app.js, إلخ)
app.use(express.static(path.join(__dirname)));

// ===== قاعدة بيانات مؤقتة (في الذاكرة) =====
const users = [];       // كل مستخدم: { id, name, phone, email, password, balance }
let nextId = 1;

// مفتاح سري لتوقيع JWT (في الإنتاج يُفضل وضعه في متغير بيئة)
const JWT_SECRET = 'nexora_super_secret_key_2026';

// ===== دوال مساعدة =====
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ===== API Endpoints =====

// تسجيل حساب جديد
app.post('/api/register', (req, res) => {
  const { name, phone, email, password } = req.body;

  // تحقق من وجود جميع الحقول
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  }

  // تحقق من عدم تكرار البريد
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
  }

  // إنشاء مستخدم جديد
  const newUser = {
    id: nextId++,
    name,
    phone,
    email,
    password,   // في الإنتاج يجب تشفيرها (bcrypt)
    balance: 0  // رصيد ابتدائي
  };
  users.push(newUser);

  // إنشاء توكن للمستخدم الجديد (تسجيل دخول تلقائي)
  const token = generateToken(newUser);

  res.status(201).json({
    message: 'تم إنشاء الحساب بنجاح',
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      balance: newUser.balance
    }
  });
});

// تسجيل الدخول
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
      balance: user.balance
    }
  });
});

// (اختياري) الحصول على بيانات المستخدم عبر التوكن (محمي)
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
      balance: user.balance
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

// ===== توجيه الرابط الرئيسي لفتح ملف index.html =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== تشغيل السيرفر =====
app.listen(PORT, () => {
  console.log(`🚀 Nexora server running on port ${PORT}`);
});
