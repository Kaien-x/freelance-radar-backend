const mongoose = require('mongoose');

/**
 * Stores metadata about discovered Reddit communities.
 * Allows the sync service to fetch only active subreddits and track their health.
 */
const SubredditMetaSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  subscribers: { type: Number, required: true },
  lastChecked: { type: Number, required: true }, // epoch ms of last discovery check
  version: { type: Number, default: 0 },
  // optional field to store discovery notes or tags
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('SubredditMeta', SubredditMetaSchema);
