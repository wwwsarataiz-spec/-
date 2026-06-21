// ==========================================
// bot/bot.js - بوت تيليغرام
// ==========================================

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const { User } = require('../models/User');

// ==========================================
// إعداد البوت
// ==========================================
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID || '7018561132';

// ==========================================
// دالة إشعار للمشرف
// ==========================================
async function notifyAdmin(message) {
    try {
        await bot.telegram.sendMessage(ADMIN_ID, `⚠️ إشعار من البوت:\n\n${message}`);
    } catch (error) {
        console.error('فشل إشعار المشرف:', error.message);
    }
}

// ==========================================
// معالجة المستخدمين الجدد
// ==========================================
bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.id) {
        const telegramId = ctx.chat.id.toString();
        try {
            let user = await User.findOne({ telegramId });
            if (!user) {
                const startPayload = ctx.startPayload || null;
                user = new User({
                    telegramId: telegramId,
                    username: ctx.from.first_name || 'مستخدم جديد',
                    phone: 'غير محدد',
                    telegram: ctx.from.username || 'غير محدد',
                    referredBy: startPayload || null,
                    freeSpins: 2,
                    role: 'user',
                    verified: true
                });
                await user.save();
                await notifyAdmin(`👤 مستخدم جديد:\nID: ${telegramId}\nالاسم: ${user.username}`);
            }
        } catch (error) {
            console.error('خطأ في معالجة المستخدم:', error);
        }
    }
    return next();
});

// ==========================================
// أوامر البوت
// ==========================================

// أمر /start
bot.start(async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.chat.id.toString() });
    const name = user?.username || ctx.from.first_name || 'صديق';

    await ctx.reply(
        `✨ مرحباً بك في **Nexora Elite** 💎\n` +
        `أهلاً ${name}!\n\n` +
        `📍 استخدم الأزرار أدناه للتنقل:\n` +
        `• /app - فتح لوحة التحكم\n` +
        `• /balance - عرض رصيدك\n` +
        `• /refer - رابط الإحالة\n` +
        `• /managers - عرض المدراء (للمدراء فقط)`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 فتح التطبيق', process.env.FRONTEND_URL || 'https://nexora-backend-ko1u.onrender.com/')],
            [Markup.button.callback('💰 عرض الرصيد', 'balance')],
            [Markup.button.callback('🔗 رابط الإحالة', 'refer')]
        ])
    );
});

// أمر /app
bot.command('app', (ctx) => {
    ctx.reply('اضغط للوصول إلى مركز تحكم Nexora Elite:', Markup.inlineKeyboard([
        Markup.button.webApp('🚀 فتح التطبيق', process.env.FRONTEND_URL || 'https://nexora-backend-ko1u.onrender.com/')
    ]));
});

// أمر /balance
bot.command('balance', async (ctx) => {
    const telegramId = ctx.chat.id.toString();
    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            return ctx.reply('❌ لم يتم العثور على حسابك. استخدم /start للتسجيل.');
        }

        const message =
            `💰 **رصيدك الأساسي:** ${(user.balance || 0).toFixed(3)} USDT\n` +
            `🎰 **رصيد الكازينو:** ${(user.casinoBalance || 0).toFixed(3)} USDT\n` +
            `🎟️ **الجولات المجانية:** ${user.freeSpins || 0}\n` +
            `📊 **مستوى VIP:** ${user.miningLevel || 1}\n` +
            `👤 **الدور:** ${user.role || 'مستخدم'}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('خطأ في /balance:', error);
        ctx.reply('❌ حدث خطأ في جلب الرصيد.');
    }
});

// أمر /refer
bot.command('refer', (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.chat.id}`;
    ctx.reply(
        `🔗 **رابط الإحالة الخاص بك:**\n${link}\n\n` +
        `🌟 شارك الرابط مع أصدقائك، وعندما يسجلون عبره، ستحصل أنت وهم على مكافآت!`,
        { parse_mode: 'Markdown' }
    );
});

// أمر /stats (للمشرف فقط)
bot.command('stats', async (ctx) => {
    const telegramId = ctx.chat.id.toString();
    if (telegramId !== ADMIN_ID) {
        return ctx.reply('⛔ هذا الأمر متاح للمشرف فقط.');
    }

    try {
        const totalUsers = await User.countDocuments();
        const totalDeposits = await Transaction.aggregate([
            { $match: { type: 'deposit', status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalWithdrawals = await Transaction.aggregate([
            { $match: { type: 'withdrawal', status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const message =
            `📊 **إحصائيات Nexora Elite:**\n\n` +
            `👥 عدد المستخدمين: ${totalUsers}\n` +
            `💰 إجمالي الإيداعات: ${(totalDeposits[0]?.total || 0).toFixed(2)} USDT\n` +
            `💸 إجمالي السحوبات: ${(totalWithdrawals[0]?.total || 0).toFixed(2)} USDT\n` +
            `👑 عدد المدراء: ${await User.countDocuments({ role: 'admin' })}\n` +
            `🛡️ عدد المساعدين: ${await User.countDocuments({ role: 'assistant' })}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('خطأ في /stats:', error);
        ctx.reply('❌ حدث خطأ في جلب الإحصائيات.');
    }
});

// ==========================================
// أوامر الإدارة
// ==========================================

// أمر /addadmin
bot.command('addadmin', async (ctx) => {
    const senderId = ctx.chat.id.toString();
    const sender = await User.findOne({ telegramId: senderId });

    if (!sender || (sender.role !== 'admin' && sender.telegramId !== ADMIN_ID)) {
        return ctx.reply('⛔ هذا الأمر متاح للمدراء فقط.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply(
            '⚠️ **استخدام الأمر:**\n' +
            `/addadmin [معرف_المستخدم] [صلاحية]\n\n` +
            `**الصلاحيات المتاحة:**\n` +
            `• admin - مدير كامل الصلاحيات\n` +
            `• manager - مدير مساعد\n` +
            `• assistant - مساعد`,
            { parse_mode: 'Markdown' }
        );
    }

    const targetId = args[1];
    const role = args[2];
    const allowedRoles = ['admin', 'manager', 'assistant'];

    if (!allowedRoles.includes(role)) {
        return ctx.reply(`⚠️ صلاحية غير صالحة. اختر: ${allowedRoles.join(', ')}`);
    }

    try {
        const targetUser = await User.findOne({ telegramId: targetId });
        if (!targetUser) {
            return ctx.reply(`❌ لم يتم العثور على مستخدم بالمعرف: ${targetId}`);
        }

        targetUser.role = role;
        await targetUser.save();

        await ctx.reply(`✅ تمت إضافة صلاحية **${role}** للمستخدم ${targetId}`);

        try {
            await bot.telegram.sendMessage(
                targetId,
                `🎉 تمت ترقيتك إلى **${role}** في Nexora Elite!\n` +
                `الآن لديك صلاحيات إضافية في المنصة.`
            );
        } catch (e) {}

    } catch (error) {
        console.error('خطأ في /addadmin:', error);
        ctx.reply('❌ حدث خطأ أثناء إضافة الصلاحية.');
    }
});

// أمر /removeadmin
bot.command('removeadmin', async (ctx) => {
    const senderId = ctx.chat.id.toString();
    const sender = await User.findOne({ telegramId: senderId });

    if (!sender || (sender.role !== 'admin' && sender.telegramId !== ADMIN_ID)) {
        return ctx.reply('⛔ هذا الأمر متاح للمدراء فقط.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('⚠️ استخدم: /removeadmin [معرف_المستخدم]');
    }

    const targetId = args[1];

    if (targetId === ADMIN_ID) {
        return ctx.reply('❌ لا يمكن حذف صلاحية المدير الرئيسي.');
    }

    try {
        const targetUser = await User.findOne({ telegramId: targetId });
        if (!targetUser) {
            return ctx.reply(`❌ لم يتم العثور على مستخدم بالمعرف: ${targetId}`);
        }

        targetUser.role = 'user';
        await targetUser.save();

        ctx.reply(`✅ تمت إزالة صلاحيات المستخدم ${targetId}`);

        try {
            await bot.telegram.sendMessage(
                targetId,
                `⚠️ تمت إزالة صلاحياتك الإدارية في Nexora Elite.\n` +
                `لم تعد تملك صلاحيات إضافية.`
            );
        } catch (e) {}

    } catch (error) {
        console.error('خطأ في /removeadmin:', error);
        ctx.reply('❌ حدث خطأ أثناء إزالة الصلاحية.');
    }
});

// أمر /managers
bot.command('managers', async (ctx) => {
    const senderId = ctx.chat.id.toString();
    const sender = await User.findOne({ telegramId: senderId });

    if (!sender || (sender.role !== 'admin' && sender.role !== 'manager' && sender.telegramId !== ADMIN_ID)) {
        return ctx.reply('⛔ هذا الأمر متاح للمدراء والمساعدين فقط.');
    }

    try {
        const admins = await User.find({
            role: { $in: ['admin', 'manager', 'assistant'] }
        });

        if (admins.length === 0) {
            return ctx.reply('لا يوجد مدراء أو مساعدين مسجلين.');
        }

        let message = '👥 **قائمة المدراء والمساعدين:**\n\n';
        admins.forEach((u, i) => {
            const emoji = u.role === 'admin' ? '👑' : u.role === 'manager' ? '🛡️' : '🤝';
            message += `${i+1}. ${emoji} ${u.username || u.telegramId} - \`${u.role}\``;
            if (u.telegramId === ADMIN_ID) message += ' (المالك)';
            message += '\n';
        });

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('خطأ في /managers:', error);
        ctx.reply('❌ حدث خطأ في جلب القائمة.');
    }
});

// ==========================================
// معالجة الأزرار
// ==========================================
bot.action('balance', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('استخدم الأمر /balance لعرض رصيدك.');
});

bot.action('refer', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('استخدم الأمر /refer للحصول على رابط الإحالة.');
});

// ==========================================
// معالجة الأخطاء
// ==========================================
bot.catch(async (err, ctx) => {
    console.error('❌ خطأ في البوت:', err);
    const errorMessage = `🚨 **خطأ في البوت:**\n\n` +
        `المستخدم: ${ctx.from?.id || 'غير معروف'}\n` +
        `الرسالة: ${ctx.message?.text || 'غير معروف'}\n` +
        `الخطأ: ${err.message || 'غير معروف'}`;

    await notifyAdmin(errorMessage);
    try {
        await ctx.reply('⚠️ حدث خطأ غير متوقع. تم إبلاغ المشرف.');
    } catch (e) {}
});

// ==========================================
// تشغيل البوت
// ==========================================
bot.launch()
    .then(() => console.log('✅ البوت يعمل بنجاح!'))
    .catch(err => {
        console.error('❌ فشل تشغيل البوت:', err);
        notifyAdmin(`🚨 فشل تشغيل البوت:\n${err.message}`);
    });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
