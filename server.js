const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = "7018561132";

mongoose.connect(MONGO_URI).catch(err => console.error(err));

const User = mongoose.model('User', new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
  miningLevel: { type: Number, default: 1 },
  referredBy: String
}));

// --- API ---
app.post('/api/status', async (req, res) => {
    const { telegramId } = req.body;
    let user = await User.findOne({ telegramId });
    res.json(user ? { success: true, points: user.points.toFixed(2), miningLevel: user.miningLevel } : { success: false });
});

// مسار المتجر الجديد
app.post('/api/shop', async (req, res) => {
    const { telegramId, item } = req.body;
    let user = await User.findOne({ telegramId });
    if (!user) return res.json({ success: false });

    const prices = { 'level2': 200, 'level3': 500 };
    const targetLevel = item === 'level2' ? 2 : 3;

    if (user.miningLevel >= targetLevel) return res.json({ success: false, message: 'لديك هذا المستوى بالفعل!' });
    if (user.points < prices[item]) return res.json({ success: false, message: 'نقاط غير كافية!' });
    
    user.points -= prices[item];
    user.miningLevel = targetLevel;
    await user.save();
    res.json({ success: true, message: '✅ تم شراء الترقية بنجاح!' });
});

// --- أوامر البوت ---
const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
    const referrerId = ctx.payload;
    const userId = ctx.chat.id.toString();

    let user = await User.findOne({ telegramId: userId });
    if (!user) {
        user = await User.create({ telegramId: userId, referredBy: referrerId });
        if (referrerId) {
            await User.findOneAndUpdate({ telegramId: referrerId }, { $inc: { points: 10 } });
            bot.telegram.sendMessage(referrerId, '🎉 انضم صديق جديد عبر رابطك! حصلت على 10 نقاط.');
        }
    }

    ctx.reply('مرحباً في نكسورا! استخدم الأزرار:', 
    Markup.keyboard([
        ['⛏️ ابدأ التعدين', '💰 مكافأة يومية'], 
        ['🏆 لوحة الصدارة', '👤 حسابي'],
        ['📥 إيداع', '💸 سحب الأرباح']
    ]).resize());
});

// نظام السحب المحمي
bot.command('withdraw', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('الرجاء استخدام الصيغة: /withdraw [المحفظة] [المبلغ]');
    
    const user = await User.findOne({ telegramId: ctx.chat.id.toString() });
    if (user.points < 500) return ctx.reply('❌ الحد الأدنى للسحب هو 500 نقطة.');
    
    const [wallet, amount] = [parts[1], parts[2]];
    bot.telegram.sendMessage(ADMIN_ID, `💸 طلب سحب!\nالمستخدم: ${ctx.chat.id}\nالرصيد: ${user.points}\nالمحفظة: ${wallet}\nالمبلغ: ${amount}`, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ تم التحويل', `pay_${ctx.chat.id}_${amount}`), Markup.button.callback('❌ رفض', `cancel_${ctx.chat.id}`)]
        ])
    });
    ctx.reply('تم إرسال طلب السحب للإدارة للمراجعة.');
});

// معالجة القبول والرفض
bot.action(/pay_(.+)_(.+)/, async (ctx) => {
    const [userId, amount] = ctx.match.slice(1);
    await User.findOneAndUpdate({ telegramId: userId }, { $inc: { points: -amount } });
    ctx.editMessageText('✅ تمت معالجة السحب.');
});

bot.action(/cancel_(.+)/, (ctx) => ctx.editMessageText('❌ تم رفض السحب.'));

bot.launch();
app.listen(PORT, () => console.log(`الخادم يعمل...`));
