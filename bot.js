const { Telegraf, Markup } = require('telegraf');
const { User } = require('./database');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = "7018561132";

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

// ... باقي الأوامر كما هي
module.exports = bot;
