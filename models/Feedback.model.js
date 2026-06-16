'use strict';

const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  // Submitter info (name/email required so admin can reply)
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name:    { type: String, required: true, trim: true, maxlength: 120 },
  email:   { type: String, required: true, lowercase: true, trim: true },

  // Type of submission
  type: {
    type: String,
    enum: ['bug', 'feature', 'feedback', 'contact'],
    required: true,
    default: 'feedback',
  },

  subject: { type: String, trim: true, maxlength: 200, default: '' },
  message: { type: String, required: true, minlength: 10, maxlength: 5000 },

  // Admin workflow
  status: {
    type: String,
    enum: ['new', 'read', 'in-progress', 'resolved', 'closed'],
    default: 'new',
  },
  adminNotes: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },

  // Context
  userAgent: { type: String, default: '' },
  page:      { type: String, default: '' }, // which page the user was on
}, { timestamps: true });

feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ type: 1 });
feedbackSchema.index({ userId: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
