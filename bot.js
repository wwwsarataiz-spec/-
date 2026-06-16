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
