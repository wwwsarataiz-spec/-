// --- ٤. مشاهدة الإعلان: النظام الجديد (تحويل الربح للإدارة + عداد الجولات المجانية) ---
app.post('/api/watch-ad', async (req, res) => {
    const { telegramId, adId } = req.body;
    try {
        const ad = await Ad.findById(adId);
        if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود أو انتهت صلاحيته' });
        
        // التحقق من ميزانية الإعلان
        if (ad.remainingBudget < 0.001) {
            ad.isActive = false;
            await ad.save();
            return res.json({ success: false, message: 'عذراً، نفذت ميزانية هذا الإعلان!' });
        }

        // منع تكرار مشاهدة نفس الإعلان من نفس الشخص
        const alreadyViewed = await AdLog.findOne({ telegramId, adId });
        if (alreadyViewed) return res.json({ success: false, message: 'لقد شاهدت هذا الإعلان بالفعل!' });

        // ١. خصم القيمة من ميزانية المعلن (تذهب لصالح الإدارة تلقائياً لأننا لا نضيفها لرصيد المستخدم)
        ad.remainingBudget -= 0.001;
        ad.viewsCount += 1;
        if (ad.remainingBudget < 0.001) ad.isActive = false; 
        await ad.save();

        // ٢. تسجيل اللوج للمستخدم لضمان عدم التكرار
        await AdLog.create({ telegramId, adId });

        // ٣. تحديث عداد الإعلانات للمستخدم في قاعدة البيانات ومنحه الجولة إذا وصل لـ 15
        const user = await User.findOne({ telegramId });
        if (!user) return res.json({ success: false, message: 'المستخدم غير موجود' });

        // نستخدم حقل الـ points مؤقتاً كعداد للإعلانات المشاهدة، أو نرفع القيمة مباشرة
        // لكي نبقي الأمر بسيطاً ومحفوظاً، سنقوم بزيادة عدد المشاهدات وتحديث الجولات تلقائياً
        
        // هنا فكرة ذكية: كلما شاهد إعلان نضيف له 1 في عداد داخلي مخفي (سنعتمد على لوج الإعلانات اليومي)
        // للحفاظ على بساطة الكود واستقراره، سنقوم بزيادة الجولات المجانية مباشرة بعد كل 15 مشاهدة حقيقية
        const totalUserViews = await AdLog.countDocuments({ telegramId });
        
        let earnedSpins = false;
        // إذا كان باقي قسمة مجموع مشاهداته على 15 يساوي 0، يعني أنه أتم حزمة جديدة من 15 إعلان
        if (totalUserViews % 15 === 0) {
            user.freeCasinoSpins += 1;
            earnedSpins = true;
        }
        await user.save();

        if (earnedSpins) {
            return res.json({ 
                success: true, 
                message: `🎉 رائع جداً! لقد أتممت مشاهدة 15 إعلاناً بنجاح، وتم منحك جولة مجانية (1 Free Spin) في قاعة الكازينو الآن!`,
                freeSpinsLeft: user.freeCasinoSpins
            });
        } else {
            const nextMilestone = 15 - (totalUserViews % 15);
            return res.json({ 
                success: true, 
                message: `👀 تم تسجيل مشاهدة الإعلان بنجاح. متبقي لك ${nextMilestone} إعلانات للحصول على جولة كازينو مجانية!`,
                freeSpinsLeft: user.freeCasinoSpins
            });
        }

    } catch (error) {
        res.json({ success: false, message: 'خطأ في معالجة الإعلان برمجياً' });
    }
});
