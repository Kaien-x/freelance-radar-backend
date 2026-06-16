const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  poster: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  skills: [{ type: String, trim: true }],
  budget: {
    type: { type: String, enum: ['fixed', 'hourly'], default: 'fixed' },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 }
  },
  duration: {
    type: String,
    enum: ['less_1_month', '1_3_months', '3_6_months', '6_plus_months'],
    default: '1_3_months'
  },
  experienceLevel: {
    type: String,
    enum: ['entry', 'intermediate', 'expert'],
    default: 'intermediate'
  },
  category: { type: String, default: 'General' },
  location: { type: String, default: 'Remote' },
  status: {
    type: String,
    enum: ['open', 'closed', 'draft'],
    default: 'open'
  },
  source: { type: String, enum: ['platform', 'reddit'], default: 'platform' },
  redditPostId: { type: String, default: null, sparse: true, index: { unique: true } },
  redditUrl: { type: String, default: null },
  subreddit: { type: String, default: null }, // Reddit community name
  author: { type: String, default: null }, // Reddit username
  upvotes: { type: Number, default: 0 }, // Reddit upvotes
  commentsCount: { type: Number, default: 0 }, // Reddit comments
  thumbnail: { type: String, default: null }, // Reddit thumbnail
  tags: [{ type: String }], // Skills/tags
  jobType: { type: String, default: 'freelance' }, // Job type
  permalink: { type: String, default: null }, // Reddit permalink
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  applicationCount: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
}, { timestamps: true });

/**
 * Bulk‑insert an array of job documents.
 * Uses upsert semantics on `redditPostId` to avoid duplicates.
 * @param {Array<Object>} jobs - Plain job objects.
 * @returns {Promise<number>} Number of newly inserted documents.
 */
jobSchema.statics.bulkInsert = async function (jobs) {
  const bulkOps = jobs.map(job => ({
    updateOne: {
      filter: { redditPostId: job.redditPostId },
      update: job,
      upsert: true
    }
  }));
  const result = await this.bulkWrite(bulkOps, { ordered: false });
  // `nInserted` is the count of brand‑new docs, `nUpserted` includes both insert & update.
  return result.nInserted || 0;
};

/**
 * Bulk‑delete jobs matching a filter.
 * Useful for periodic cleanup of stale or orphaned listings.
 * @param {Object} filter - MongoDB query filter.
 * @returns {Promise<number>} Number of documents deleted.
 */
jobSchema.statics.bulkDelete = async function (filter) {
  const result = await this.deleteMany(filter);
  return result.deletedCount || 0;
};

module.exports = mongoose.model('JobPost', jobSchema);
