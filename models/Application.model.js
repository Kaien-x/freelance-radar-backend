const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposal: { type: String, required: true, minlength: 50 },
  status: { type: String, enum: ['pending', 'viewed', 'shortlisted', 'rejected', 'hired'], default: 'pending' },
  coverLetter: { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },
  bidAmount: { type: Number, default: null },
  withdrawnAt: { type: Date, default: null }
}, { timestamps: true });

applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
