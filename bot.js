// ==========================================
// bot.js — بوت Nexora Elite الفاخر
// ==========================================

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
require('dotenv').config();

const { User, MiningPlan, AdminLog } = require('./database');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID || "7018561132";

// ==========================================
// دالة مساعدة للتحقق من صلاحية المستخدم
// ==========================================
async function getUser(telegramId) {
    return await User.findOne({ telegramId: telegramId.toString() });
}

async function isAdmin(telegramId) {
    const user = await getUser(telegramId);
    return user && (user.role === 'admin' || user.telegramId === ADMIN_ID);
}

async function isManager(telegramId) {
    const user = await getUser(telegramId);
    return user && (user.role === 'admin' || user.role === 'manager' || user.telegramId === ADMIN_ID);
}

// ==========================================
// إرسال إشعارات للمشرف
// ==========================================
async function notifyAdmin(message) {
    try {
        await bot.telegram.sendMessage(ADMIN_ID, `⚠️ إشعار من البوت:\n\n${message}`);
    } catch (error) {
        console.error('فشل إرسال إشعار:', error.message);
    }
}

// ==========================================
// لوحة مفاتيح ملونة (Main Menu)
// ==========================================
function getMainMenu(userRole) {
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager' || isAdmin;
    
    let keyboard = [
        [
            Markup.button.callback('💰 رصيدي', 'balance'),
            Markup.button.callback('⛏️ التعدين', 'mining_menu')
        ],
        [
            Markup.button.callback('🎰 الكازينو', 'casino_menu'),
            Markup.button.callback('🎁 مكافآتي', 'rewards')
        ],
        [
            Markup.button.webApp('🚀 فتح التطبيق', 'https://nexora-backend-ko1u.onrender.com/')
        ]
    ];
    
    if (isManager) {
        keyboard.push([
            Markup.button.callback('⚙️ لوحة الإدارة', 'admin_panel')
        ]);
    }
    
    return Markup.inlineKeyboard(keyboard);
}

// ==========================================
// معالجة بدء المحادثة
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
                    fullName: ctx.from.first_name || 'مستخدم جديد',
                    phoneNumber: 'غير محدد',
                    email: `tg_${telegramId}@nexora.app`,
                    password: 'telegram_auth',
                    referredBy: startPayload || null,
                    freeCasinoSpins: 2,
                    role: 'user',
                    verified: true,
                    giftPoints: 0
                });
                await user.save();
                
                await notifyAdmin(`👤 مستخدم جديد:\nID: ${telegramId}\nالاسم: ${user.fullName}`);
            }
        } catch (error) {
            console.error('خطأ في معالجة المستخدم:', error);
        }
    }
    return next();
});

// ==========================================
// أمر /start - الترحيب الفاخر
// ==========================================
bot.start(async (ctx) => {
    const user = await getUser(ctx.chat.id);
    const name = user?.fullName || ctx.from.first_name || 'صديق';
    
    const welcomeText = 
        `✨ مرحباً بك في **Nexora Elite** 💎\n\n` +
        `👋 أهلاً يا ${name}!\n\n` +
        `📍 ما الذي تريد فعله اليوم؟`;
    
    await ctx.reply(
        welcomeText,
        { 
            parse_mode: 'Markdown',
            ...getMainMenu(user?.role || 'user')
        }
    );
});

// ==========================================
// أمر /menu - إعادة عرض القائمة
// ==========================================
bot.command('menu', async (ctx) => {
    const user = await getUser(ctx.chat.id);
    await ctx.reply(
        '📋 القائمة الرئيسية:',
        getMainMenu(user?.role || 'user')
    );
});

// ==========================================
// أمر /app - فتح التطبيق
// ==========================================
bot.command('app', (ctx) => {
    ctx.reply(
        '🚀 اضغط للوصول إلى مركز تحكم Nexora Elite:',
        Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 فتح التطبيق', 'https://nexora-backend-ko1u.onrender.com/')]
        ])
    );
});

// ==========================================
// أمر /balance - عرض الرصيد
// ==========================================
bot.command('balance', async (ctx) => {
    const telegramId = ctx.chat.id.toString();
    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            return ctx.reply('❌ لم يتم العثور على حسابك. استخدم /start');
        }
        
        const message = 
            `💰 **رصيدك في Nexora Elite**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💵 **الرصيد الأساسي:** ${(user.usdBalance || 0).toFixed(3)} USDT\n` +
            `🎰 **رصيد الكازينو:** ${(user.casinoBalance || 0).toFixed(3)} USDT\n` +
            `🎁 **نقاط الهدايا:** ${(user.giftPoints || 0).toFixed(0)} ⭐\n` +
            `🎟️ **الجولات المجانية:** ${user.freeCasinoSpins || 0}\n` +
            `📊 **مستوى VIP:** ${user.vipPlanLevel || 1}\n` +
            `⛏️ **مستوى التعدين:** ${user.miningLevel || 1}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;
        
        ctx.reply(message, { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 تحديث', 'balance')],
                [Markup.button.callback('📋 القائمة الرئيسية', 'main_menu')]
            ])
        });
    } catch (error) {
        console.error('خطأ في /balance:', error);
        ctx.reply('❌ حدث خطأ في جلب الرصيد.');
    }
});

// ==========================================
// أمر /mining - خطط التعدين
// ==========================================
bot.command('mining', async (ctx) => {
    try {
        const plans = await MiningPlan.find({ isActive: true }).sort({ price: 1 });
        
        if (plans.length === 0) {
            return ctx.reply('⛏️ لا توجد خطط متاحة حالياً.');
        }
        
        let message = '⛏️ **خطط التعدين المتاحة:**\n\n';
        const buttons = [];
        
        plans.forEach((plan, i) => {
            const roi = ((plan.dailyReturn * plan.duration) / plan.price * 100).toFixed(0);
            message += 
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `📦 **${plan.name}**\n` +
                `💰 السعر: ${plan.price} USDT\n` +
                `📈 العائد اليومي: ${plan.dailyReturn} USDT\n` +
                `📅 المدة: ${plan.duration} يوم\n` +
                `💹 العائد الكلي: ${roi}%\n\n`;
            
            buttons.push([Markup.button.callback(`⛏️ شراء ${plan.name}`, `buy_plan_${plan._id}`)]);
        });
        
        buttons.push([Markup.button.callback('📋 القائمة الرئيسية', 'main_menu')]);
        
        ctx.reply(message, { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
        
    } catch (error) {
        console.error('خطأ في /mining:', error);
        ctx.reply('❌ حدث خطأ في جلب خطط التعدين.');
    }
});

// ==========================================
// أمر /refer - رابط الإحالة
// ==========================================
bot.command('refer', (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.chat.id}`;
    ctx.reply(
        `🔗 **رابط الإحالة الخاص بك:**\n\n` +
        `\`${link}\`\n\n` +
        `🌟 شارك الرابط مع أصدقائك!\n` +
        `💰 عندما يسجلون عبره، ستحصل أنت وهم على مكافآت!`,
        { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📋 القائمة الرئيسية', 'main_menu')]
            ])
        }
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
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👥 عدد المستخدمين: ${totalUsers}\n` +
            `💰 إجمالي الإيداعات: ${(totalDeposits[0]?.total || 0).toFixed(2)} USDT\n` +
            `💸 إجمالي السحوبات: ${(totalWithdrawals[0]?.total || 0).toFixed(2)} USDT\n` +
            `👑 عدد المدراء: ${await User.countDocuments({ role: 'admin' })}\n` +
            `🛡️ عدد المساعدين: ${await User.countDocuments({ role: 'assistant' })}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;
        
        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('خطأ في /stats:', error);
        ctx.reply('❌ حدث خطأ في جلب الإحصائيات.');
    }
});

// ==========================================
// أوامر الإدارة
// ==========================================

// أمر /addadmin - إضافة مدير
bot.command('addadmin', async (ctx) => {
    const senderId = ctx.chat.id.toString();
    
    if (!await isAdmin(senderId)) {
        return ctx.reply('⛔ هذا الأمر متاح للمدراء فقط.');
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply(
            '⚠️ **استخدام الأمر:**\n' +
            `/addadmin [معرف_المستخدم] [صلاحية]\n\n` +
            `**الصلاحيات المتاحة:**\n` +
            `• admin - مدير كامل\n` +
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
            return ctx.reply(`❌ لم يتم العثور على مستخدم: ${targetId}`);
        }
        
        targetUser.role = role;
        await targetUser.save();
        
        await AdminLog.create({
            adminId: senderId,
            action: `add_${role}`,
            targetId: targetId,
            details: `تمت إضافة صلاحية ${role}`
        });
        
        await ctx.reply(`✅ تمت إضافة صلاحية **${role}**`);
        
        try {
            await bot.telegram.sendMessage(
                targetId,
                `🎉 تمت ترقيتك إلى **${role}** في Nexora Elite!`
            );
        } catch (e) {}
        
    } catch (error) {
        ctx.reply('❌ حدث خطأ.');
    }
});

// أمر /removeadmin - حذف صلاحية
bot.command('removeadmin', async (ctx) => {
    const senderId = ctx.chat.id.toString();
    
    if (!await isAdmin(senderId)) {
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
            return ctx.reply(`❌ لم يتم العثور على مستخدم: ${targetId}`);
        }
        
        targetUser.role = 'user';
        await targetUser.save();
        
        await AdminLog.create({
            adminId: senderId,
            action: 'remove_role',
            targetId: targetId
        });
        
        ctx.reply(`✅ تمت إزالة الصلاحيات`);
        
    } catch (error) {
        ctx.reply('❌ حدث خطأ.');
    }
});

// أمر /managers - قائمة المدراء
bot.command('managers', async (ctx) => {
    const senderId = ctx.chat.id.toString();
    
    if (!await isManager(senderId)) {
        return ctx.reply('⛔ هذا الأمر متاح للمدراء فقط.');
    }
    
    try {
        const admins = await User.find({ 
            role: { $in: ['admin', 'manager', 'assistant'] } 
        });
        
        if (admins.length === 0) {
            return ctx.reply('لا يوجد مدراء مسجلين.');
        }
        
        let message = '👥 **المدراء والمساعدين:**\n\n';
        admins.forEach((u, i) => {
            const emoji = u.role === 'admin' ? '👑' : u.role === 'manager' ? '🛡️' : '🤝';
            message += `${i+1}. ${emoji} ${u.fullName || u.telegramId} - \`${u.role}\`\n`;
        });
        
        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        ctx.reply('❌ حدث خطأ.');
    }
});

// ==========================================
// معالجة الأزرار (Callback Queries)
// ==========================================

bot.action('main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await getUser(ctx.chat.id);
    await ctx.editMessageText(
        '📋 القائمة الرئيسية:',
        getMainMenu(user?.role || 'user')
    );
});

bot.action('balance', async (ctx) => {
    await ctx.answerCbQuery('جاري التحميل...');
    const telegramId = ctx.chat.id.toString();
    const user = await User.findOne({ telegramId });
    
    if (!user) return ctx.reply('❌ لم يتم العثور على الحساب');
    
    const message = 
        `💰 **رصيدك:**\n` +
        `💵 أساسي: ${(user.usdBalance || 0).toFixed(3)} USDT\n` +
        `🎰 كازينو: ${(user.casinoBalance || 0).toFixed(3)} USDT\n` +
        `🎁 نقاط: ${(user.giftPoints || 0).toFixed(0)} ⭐`;
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 تحديث', 'balance')],
            [Markup.button.callback('📋 القائمة', 'main_menu')]
        ])
    });
});

bot.action('mining_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        '⛏️ **قسم التعدين**\n\nاختر ما تريد:',
        Markup.inlineKeyboard([
            [Markup.button.callback('📋 عرض الخطط', 'show_plans')],
            [Markup.button.callback('⛏️ خططي', 'my_plans')],
            [Markup.button.callback('📋 القائمة', 'main_menu')]
        ])
    );
});

bot.action('show_plans', async (ctx) => {
    await ctx.answerCbQuery('جاري التحميل...');
    try {
        const plans = await MiningPlan.find({ isActive: true }).sort({ price: 1 });
        
        if (plans.length === 0) {
            return ctx.editMessageText('⛏️ لا توجد خطط متاحة.');
        }
        
        let message = '⛏️ **خطط التعدين:**\n\n';
        const buttons = [];
        
        plans.forEach((plan) => {
            message += 
                `📦 ${plan.name}\n` +
                `💰 ${plan.price} USDT | 📈 ${plan.dailyReturn}/يوم\n\n`;
            buttons.push([Markup.button.callback(`شراء ${plan.name}`, `buy_plan_${plan._id}`)]);
        });
        
        buttons.push([Markup.button.callback('📋 القائمة', 'main_menu')]);
        
        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
        
    } catch (error) {
        ctx.editMessageText('❌ خطأ في جلب الخطط.');
    }
});

bot.action('casino_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        '🎰 **قسم الكازينو**\n\n🎡 عجلة الحظ\n🎲 لعبة النرد\n📊 لعبة الهامش\n💥 لعبة Crash',
        Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 العب الآن في التطبيق', 'https://nexora-backend-ko1u.onrender.com/')],
            [Markup.button.callback('📋 القائمة', 'main_menu')]
        ])
    );
});

bot.action('rewards', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        '🎁 **المكافآت والهدايا**\n\n' +
        '• شاهد إعلانات يومياً\n' +
        '• ادعُ أصدقاءك\n' +
        '• العب في الكازينو\n' +
        '• اضغط التعدين يومياً',
        Markup.inlineKeyboard([
            [Markup.button.callback('📋 القائمة', 'main_menu')]
        ])
    );
});

bot.action('admin_panel', async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.chat.id.toString();
    
    if (!await isManager(telegramId)) {
        return ctx.reply('⛔ صلاحيات غير كافية');
    }
    
    await ctx.editMessageText(
        '⚙️ **لوحة الإدارة**\n\nاختر الإجراء:',
        Markup.inlineKeyboard([
            [Markup.button.callback('📊 الإحصائيات', 'admin_stats')],
            [Markup.button.callback('👥 المستخدمين', 'admin_users')],
            [Markup.button.callback('📋 الطلبات', 'admin_requests')],
            [Markup.button.callback('🎁 إرسال نقاط', 'admin_gift')],
            [Markup.button.callback('📋 القائمة', 'main_menu')]
        ])
    );
});

// ==========================================
// معالجة الأخطاء
// ==========================================
bot.catch(async (err, ctx) => {
    console.error('❌ خطأ:', err);
    await notifyAdmin(`🚨 خطأ: ${err.message}`);
    try {
        await ctx.reply('⚠️ حدث خطأ. تم إبلاغ المشرف.');
    } catch (e) {}
});

// ==========================================
// تشغيل البوت
// ==========================================
bot.launch()
    .then(() => console.log('✅ البوت يعمل بنجاح!'))
    .catch(err => {
        console.error('❌ فشل تشغيل البوت:', err);
        notifyAdmin(`🚨 فشل تشغيل البوت: ${err.message}`);
    });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
