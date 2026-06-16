'use strict';

const mongoose = require('mongoose');

const PLAN_LIMITS = { free: 3, pro: 10, agency: 999 };

const savedSearchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Human-readable label shown in UI
  name: { type: String, required: true, trim: true, maxlength: 80 },

  // Mirrors the filters accepted by GET /api/jobs
  filters: {
    search:          { type: String, default: '' },
    category:        { type: String, default: '' },
    skills:          [{ type: String }],
    minBudget:       { type: Number, default: null },
    maxBudget:       { type: Number, default: null },
    budgetType:      { type: String, enum: ['fixed', 'hourly', ''], default: '' },
    experienceLevel: { type: String, enum: ['entry', 'intermediate', 'expert', ''], default: '' },
    source:          { type: String, enum: ['reddit', 'platform', ''], default: '' },
    subreddit:       { type: String, default: '' },
    sort:            { type: String, default: 'newest' },
  },

  // Notification settings
  notificationsEnabled: { type: Boolean, default: false },
  lastNotifiedAt:       { type: Date, default: null },

  // Audit
  lastRunAt:   { type: Date, default: null },
  resultCount: { type: Number, default: 0 },
}, { timestamps: true });

savedSearchSchema.index({ userId: 1, createdAt: -1 });
savedSearchSchema.index({ notificationsEnabled: 1 });

/**
 * Enforce per-plan limits before saving a new document.
 */
savedSearchSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const user = await mongoose.model('User').findById(this.userId).select('plan').lean();
  const limit = PLAN_LIMITS[(user?.plan || 'free')] ?? 3;
  const count = await mongoose.model('SavedSearch').countDocuments({ userId: this.userId });
  if (count >= limit) {
    const err = new Error(`Saved search limit reached (${limit} for your plan). Upgrade to save more.`);
    err.status = 403;
    return next(err);
  }
  next();
});

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
