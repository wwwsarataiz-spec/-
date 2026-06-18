const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
require('dotenv').config();

// ==========================================
// استيراد موديلات قاعدة البيانات
// ==========================================
const { User, Ad, AdLog, Transaction, AdminLog } = require('./database');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID || "7018561132";

// ==========================================
// دالة إشعار المدير بالأخطاء
// ==========================================
async function notifyAdmin(errorMessage) {
    try {
        await bot.telegram.sendMessage(
            ADMIN_ID,
            `⚠️ **تنبيه خطأ في البوت**\n\n${errorMessage}\n\n🕒 ${new Date().toLocaleString('ar-EG')}`
        );
    } catch (e) {
        console.error('فشل إرسال الإشعار للمدير:', e);
    }
}

// ==========================================
// عند بدء المحادثة (تسجيل المستخدم)
// ==========================================
bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.id) {
        try {
            const telegramId = ctx.chat.id.toString();
            let user = await User.findOne({ telegramId });

            if (!user) {
                // إنشاء مستخدم جديد مع معالجة الإحالة
                const startPayload = ctx.startPayload;
                const newUser = new User({
                    telegramId: telegramId,
                    fullName: ctx.from.first_name || 'مستخدم جديد',
                    referredBy: startPayload || null,
                    role: 'user',
                    freeCasinoSpins: 2,
                    miningEnergy: 1000,
                    usdBalance: 0,
                    casinoBalance: 0
                });
                await newUser.save();
                console.log(`✅ مستخدم جديد: ${telegramId}`);
            }
        } catch (error) {
            console.error('❌ خطأ في تسجيل المستخدم:', error);
            await notifyAdmin(`خطأ في تسجيل المستخدم:\n${error.message}`);
        }
    }
    return next();
});

// ==========================================
// صورة ترحيبية فخمة (بداية البوت)
// ==========================================
bot.start(async (ctx) => {
    try {
        // يمكنك إضافة صورة غلاف هنا
        await ctx.replyWithPhoto(
            { source: './images/nexora_cover.jpg' }, // ضع مسار الصورة
            {
                caption: `✨ مرحباً بك في **Nexora Elite** 💎\nمنصة التعدين والكازينو الأقوى والأكثر أماناً.\n\nاستخدم الأزرار أدناه للتنقل:`,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp('💰 لوحة التحكم', 'https://nexora-backend-ko1u.onrender.com/')],
                    [Markup.button.callback('⛏️ التعدين', 'mining')],
                    [Markup.button.callback('🎰 الكازينو', 'casino')],
                    [Markup.button.callback('👤 حسابي', 'profile')],
                    [Markup.button.callback('📊 الإحصائيات', 'stats')]
                ])
            }
        );
    } catch (error) {
        // إذا فشل إرسال الصورة (لعدم وجودها)، نرسل نصاً فقط
        await ctx.reply(
            `✨ مرحباً بك في **Nexora Elite** 💎\nمنصة التعدين والكازينو الأقوى.\n\nاستخدم الأزرار أدناه للتنقل:`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('💰 لوحة التحكم', 'https://nexora-backend-ko1u.onrender.com/')],
                [Markup.button.callback('⛏️ التعدين', 'mining')],
                [Markup.button.callback('🎰 الكازينو', 'casino')],
                [Markup.button.callback('👤 حسابي', 'profile')],
                [Markup.button.callback('📊 الإحصائيات', 'stats')]
            ])
        );
    }
});

// ==========================================
// أمر /app (فتح التطبيق)
// ==========================================
bot.command('app', (ctx) => {
    ctx.reply('اضغط للوصول إلى مركز تحكم Nexora Elite:', Markup.inlineKeyboard([
        Markup.button.webApp('🚀 فتح التطبيق', 'https://nexora-backend-ko1u.onrender.com/')
    ]));
});

// ==========================================
// أمر /refer (رابط الإحالة)
// ==========================================
bot.command('refer', (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.chat.id}`;
    ctx.reply(
        `🔗 رابط الإحالة الخاص بك:\n${link}\n\nشارك الرابط واحصل على مكافآت عند تسجيل أصدقائك عبره!`
    );
});

// ==========================================
// أمر /stats (إحصائيات للمشرف)
// ==========================================
bot.command('stats', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_ID) return;

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

        ctx.reply(
            `📊 **إحصائيات Nexora Elite**\n\n` +
            `👥 عدد المستخدمين: ${totalUsers}\n` +
            `💰 إجمالي الإيداع: ${(totalDeposits[0]?.total || 0).toFixed(2)} USDT\n` +
            `💸 إجمالي السحب: ${(totalWithdrawals[0]?.total || 0).toFixed(2)} USDT`
        );
    } catch (error) {
        ctx.reply('❌ حدث خطأ في جلب الإحصائيات');
        await notifyAdmin(`خطأ في /stats:\n${error.message}`);
    }
});

// ==========================================
// أوامر الإدارة الجديدة
// ==========================================

// أمر إضافة مدير جديد
bot.command('addadmin', async (ctx) => {
    const senderId = ctx.chat.id.toString();

    try {
        const sender = await User.findOne({ telegramId: senderId });

        // التحقق من صلاحية المدير
        if (!sender || (sender.role !== 'admin' && sender.telegramId !== ADMIN_ID)) {
            return ctx.reply('⛔ هذا الأمر متاح للمديرين فقط.');
        }

        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            return ctx.reply('⚠️ استخدم: /addadmin [معرف_المستخدم] [صلاحية]\nالصلاحيات: admin, manager, assistant');
        }

        const targetId = args[1];
        const role = args[2];
        const allowedRoles = ['admin', 'manager', 'assistant'];
        if (!allowedRoles.includes(role)) {
            return ctx.reply('⚠️ الصلاحية غير صالحة. اختر: admin, manager, assistant');
        }

        const targetUser = await User.findOne({ telegramId: targetId });
        if (!targetUser) {
            return ctx.reply(`❌ لم يتم العثور على مستخدم بالمعرف: ${targetId}`);
        }

        targetUser.role = role;
        await targetUser.save();

        await AdminLog.create({
            adminId: senderId,
            action: `add_${role}`,
            targetId: targetId,
            details: `تمت إضافة صلاحية ${role} للمستخدم ${targetId} بواسطة ${senderId}`
        });

        await ctx.reply(`✅ تمت إضافة صلاحية **${role}** للمستخدم ${targetId}`);

        // إشعار للمستخدم المضاف
        try {
            await ctx.telegram.sendMessage(targetId, `🎉 تمت ترقيتك إلى **${role}** في Nexora Elite!`);
        } catch (e) {}

    } catch (error) {
        ctx.reply('❌ حدث خطأ أثناء إضافة الصلاحية');
        await notifyAdmin(`خطأ في /addadmin:\n${error.message}`);
    }
});

// أمر عرض قائمة المدراء
bot.command('managers', async (ctx) => {
    try {
        const admins = await User.find({ role: { $in: ['admin', 'manager', 'assistant'] } });
        if (admins.length === 0) {
            return ctx.reply('لا يوجد مدراء مسجلون.');
        }

        let message = '👥 **قائمة المدراء والمساعدين:**\n\n';
        admins.forEach(u => {
            const roleEmoji = u.role === 'admin' ? '👑' : u.role === 'manager' ? '🛡️' : '🤝';
            message += `${roleEmoji} ${u.fullName || u.telegramId} - **${u.role}**\n`;
        });

        ctx.reply(message);
    } catch (error) {
        ctx.reply('❌ حدث خطأ في جلب القائمة');
        await notifyAdmin(`خطأ في /managers:\n${error.message}`);
    }
});

// أمر حذف صلاحية مدير
bot.command('removeadmin', async (ctx) => {
    const senderId = ctx.chat.id.toString();

    try {
        const sender = await User.findOne({ telegramId: senderId });

        if (!sender || (sender.role !== 'admin' && sender.telegramId !== ADMIN_ID)) {
            return ctx.reply('⛔ هذا الأمر متاح للمديرين فقط.');
        }

        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('⚠️ استخدم: /removeadmin [معرف_المستخدم]');
        }

        const targetId = args[1];
        if (targetId === ADMIN_ID) {
            return ctx.reply('❌ لا يمكن حذف صلاحية المدير الرئيسي.');
        }

        const targetUser = await User.findOne({ telegramId: targetId });
        if (!targetUser) {
            return ctx.reply(`❌ لم يتم العثور على مستخدم بالمعرف: ${targetId}`);
        }

        targetUser.role = 'user';
        await targetUser.save();

        await AdminLog.create({
            adminId: senderId,
            action: 'remove_role',
            targetId: targetId,
            details: `تمت إزالة صلاحيات المستخدم ${targetId} بواسطة ${senderId}`
        });

        ctx.reply(`✅ تمت إزالة صلاحيات المستخدم ${targetId}`);

        try {
            await ctx.telegram.sendMessage(targetId, `⛔ تمت إزالة صلاحياتك الإدارية في Nexora Elite.`);
        } catch (e) {}

    } catch (error) {
        ctx.reply('❌ حدث خطأ أثناء حذف الصلاحية');
        await notifyAdmin(`خطأ في /removeadmin:\n${error.message}`);
    }
});

// ==========================================
// التعامل مع أزرار القوائم (Actions)
// ==========================================

// زر التعدين
bot.action('mining', async (ctx) => {
    try {
        await ctx.replyWithPhoto(
            { source: './images/mining_plans.jpg' },
            {
                caption: `⛏️ **اختر خطة التعدين المناسبة لك:**\n\n` +
                         `🥉 **برونزي**: 5$ - عائد 3% يومياً\n` +
                         `🥈 **فضي**: 15$ - عائد 5% يومياً\n` +
                         `🥇 **ذهبي**: 50$ - عائد 8% يومياً\n` +
                         `💎 **ماسي**: 150$ - عائد 12% يومياً`,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🥉 برونزي - 5$', 'plan_bronze')],
                    [Markup.button.callback('🥈 فضي - 15$', 'plan_silver')],
                    [Markup.button.callback('🥇 ذهبي - 50$', 'plan_gold')],
                    [Markup.button.callback('💎 ماسي - 150$', 'plan_diamond')],
                    [Markup.button.callback('🔙 رجوع للرئيسية', 'back_main')]
                ])
            }
        );
        await ctx.answerCbQuery();
    } catch (error) {
        await ctx.reply('⛏️ اختر خطة التعدين المناسبة لك:');
        await ctx.reply(
            `🥉 برونزي: 5$ - عائد 3% يومياً\n🥈 فضي: 15$ - عائد 5% يومياً\n🥇 ذهبي: 50$ - عائد 8% يومياً\n💎 ماسي: 150$ - عائد 12% يومياً`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🥉 برونزي - 5$', 'plan_bronze')],
                [Markup.button.callback('🥈 فضي - 15$', 'plan_silver')],
                [Markup.button.callback('🥇 ذهبي - 50$', 'plan_gold')],
                [Markup.button.callback('💎 ماسي - 150$', 'plan_diamond')],
                [Markup.button.callback('🔙 رجوع', 'back_main')]
            ])
        );
        await ctx.answerCbQuery();
    }
});

// اختيار خطة التعدين
bot.action(/plan_(.+)/, async (ctx) => {
    const plan = ctx.match[1];
    const prices = { bronze: 5, silver: 15, gold: 50, diamond: 150 };
    const returns = { bronze: 3, silver: 5, gold: 8, diamond: 12 };
    const emojis = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎' };

    const price = prices[plan];
    const returnRate = returns[plan];
    const emoji = emojis[plan];

    try {
        await ctx.reply(
            `✅ تم اختيار خطة **${plan}**!\n` +
            `${emoji} السعر: ${price}$\n` +
            `📈 العائد اليومي: ${returnRate}%\n\n` +
            `سيتم تفعيل الخطة فوراً بعد تأكيد الدفع.`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ تأكيد الدفع', `confirm_plan_${plan}`)],
                [Markup.button.callback('❌ إلغاء', 'cancel')]
            ])
        );
        await ctx.answerCbQuery();
    } catch (error) {
        ctx.reply('❌ حدث خطأ');
        await notifyAdmin(`خطأ في اختيار الخطة:\n${error.message}`);
    }
});

// تأكيد الدفع للخطة
bot.action(/confirm_plan_(.+)/, async (ctx) => {
    const plan = ctx.match[1];
    const prices = { bronze: 5, silver: 15, gold: 50, diamond: 150 };
    const price = prices[plan];

    try {
        const userId = ctx.chat.id.toString();
        const user = await User.findOne({ telegramId: userId });

        if (!user) {
            return ctx.reply('❌ المستخدم غير موجود');
        }

        if (user.usdBalance < price) {
            return ctx.reply(`❌ رصيدك غير كافٍ! الرصيد: ${user.usdBalance} USDT، المطلوب: ${price} USDT`);
        }

        user.usdBalance -= price;
        user.vipPlanLevel = { bronze: 1, silver: 2, gold: 3, diamond: 4 }[plan] || 1;
        await user.save();

        await ctx.reply(
            `✅ تم تفعيل خطة **${plan}** بنجاح!\n` +
            `💰 الرصيد المتبقي: ${user.usdBalance.toFixed(2)} USDT\n` +
            `📈 العائد اليومي: ${plan === 'bronze' ? 3 : plan === 'silver' ? 5 : plan === 'gold' ? 8 : 12}%`
        );

        await ctx.answerCbQuery();

    } catch (error) {
        ctx.reply('❌ حدث خطأ في تأكيد الدفع');
        await notifyAdmin(`خطأ في confirm_plan:\n${error.message}`);
    }
});

// زر الكازينو
bot.action('casino', async (ctx) => {
    try {
        await ctx.reply(
            `🎰 **ألعاب الكازينو المتاحة:**\n\n` +
            `🎡 العجلة: اختر رقماً وحاول الفوز\n` +
            `🎲 النرد: خمن الرقم الصحيح\n` +
            `🐔 الدجاجة: اربح المضاعف قبل الانهيار\n\n` +
            `استخدم التطبيق للعب مباشرة!`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('🎰 افتح الكازينو', 'https://nexora-backend-ko1u.onrender.com/')],
                [Markup.button.callback('🔙 رجوع', 'back_main')]
            ])
        );
        await ctx.answerCbQuery();
    } catch (error) {
        ctx.reply('❌ حدث خطأ');
        await notifyAdmin(`خطأ في الكازينو:\n${error.message}`);
    }
});

// زر الحساب
bot.action('profile', async (ctx) => {
    const userId = ctx.chat.id.toString();

    try {
        const user = await User.findOne({ telegramId: userId });
        if (!user) return ctx.reply('❌ المستخدم غير موجود');

        const referralLink = `https://t.me/${ctx.botInfo.username}?start=${userId}`;

        await ctx.reply(
            `👤 **حسابي في Nexora Elite**\n\n` +
            `📛 الاسم: ${user.fullName}\n` +
            `💰 الرصيد الأساسي: ${user.usdBalance.toFixed(3)} USDT\n` +
            `🎰 رصيد الكازينو: ${user.casinoBalance.toFixed(3)} USDT\n` +
            `🎟️ الجولات المجانية: ${user.freeCasinoSpins}\n` +
            `⚡ الطاقة: ${user.miningEnergy}\n` +
            `👑 الصلاحية: ${user.role}\n\n` +
            `🔗 رابط الإحالة:\n${referralLink}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 رجوع', 'back_main')]
            ])
        );
        await ctx.answerCbQuery();
    } catch (error) {
        ctx.reply('❌ حدث خطأ');
        await notifyAdmin(`خطأ في الحساب:\n${error.message}`);
    }
});

// زر الإحصائيات (للجميع)
bot.action('stats', async (ctx) => {
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

        await ctx.reply(
            `📊 **إحصائيات Nexora Elite**\n\n` +
            `👥 عدد المستخدمين: ${totalUsers}\n` +
            `💰 إجمالي الإيداع: ${(totalDeposits[0]?.total || 0).toFixed(2)} USDT\n` +
            `💸 إجمالي السحب: ${(totalWithdrawals[0]?.total || 0).toFixed(2)} USDT`
        );
        await ctx.answerCbQuery();
    } catch (error) {
        ctx.reply('❌ حدث خطأ في جلب الإحصائيات');
        await notifyAdmin(`خطأ في stats action:\n${error.message}`);
    }
});

// زر الرجوع للرئيسية
bot.action('back_main', async (ctx) => {
    try {
        await ctx.reply(
            `✨ **القائمة الرئيسية**`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('💰 لوحة التحكم', 'https://nexora-backend-ko1u.onrender.com/')],
                [Markup.button.callback('⛏️ التعدين', 'mining')],
                [Markup.button.callback('🎰 الكازينو', 'casino')],
                [Markup.button.callback('👤 حسابي', 'profile')],
                [Markup.button.callback('📊 الإحصائيات', 'stats')]
            ])
        );
        await ctx.answerCbQuery();
    } catch (error) {
        await notifyAdmin(`خطأ في back_main:\n${error.message}`);
    }
});

// زر الإلغاء
bot.action('cancel', async (ctx) => {
    await ctx.reply('❌ تم إلغاء العملية.');
    await ctx.answerCbQuery();
});

// ==========================================
// معالجة الأخطاء العامة
// ==========================================
bot.catch(async (err, ctx) => {
    console.error('❌ خطأ في البوت:', err);
    await notifyAdmin(`خطأ في البوت:\n${err.message}`);
    try {
        await ctx.reply('حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.');
    } catch (e) {}
});

// ==========================================
// تشغيل البوت
// ==========================================
bot.launch()
    .then(() => console.log('🚀 البوت يعمل بنجاح!'))
    .catch(err => {
        console.error('❌ فشل تشغيل البوت:', err);
        notifyAdmin(`فشل تشغيل البوت:\n${err.message}`);
    });

// إيقاف البوت عند إنهاء العملية
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
