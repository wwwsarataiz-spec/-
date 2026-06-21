// ==========================================
// models/AdminLog.js - سجل العمليات الإدارية
// ==========================================

const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
    adminId: { type: String, required: true },
    action: { type: String, required: true },
    targetId: { type: String, default: '' },
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
});

const AdminLog = mongoose.model('AdminLog', AdminLogSchema);
module.exports = { AdminLog };
