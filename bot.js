const { Telegraf, Markup } = require('telegraf');
const { User } = require('./database');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = "7018561132";

// 1. نظام السحب
bot.command('withdraw', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('الرجاء استخدام الصيغة: /withdraw [المحفظة] [المبلغ]');
    const user = await User.findOne({ telegramId: ctx.chat.id.toString() });
    if (user.points < 500) return ctx.reply('❌ الحد الأدنى للسحب هو 500 نقطة.');
    
    bot.telegram.sendMessage(ADMIN_ID, `💸 طلب سحب من: ${ctx.chat.id}\nالرصيد: ${user.points}\nالمبلغ: ${parts[2]}`);
    ctx.reply('تم إرسال الطلب للمراجعة.');
});

// 2. نظام الإدارة (الأوامر السرية)
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
