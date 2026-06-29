const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const JWT_SECRET = 'nexora_super_secret_key_2026';

function readDatabase() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        const initial = { users: [], pendingDeposits: [], nextId: 1, depositIdCounter: 1 };
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
        return initial;
    }
}

function writeDatabase(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ===== تحويل النقاط إلى مستخدم آخر =====
router.post('/market/transfer-points', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'غير مصرح' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        let db = readDatabase();
        const sender = db.users.find(u => u.id === decoded.id);
        if (!sender) {
            return res.status(404).json({ message: 'المرسل غير موجود' });
        }

        const { recipientEmail, amount } = req.body;
        if (!recipientEmail || !amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'بيانات غير صحيحة' });
        }

        // البحث عن المستلم بالبريد
        const recipient = db.users.find(u => u.email === recipientEmail);
        if (!recipient) {
            return res.status(404).json({ message: 'المستلم غير موجود' });
        }
        if (recipient.id === sender.id) {
            return res.status(400).json({ message: 'لا يمكن التحويل لنفسك' });
        }
        if (amount > sender.balance) {
            return res.status(400).json({ message: 'رصيد غير كافٍ' });
        }

        // خصم من المرسل وإضافة للمستلم
        sender.balance = parseFloat((sender.balance - amount).toFixed(8));
        recipient.balance = parseFloat((recipient.balance + amount).toFixed(8));

        // تسجيل المعاملات لكلا الطرفين
        sender.transactions.push({
            type: 'transfer_sent',
            amount: amount,
            to: recipient.email,
            status: 'completed',
            timestamp: new Date().toISOString(),
        });
        recipient.transactions.push({
            type: 'transfer_received',
            amount: amount,
            from: sender.email,
            status: 'completed',
            timestamp: new Date().toISOString(),
        });

        writeDatabase(db);

        res.json({
            message: 'تم التحويل بنجاح',
            balance: sender.balance,
            transactions: sender.transactions.slice(-10).reverse(),
        });

    } catch (err) {
        return res.status(401).json({ message: 'توكن غير صالح' });
    }
});

module.exports = router;
