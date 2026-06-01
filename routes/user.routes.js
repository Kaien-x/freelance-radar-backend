const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth.middleware');
const { uploadAvatar: avatarUpload, uploadResume: resumeUpload } = require('../services/upload.service');
const {
  getProfile, updateProfile, updateSkills,
  uploadAvatar, uploadResume, updateExperience
} = require('../controllers/user.controller');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/skills', updateSkills);
router.put('/experience', updateExperience);
router.post('/avatar', avatarUpload.single('avatar'), uploadAvatar);
router.post('/resume', resumeUpload.single('resume'), uploadResume);

// Serve resume with proper Content-Disposition header
router.get('/resume/download', protect, (req, res) => {
  try {
    const user = req.user;
    if (!user.resume || !user.resume.path) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const filePath = path.join(process.cwd(), user.resume.path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Resume file not found' });
    }

    // Get the filename, with fallback
    const filename = user.resume.filename || 'resume.pdf';
    
    // Ensure filename doesn't contain path separators
    const safeFilename = path.basename(filename);

    // Set proper Content-Disposition header
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'application/pdf');

    res.sendFile(filePath);
  } catch (error) {
    console.error('Resume download error:', error);
    res.status(500).json({ error: 'Failed to download resume' });
  }
});

module.exports = router;
