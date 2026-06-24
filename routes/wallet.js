const express = require('express');
const router = express.Router();

// مسار تجريبي لاستلام طلبات السحب
router.post('/withdraw', (req, res) => {
    res.json({ success: true, message: "تم استلام طلب السحب للمراجعة" });
});

module.exports = router;
