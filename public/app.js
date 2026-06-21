// تهيئة تطبيق تلجرام المصغر
const tg = window.Telegram.WebApp;
tg.expand(); // فتح التطبيق بكامل الشاشة

// قراءة بيانات المستخدم من تلجرام
const usernameElement = document.getElementById('username');
const user = tg.initDataUnsafe?.user;

if (user) {
    usernameElement.innerText = user.username ? `@${user.username}` : `${user.first_name}`;
} else {
    usernameElement.innerText = "مستخدم تجريبي";
}

// رابط السيرفر الخاص بك المرفوع على Render (قم باستبداله برابطك الحقيقي)
const SERVER_URL = "https://YOUR-PROJECT.onrender.com/api";

// دالة حصد أرباح التعدين القائمة على الوقت عند الضغط على الزر
document.getElementById('claimBtn').addEventListener('click', async () => {
    if (!user) return alert("عذراً، يجب فتح التطبيق من داخل التلجرام حصرياً.");

    try {
        const response = await fetch(`${SERVER_URL}/mining/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: user.id.toString() })
        });

        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('balance').innerText = data.newBalance;
            tg.showAlert(`🎉 ${data.msg}\nالمبلغ المحصود: ${data.claimedAmount} NEX`);
        } else {
            tg.showAlert(`❌ ${data.msg}`);
        }
    } catch (error) {
        console.error("خطأ في الاتصال بالسيرفر:", error);
        tg.showAlert("❌ فشل الاتصال بالسيرفر، تأكد من تشغيل خادم Render بنجاح.");
    }
});

// دالة لتشغيل ألعاب الكازينو العادل
function playGame(gameName) {
    tg.showConfirm(`هل تريد بدء لعبة ${gameName} برصيد حقيقي؟`, (confirmed) => {
        if (confirmed) {
            tg.showAlert(`جاري تشغيل لعبة ${gameName}... الخوارزمية مفعلة بنسبة حماية Provably Fair 5%`);
        }
    });
}
