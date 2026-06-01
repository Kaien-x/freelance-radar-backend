const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Resume = require('../models/Resume');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/resumes');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `resume-${req.user.id}-${uniqueSuffix}.pdf`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Upload resume
router.post('/', auth, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const relativePath = path.relative(path.join(__dirname, '../'), filePath);

    // Delete existing resume if any
    const existingResume = await Resume.findByUserId(req.user.id);
    if (existingResume) {
      try {
        await fs.unlink(existingResume.file_path);
        await Resume.deleteByUserId(req.user.id);
      } catch (error) {
        console.error('Error deleting existing resume:', error);
      }
    }

    // Create new resume record
    const resume = await Resume.create(req.user.id, relativePath);

    res.status(201).json({
      message: 'Resume uploaded successfully',
      resume: {
        id: resume.id,
        file_path: resume.file_path,
        created_at: resume.created_at
      }
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    
    if (error.message === 'Only PDF files are allowed') {
      return res.status(400).json({ error: error.message });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

// Get user resume
router.get('/', auth, async (req, res) => {
  try {
    const resume = await Resume.findByUserId(req.user.id);
    
    if (!resume) {
      return res.status(404).json({ error: 'No resume found' });
    }

    res.json({
      resume: {
        id: resume.id,
        file_path: resume.file_path,
        content: resume.content,
        created_at: resume.created_at,
        updated_at: resume.updated_at
      }
    });
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({ error: 'Failed to get resume' });
  }
});

// Download resume
router.get('/download', auth, async (req, res) => {
  try {
    const resume = await Resume.findByUserId(req.user.id);
    
    if (!resume) {
      return res.status(404).json({ error: 'No resume found' });
    }

    const filePath = path.join(__dirname, '../', resume.file_path);
    
    try {
      await fs.access(filePath);
      res.download(filePath, `resume-${req.user.id}.pdf`);
    } catch (error) {
      res.status(404).json({ error: 'Resume file not found' });
    }
  } catch (error) {
    console.error('Download resume error:', error);
    res.status(500).json({ error: 'Failed to download resume' });
  }
});

// Delete resume
router.delete('/', auth, async (req, res) => {
  try {
    const resume = await Resume.findByUserId(req.user.id);
    
    if (!resume) {
      return res.status(404).json({ error: 'No resume found' });
    }

    // Delete file
    try {
      await fs.unlink(path.join(__dirname, '../', resume.file_path));
    } catch (error) {
      console.error('Error deleting resume file:', error);
    }

    // Delete database record
    await Resume.deleteByUserId(req.user.id);

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

module.exports = router;
