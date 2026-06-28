require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// 1. الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB'))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// 2. تعريف خطط التعدين (مجاني ومدفوع)
const MINING_PLANS = {
    free: { name: "مجاني", rate: 1, cost: 0 },
    starter: { name: "مبتدئ", rate: 5, cost: 50 },
    pro: { name: "محترف", rate: 15, cost: 200 }
};

// 3. نموذج المستخدم في قاعدة البيانات
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
  miningPlan: { type: String, default: 'free' },
  planExpiresAt: Date,
  lastMiningCheck: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// 4. تسجيل الدخول (إنشاء حساب أو تسجيل الدخول)
app.post('/login', async (req, res) => {
  const { name, email } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ name, email });
      await user.save();
    }
    res.json({ success: true, user: { name: user.name, points: user.points, plan: user.miningPlan } });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في تسجيل الدخول' });
  }
});

// 5. عملية التعدين (جمع النقاط)
app.post('/mine', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const now = new Date();
    let rate = MINING_PLANS.free.rate;

    // التحقق من صلاحية الخطة المدفوعة
    if (user.miningPlan !== 'free' && user.planExpiresAt && user.planExpiresAt > now) {
        rate = MINING_PLANS[user.miningPlan].rate;
    } else {
        user.miningPlan = 'free'; // تنتهي الخطة تعود مجانية
        user.planExpiresAt = null;
    }

    // حساب الوقت المنقضي منذ آخر تعدين
    const timeDiffMinutes = (now - user.lastMiningCheck) / 1000 / 60;
    const pointsToAdd = Math.floor(timeDiffMinutes * rate);

    if (pointsToAdd > 0) {
        user.points += pointsToAdd;
        user.lastMiningCheck = now;
        await user.save();
    }

    res.json({ success: true, minedPoints: pointsToAdd, totalPoints: user.points, plan: user.miningPlan });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في التعدين' });
  }
});

// 6. شراء خطط التعدين المدفوعة
app.post('/buy-plan', async (req, res) => {
  const { email, planKey } = req.body;
  const plan = MINING_PLANS[planKey];
  if (!plan || plan.cost === 0) return res.status(400).json({ error: 'خطة غير صالحة' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    
    if (user.points < plan.cost) {
      return res.status(400).json({ error: 'رصيدك لا يكفي لشراء هذه الخطة' });
    }

    // خصم النقاط وتفعيل الخطة (صلاحية الخطة: 7 أيام)
    user.points -= plan.cost;
    user.miningPlan = planKey;
    user.planExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.lastMiningCheck = new Date();
    await user.save();

    res.json({ success: true, message: `تم تفعيل خطة ${plan.name} لمدة 7 أيام!`, user });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في الشراء' });
  }
});

// 7. متجر بيع النقاط (بدلاً من P2P - كما في سنتات)
// ملاحظة: هنا سنقوم بمحاكاة عملية شراء ناجحة، لأن الدفع الحقيقي يتطلب ربط Stripe أو Telegram Stars.
app.post('/buy-points', async (req, res) => {
  const { email, packageId } = req.body;
  // تعريف باقات النقاط
  const packages = {
    '100p': { points: 100, price: 5 }, // 5 دولار / 5 نجوم تليجرام
    '500p': { points: 500, price: 20 },
    '1000p': { points: 1000, price: 35 }
  };

  const pkg = packages[packageId];
  if (!pkg) return res.status(400).json({ error: 'الباقة غير موجودة' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    // ------------------------------------------------------------------
    // هذا هو المكان الذي تضع فيه كود بوابة الدفع (Telegram Stars / Stripe)
    // إذا نجحت عملية الدفع، يُنفذ السطر التالي:
    // ------------------------------------------------------------------
    user.points += pkg.points;
    await user.save();

    res.json({ success: true, message: `تم شراء ${pkg.points} نقطة بنجاح!`, totalPoints: user.points });
  } catch (error) {
    res.status(500).json({ error: 'فشل عملية الشراء' });
  }
});

// 8. لعبة الكازينو (Slot Machine)
app.post('/casino-spin', async (req, res) => {
  const { email, bet } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (user.points < bet) return res.status(400).json({ error: 'رصيدك لا يكفي لهذا الرهان' });

    // خصم الرهان
    user.points -= bet;

    // محاكاة دوران العجلة (أرقام عشوائية)
    const symbols = ['🍒', '🍋', '🍊', '🍉', '🍇', '⭐', '💎'];
    const result = [
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ];

    let winAmount = 0;
    // منطق الربح (تطابق 3 أو 2 رموز)
    if (result[0] === result[1] && result[1] === result[2]) winAmount = bet * 10;
    else if (result[0] === result[1] || result[1] === result[2]) winAmount = bet * 2;

    if (winAmount > 0) user.points += winAmount;
    await user.save();

    res.json({ success: true, symbols: result, winAmount, totalPoints: user.points });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في اللعبة' });
  }
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`));
