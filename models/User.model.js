const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Core identity
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  googleId: { type: String, unique: true, sparse: true },   // Google OAuth sub
  avatar:   { type: String, default: null },

  // Auth – password is optional (not needed for Google-only accounts)
  password: { type: String, required: false, minlength: 8, default: null },

  // Password reset
  passwordResetToken:   { type: String, default: null },
  passwordResetExpires: { type: Date,   default: null },

  // Role / status
  role:     { type: String, enum: ['jobseeker', 'jobposter', 'admin'], default: 'jobseeker' },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationOtp: { type: String, default: null },
  emailVerificationExpires: { type: Date, default: null },

  // Onboarding
  onboardingComplete: { type: Boolean, default: false },
  profileCompleted:   { type: Boolean, default: false },

  // Job Seeker specific
  title:      { type: String, default: '' },
  bio:        { type: String, default: '' },
  skills:     [{ skill: String, level: { type: String, enum: ['beginner', 'intermediate', 'expert'] }, years: Number }],
  resume:     { filename: String, path: String, uploadedAt: Date },
  hourlyRate: { min: Number, max: Number },

  // Job Poster specific
  company: { name: String, website: String, description: String, logo: String },

  // Common profile fields
  location: { type: String, default: '' },
  website:  { type: String, default: '' },
  social:   { linkedin: String, github: String, twitter: String },
  plan:     { type: String, enum: ['free', 'pro', 'agency'], default: 'free' },
}, { timestamps: true });

// Hash password before save (only if set and modified)
userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationOtp;
  delete obj.emailVerificationExpires;
  return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
