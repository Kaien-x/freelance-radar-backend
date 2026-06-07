const router = require('express').Router();
const {
  googleAuth,
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  updateSkills,
  getAllSkills,
  verifyEmailOTP,
  resendVerificationOTP,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// ─── Google OAuth ─────────────────────────────────────────────────────────────
router.post('/google', googleAuth);

// ─── Email / Password Auth ────────────────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// ─── Email Verification ───────────────────────────────────────────────────────
router.post('/verify-email', protect, verifyEmailOTP);
router.post('/resend-verification', protect, resendVerificationOTP);

// ─── Protected Profile endpoints ──────────────────────────────────────────────
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/skills', protect, getAllSkills);
router.put('/skills', protect, updateSkills);

module.exports = router;
