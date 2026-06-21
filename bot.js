const { Telegraf, Markup } = require('telegraf');
const { User } = require('./database');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = "7018561132";

bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.id) {
        let user = await User.findOne({ telegramId: ctx.chat.id.toString() });
        if (!user) {
            // معالجة الإحالة عند التسجيل الأول
            const startPayload = ctx.startPayload; 
            await User.create({ 
                telegramId: ctx.chat.id.toString(), 
                referredBy: startPayload || null 
            });
        }
    }
    return next();
});

bot.start((ctx) => {
    ctx.reply('مرحباً بك في عالم "Nexora Elite" 💎\nنظام التعدين الأقوى والأكثر أماناً.\n\nاستخدم /app لفتح لوحة التحكم الخاصة بك.');
});

bot.command('app', (ctx) => {
    ctx.reply('اضغط للوصول إلى مركز تحكم Nexora Elite:', Markup.inlineKeyboard([
        Markup.button.webApp('فتح التطبيق 🚀', 'https://nexora-backend-ko1u.onrender.com/')
    ]));
});

bot.command('refer', (ctx) => {
    const link = `https://t.me/YOUR_BOT_USERNAME?start=${ctx.chat.id}`;
    ctx.reply(`رابط الإحالة الخاص بك:\n${link}\n\nشارك الرابط واحصل على 50 نقطة لكل صديق!`);
});

bot.command('stats', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_ID) return;
    const count = await User.countDocuments();
    ctx.reply(`📊 إحصائيات Nexora Elite:\nعدد المستخدمين: ${count}`);
});

module.exports = bot;
