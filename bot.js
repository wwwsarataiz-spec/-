const { Telegraf, Markup } = require('telegraf');
const { User } = require('./database');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = "7018561132";

// 1. نظام السحب
bot.command('withdraw', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('استخدم: /withdraw [المحفظة] [المبلغ]');
    
    const user = await User.findOne({ telegramId: ctx.chat.id.toString() });
    const amount = parseInt(parts[2]);

    if (!user || user.points < 500 || amount > user.points) return ctx.reply('❌ رصيد غير كافٍ أو خطأ في الطلب.');
    
    // تسجيل الطلب في الـ Logs
    console.log(`[WITHDRAW] طلب سحب: المستخدم ${ctx.chat.id}، المبلغ ${amount}`);
    
    bot.telegram.sendMessage(ADMIN_ID, `💸 طلب سحب جديد!\nالمستخدم: ${ctx.chat.id}\nالمبلغ: ${amount}\nالمحفظة: ${parts[1]}`);
    ctx.reply('✅ تم إرسال طلب السحب للإدارة.');
});

// 2. نظام المكافأة اليومية
bot.command('bonus', async (ctx) => {
    const userId = ctx.chat.id.toString();
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) return ctx.reply('يجب أن تبدأ البوت أولاً عبر /start');

    const now = new Date();
    const lastBonus = user.lastBonusDate;

    // التحقق إذا مر 24 ساعة
    if (lastBonus && (now - lastBonus) < (24 * 60 * 60 * 1000)) {
        const remainingHours = Math.ceil((24 * 60 * 60 * 1000 - (now - lastBonus)) / (60 * 60 * 1000));
        return ctx.reply(`⏳ لقد حصلت على مكافأتك بالفعل! يمكنك المحاولة مجدداً بعد ${remainingHours} ساعة.`);
    }

    // إضافة النقاط
    const bonus = 50; // قيمة المكافأة
    user.points += bonus;
    user.lastBonusDate = now;
    await user.save();

    ctx.reply(`🎉 مبروك! حصلت على ${bonus} نقطة كمكافأة يومية.\nرصيدك الحالي: ${user.points}`);
});

// 3. نظام الإدارة (الأوامر السرية)
bot.command('admin', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_ID) return;
    ctx.reply('🛠 لوحة التحكم:\n/stats - الإحصائيات\n/broadcast [الرسالة] - إرسال للجميع');
});

bot.command('stats', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_ID) return;
    const count = await User.countDocuments();
    ctx.reply(`📊 عدد المستخدمين: ${count}`);
});

module.exports = bot;
