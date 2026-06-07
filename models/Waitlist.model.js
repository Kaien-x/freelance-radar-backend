const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, default: '' },
  source: { type: String, default: 'landing-page' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Waitlist', waitlistSchema);
