const express = require('express');
const router = express.Router();

router.get('/login-test', (req, res) => {
    res.json({ message: "مرحباً بك! نظام تسجيل الدخول يعمل بنجاح." });
});

module.exports = router;
