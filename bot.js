const { Telegraf, Markup } = require('telegraf');
const { User } = require('./database');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = "7018561132";

// أمر البدء والإحالات
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
    
    ctx.reply('مرحباً في نكسورا! استخدم الأزرار:', Markup.keyboard([
        ['⛏️ ابدأ التعدين', '💰 مكافأة يومية'], 
        ['🏆 لوحة الصدارة', '👤 حسابي'],
        ['📥 إيداع', '💸 سحب الأرباح']
    ]).resize());
});

// أوامر السحب والإدارة مدمجة هنا (نفس المنطق السابق)
// ... (سنقوم بوضع باقي الأوامر هنا بالتفصيل في الخطوة القادمة إذا أردت)

module.exports = bot;
