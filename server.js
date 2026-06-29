const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// استيراد المسارات
const authRoutes = require('./routes/auth');
const miningRoutes = require('./routes/mining');
const walletRoutes = require('./routes/wallet');
const marketRoutes = require('./routes/market');

// تفعيل المسارات
app.use('/api', authRoutes);
app.use('/api', miningRoutes);
app.use('/api', walletRoutes);
app.use('/api', marketRoutes);

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Nexora server running on port ${PORT}`);
});
