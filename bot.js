const { Telegraf, Markup } = require('telegraf');
const { User } = require('./database');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = "7018561132";

// 0. تسجيل المستخدم تلقائياً عند أي تفاعل
bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.id) {
        let user = await User.findOne({ telegramId: ctx.chat.id.toString() });
        if (!user) {
            await User.create({ telegramId: ctx.chat.id.toString(), points: 0, miningLevel: 1 });
            console.log(`[NEW USER] مستخدم جديد سجل في البوت: ${ctx.chat.id}`);
        }
    }
    return next();
});

// 1. أمر البداية (الترحيب)
bot.start((ctx) => {
    ctx.reply('مرحباً بك في "نكسورا"! ⛏️\n\nأنت الآن مسجل في النظام. الأوامر المتاحة:\n/bonus - للحصول على مكافأة يومية\n/withdraw - لسحب أرباحك');
});

// 2. نظام السحب
bot.command('withdraw', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('استخدم: /withdraw [المحفظة] [المبلغ]');
    
    const user = await User.findOne({ telegramId: ctx.chat.id.toString() });
    const amount = parseInt(parts[2]);

    if (!user || user.points < 500 || amount > user.points) return ctx.reply('❌ رصيد غير كافٍ أو خطأ في الطلب.');
    
    console.log(`[WITHDRAW] طلب سحب: المستخدم ${ctx.chat.id}، المبلغ ${amount}`);
    bot.telegram.sendMessage(ADMIN_ID, `💸 طلب سحب جديد!\nالمستخدم: ${ctx.chat.id}\nالمبلغ: ${amount}\nالمحفظة: ${parts[1]}`);
    ctx.reply('✅ تم إرسال طلب السحب للإدارة.');
});

// 3. نظام المكافأة اليومية
bot.command('bonus', async (ctx) => {
    const userId = ctx.chat.id.toString();
    const user = await User.findOne({ telegramId: userId });
    
    const now = new Date();
    const lastBonus = user.lastBonusDate;

    if (lastBonus && (now - lastBonus) < (24 * 60 * 60 * 1000)) {
        const remainingHours = Math.ceil((24 * 60 * 60 * 1000 - (now - lastBonus)) / (60 * 60 * 1000));
        return ctx.reply(`⏳ لقد حصلت على مكافأتك بالفعل! يمكنك المحاولة مجدداً بعد ${remainingHours} ساعة.`);
    }

    user.points += 50;
    user.lastBonusDate = now;
    await user.save();

    ctx.reply(`🎉 مبروك! حصلت على 50 نقطة مكافأة.\nرصيدك الحالي: ${user.points}`);
});

// 4. نظام الإدارة
bot.command('admin', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_ID) return;
    ctx.reply('🛠 لوحة التحكم:\n/stats - الإحصائيات');
});

bot.command('stats', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_ID) return;
    const count = await User.countDocuments();
    ctx.reply(`📊 عدد المستخدمين: ${count}`);
});

module.exports = bot;
