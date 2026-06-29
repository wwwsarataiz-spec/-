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

// ===== API: تسجيل / دخول (محدثة لإرجاع بيانات المحفظة) =====

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
    casinoBalance: 0,        // رصيد الكازينو
    miningCounter: 0,
    miningEarnings: 0,
    lastMineTime: null,
    miningCooldown: 24 * 60 * 60 * 1000,
    transactions: [],        // مصفوفة المعاملات { type, amount, status, timestamp, details? }
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
      casinoBalance: newUser.casinoBalance,
      miningCounter: newUser.miningCounter,
      miningEarnings: newUser.miningEarnings,
      transactions: newUser.transactions,
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
      casinoBalance: user.casinoBalance,
      miningCounter: user.miningCounter,
      miningEarnings: user.miningEarnings,
      transactions: user.transactions,
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
      casinoBalance: user.casinoBalance,
      miningCounter: user.miningCounter,
      miningEarnings: user.miningEarnings,
      transactions: user.transactions,
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

// ===== نظام التعدين (نفس الكود السابق) =====

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

    if (last > 0 && (now - last) >= cooldown) {
      user.miningCounter = 0;
      user.miningEarnings = 0;
      user.lastMineTime = null;
    }

    if (user.miningCounter >= 100) {
      return res.status(400).json({
        message: 'لقد وصلت إلى الحد الأقصى للتعدين (100 نقرة). قم بالحصاد أولاً.',
        miningCounter: user.miningCounter,
        miningEarnings: user.miningEarnings,
      });
    }

    user.miningCounter += 1;
    const reward = 0.01;
    user.miningEarnings = parseFloat((user.miningEarnings + reward).toFixed(4));
    user.lastMineTime = now;

    res.json({
      message: 'تم التعدين بنجاح',
      miningCounter: user.miningCounter,
      miningEarnings: user.miningEarnings,
      balance: user.balance,
      casinoBalance: user.casinoBalance,
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

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

    if (user.miningEarnings <= 0) {
      return res.status(400).json({
        message: 'لا توجد أرباح للحصاد. قم بالتعدين أولاً.',
        miningEarnings: user.miningEarnings,
      });
    }

    user.balance = parseFloat((user.balance + user.miningEarnings).toFixed(4));
    // تسجيل معاملة حصاد
    user.transactions.push({
      type: 'harvest',
      amount: user.miningEarnings,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
    user.miningCounter = 0;
    user.miningEarnings = 0;
    user.lastMineTime = Date.now();

    res.json({
      message: 'تم الحصاد بنجاح',
      balance: user.balance,
      casinoBalance: user.casinoBalance,
      miningCounter: user.miningCounter,
      miningEarnings: user.miningEarnings,
      transactions: user.transactions,
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

// ===== نظام المحفظة والتحويلات =====

// 1. التحويل إلى الكازينو
app.post('/api/wallet/transfer-to-casino', async (req, res) => {
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

    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'المبلغ غير صحيح' });
    }
    if (amount > user.balance) {
      return res.status(400).json({ message: 'رصيد غير كافٍ' });
    }

    // خصم من الرصيد الرئيسي وإضافة إلى رصيد الكازينو
    user.balance = parseFloat((user.balance - amount).toFixed(4));
    user.casinoBalance = parseFloat((user.casinoBalance + amount).toFixed(4));

    // تسجيل المعاملة
    user.transactions.push({
      type: 'transfer_to_casino',
      amount: amount,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: 'تم التحويل إلى الكازينو بنجاح',
      balance: user.balance,
      casinoBalance: user.casinoBalance,
      transactions: user.transactions,
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

// 2. طلب السحب (الحد الأدنى 4 USDT)
app.post('/api/wallet/withdraw', async (req, res) => {
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

    const { walletAddress, amount } = req.body;
    if (!walletAddress || walletAddress.trim() === '') {
      return res.status(400).json({ message: 'عنوان المحفظة مطلوب' });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'المبلغ غير صحيح' });
    }
    if (amount < 4) {
      return res.status(400).json({ message: 'الحد الأدنى للسحب هو 4 USDT' });
    }
    if (amount > user.balance) {
      return res.status(400).json({ message: 'رصيد غير كافٍ' });
    }

    // خصم المبلغ من الرصيد
    user.balance = parseFloat((user.balance - amount).toFixed(4));

    // تسجيل معاملة بسحب بحالة "قيد الانتظار"
    user.transactions.push({
      type: 'withdraw',
      amount: amount,
      walletAddress: walletAddress.trim(),
      status: 'pending',
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: 'تم تقديم طلب السحب بنجاح، وهو قيد المعالجة',
      balance: user.balance,
      casinoBalance: user.casinoBalance,
      transactions: user.transactions,
    });
  } catch (err) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
});

// 3. جلب قائمة المعاملات (آخر 10 مثلاً)
app.get('/api/wallet/transactions', async (req, res) => {
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
    // نرجع آخر 10 معاملات (أحدثها أولاً)
    const transactions = user.transactions.slice(-10).reverse();
    res.json({ transactions });
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
