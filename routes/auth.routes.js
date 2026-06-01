const router = require('express').Router();
const { googleAuth, getMe, updateProfile, updateSkills } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Google OAuth – no password, no email verification needed
router.post('/google', googleAuth);

// Protected profile endpoints (unchanged)
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/skills', protect, updateSkills);

module.exports = router;
