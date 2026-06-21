// ==========================================
// bot/bot.js - بوت تيليغرام
// ==========================================

const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const { User } = require('../models/User');
const { Transaction } = require('../models/Transaction');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID || "7018561132";

// ==========================================
// دالة إرسال إشعار للمشرف
// ==========================================
async function notifyAdmin(message) {
    try {
        await bot.telegram.sendMessage(ADMIN_ID, `⚠️ إشعار من البوت:\n\n${message}`);
    } catch (error) {
        console.error('❌ فشل إرسال إشعار للمشرف:', error.message);
    }
}

// ==========================================
// معالجة بدء المحادثة وتسجيل المستخدم
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
                    telegram: '@' + (ctx.from.username || 'غير محدد'),
                    referredBy: startPayload || null,
                    freeSpins: 2,
                    role: 'user',
                    verified: true
                });
                await user.save();
                await notifyAdmin(`👤 مستخدم جديد:\nID: ${telegramId}\nالاسم: ${user.username}`);
            }
        } catch (error) {
            console.error('❌ خطأ في معالجة المستخدم:', error);
        }
    }
    return next();
});

// ==========================================
// أمر /start - الترحيب
// ==========================================
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
        `• /stats - إحصائيات (للمشرف فقط)`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🚀 فتح التطبيق', web_app: { url: process.env.FRONTEND_URL || 'https://nexora-backend-ko1u.onrender.com' } }],
                    [{ text: '💰 عرض الرصيد', callback_data: 'balance' }],
                    [{ text: '🔗 رابط الإحالة', callback_data: 'refer' }]
                ]
            }
        }
    );
});

// ==========================================
// أمر /app - فتح التطبيق
// ==========================================
bot.command('app', (ctx) => {
    ctx.reply('اضغط للوصول إلى مركز تحكم Nexora Elite:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🚀 فتح التطبيق', web_app: { url: process.env.FRONTEND_URL || 'https://nexora-backend-ko1u.onrender.com' } }]
            ]
        }
    });
});

// ==========================================
// أمر /balance - عرض الرصيد
// ==========================================
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
            `👤 **الدور:** ${user.role || 'مستخدم'}`;
        
        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('❌ خطأ في /balance:', error);
        ctx.reply('❌ حدث خطأ في جلب الرصيد.');
    }
});

// ==========================================
// أمر /refer - رابط الإحالة
// ==========================================
bot.command('refer', (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.chat.id}`;
    ctx.reply(
        `🔗 **رابط الإحالة الخاص بك:**\n${link}\n\n🌟 شارك الرابط مع أصدقائك، وعندما يسجلون عبره، ستحصل أنت وهم على مكافآت!`,
        { parse_mode: 'Markdown' }
    );
});

// ==========================================
// أمر /stats - إحصائيات (للمشرف فقط)
// ==========================================
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
            `💸 إجمالي السحوبات: ${(totalWithdrawals[0]?.total || 0).toFixed(2)} USDT`;
        
        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('❌ خطأ في /stats:', error);
        ctx.reply('❌ حدث خطأ في جلب الإحصائيات.');
    }
});

// ==========================================
// معالجة الأزرار (Callback Queries)
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
// معالجة الأخطاء وإشعار المشرف
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

// إيقاف البوت عند إنهاء العملية
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
