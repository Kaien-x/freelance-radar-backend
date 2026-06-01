const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  jobTitle: { type: String, default: '' },
  jobDescription: { type: String, default: '' },
  content: { type: String, required: true },
  tone: {
    type: String,
    enum: ['professional', 'friendly', 'technical', 'creative'],
    default: 'professional'
  },
  wordCount: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
  isFavorite: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Proposal', proposalSchema);
