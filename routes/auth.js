const express = require('express');
const router = express.Router();

// مسار تجريبي لتسجيل الحسابات
router.post('/register', (req, res) => {
    res.json({ success: true, message: "تم تسجيل الحساب بنجاح في نظام Nexora" });
});

module.exports = router;
