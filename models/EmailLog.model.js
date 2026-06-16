const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  to:      { type: String, required: true },
  subject: { type: String, required: true },
  body:    { type: String, required: true },
  type: {
    type: String,
    enum: ['verification', 'alert', 'digest', 'reset-password', 'welcome', 'general', 'job-alert', 'saved-search-alert', 'feedback'],
    default: 'general',
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    required: true,
  },
  error:  { type: String, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sentAt: { type: Date, default: Date.now },
});

emailLogSchema.index({ sentAt: -1 });
emailLogSchema.index({ status: 1 });
emailLogSchema.index({ type: 1 });

const EmailLog = mongoose.model('EmailLog', emailLogSchema);
module.exports = EmailLog;
