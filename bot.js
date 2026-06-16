const { Telegraf, Markup } = require('telegraf');
const { User } = require('./database');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = "7018561132";

// 0. تسجيل المستخدم تلقائياً
bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.id) {
        let user = await User.findOne({ telegramId: ctx.chat.id.toString() });
        if (!user) {
            await User.create({ telegramId: ctx.chat.id.toString(), points: 0, miningLevel: 1 });
        }
    }
    return next();
});

// 1. أمر البداية
bot.start((ctx) => {
    ctx.reply('مرحباً بك في "نكسورا"! ⛏️\nاستخدم /app لفتح التطبيق.');
});

// 2. أمر فتح تطبيق الويب (تم تحديث الرابط الصحيح هنا)
bot.command('app', (ctx) => {
    ctx.reply('اضغط على الزر أدناه لفتح واجهة "نكسورا":', Markup.inlineKeyboard([
        Markup.button.webApp('فتح تطبيق نكسورا 🚀', 'https://nexora-backend-ko1u.onrender.com/')
    ]));
});

// 3. نظام السحب
bot.command('withdraw', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('استخدم: /withdraw [المحفظة] [المبلغ]');
    const user = await User.findOne({ telegramId: ctx.chat.id.toString() });
    const amount = parseInt(parts[2]);
    if (!user || user.points < 500 || amount > user.points) return ctx.reply('❌ رصيد غير كافٍ.');
    bot.telegram.sendMessage(ADMIN_ID, `💸 طلب سحب جديد!\nالمستخدم: ${ctx.chat.id}\nالمبلغ: ${amount}\nالمحفظة: ${parts[1]}`);
    ctx.reply('✅ تم إرسال طلب السحب للإدارة.');
});

// 4. نظام المكافأة
bot.command('bonus', async (ctx) => {
    const userId = ctx.chat.id.toString();
    const user = await User.findOne({ telegramId: userId });
    const now = new Date();
    if (user.lastBonusDate && (now - user.lastBonusDate) < (24 * 60 * 60 * 1000)) {
        return ctx.reply(`⏳ لقد حصلت على مكافأتك بالفعل.`);
    }
    user.points += 50;
    user.lastBonusDate = now;
    await user.save();
    ctx.reply(`🎉 مبروك! رصيدك الحالي: ${user.points}`);
});

bot.command('stats', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_ID) return;
    const count = await User.countDocuments();
    ctx.reply(`📊 عدد المستخدمين: ${count}`);
});

module.exports = bot;
