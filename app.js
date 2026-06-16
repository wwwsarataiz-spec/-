require('dotenv').config(); const express = require('express'); const path = require('path'); const bot = require('./bot'); const { User, Ad, AdLog } = require('./database');

const app = express();

app.use(express.json()); app.use(express.static('public'));

const ADMIN_ID = "7018561132";

// تشغيل البوت bot.launch() .then(() => console.log('🤖 Nexora Elite Bot is live!')) .catch(console.error);

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// جلب بيانات المستخدم app.post('/api/user-data', async (req, res) => {

try { const { telegramId } = req.body; if (!telegramId) { return res.status(400).json({ error: 'telegramId required' }); } const user = await User.findOne({ telegramId }); if (!user) { return res.status(404).json({ error: 'User not found' }); } res.json(user); } catch (error) { console.error(error); res.status(500).json({ error: 'Server error' }); } 

});

// إشعار إيداع app.post('/api/deposit-notify', async (req, res) => {

try { const { telegramId, coin, amount } = req.body; await bot.telegram.sendMessage( ADMIN_ID, `💰 إيداع جديد!\nالمستخدم: ${telegramId}\nالعملة: ${coin}\nالمبلغ: ${amount}` ); res.json({ success: true, message: 'تم إخطار الإدارة بنجاح' }); } catch (error) { console.error(error); res.status(500).json({ success: false }); } 

});

// جلب الإعلانات app.post('/api/get-ads', async (req, res) => {

try { const ads = await Ad.find({ isActive: true, budget: { $gt: 0 } }); res.json(ads); } catch (error) { console.error(error); res.status(500).json([]); } 

});

// مشاهدة إعلان app.post('/api/watch-ad', async (req, res) => {

try { const { telegramId, adId } = req.body; if (!telegramId || !adId) { return res.status(400).json({ success: false, message: 'بيانات ناقصة' }); } const user = await User.findOne({ telegramId }); if (!user) { return res.status(404).json({ success: false, message: 'المستخدم غير موجود' }); } const lastView = await AdLog.findOne({ telegramId, adId, viewedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }); if (lastView) { return res.json({ success: false, message: 'لقد شاهدت هذا الإعلان مسبقاً اليوم' }); } const ad = await Ad.findById(adId); if (!ad) { return res.json({ success: false, message: 'الإعلان غير موجود' }); } if (ad.budget < ad.costPerView) { return res.json({ success: false, message: 'انتهت ميزانية الإعلان' }); } ad.budget -= ad.costPerView; await ad.save(); user.points += ad.costPerView; await user.save(); await AdLog.create({ telegramId, adId }); res.json({ success: true, reward: ad.costPerView, newBalance: user.points, message: 'تمت إضافة المكافأة بنجاح' }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'خطأ داخلي' }); } 

});

app.listen(process.env.PORT || 5000, () => { console.log('🌐 Server is running...'); });
