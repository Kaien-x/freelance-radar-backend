const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  poster: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Optional for Reddit jobs
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

  // Spam detection fields
  isSpam:        { type: Boolean, default: false },
  spamScore:     { type: Number,  default: 0 },
  spamReasons:   [{ type: String }],
  spamCheckedAt: { type: Date,    default: null },
}, { timestamps: true });

jobSchema.index({ isSpam: 1, status: 1, createdAt: -1 });
jobSchema.index({ source: 1, spamCheckedAt: 1 });

/**
 * Upsert a batch of jobs by redditPostId (deduplication).
 * Returns the count of genuinely new documents.
 */
jobSchema.statics.bulkInsert = async function (jobs) {
  if (!jobs || jobs.length === 0) return 0;

  const ops = jobs.map(job => ({
    updateOne: {
      filter: { redditPostId: job.redditPostId },
      update: { $setOnInsert: job },
      upsert: true,
    },
  }));

  const result = await this.bulkWrite(ops, { ordered: false });
  return result.upsertedCount || 0;
};

module.exports = mongoose.model('Job', jobSchema);
