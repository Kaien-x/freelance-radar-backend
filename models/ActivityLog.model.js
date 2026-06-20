'use strict';

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: String, required: true },   // 'login', 'page_view', 'job_click'
  page:  { type: String, default: null },     // 'dashboard', 'jobs', 'profile', etc.
  meta:  { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

// Index for fast admin queries: all activity for a user, newest first
activityLogSchema.index({ user: 1, createdAt: -1 });
// Index for last-seen queries across all users
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
