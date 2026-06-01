const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/avatars';
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar_${uniqueSuffix}${ext}`);
  }
});

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/resumes';
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const basename = path.basename(file.originalname, ext);
    
    // Sanitize the basename - remove problematic characters and "(anonymous)"
    let cleanName = basename
      .replace(/\(anonymous\)/gi, 'resume')
      .replace(/[^a-z0-9\-_]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 50) // Limit length
      .trim();
    
    // If cleaning resulted in empty or just "resume", use a default
    if (!cleanName || cleanName === 'resume') {
      cleanName = 'resume';
    }
    
    const timestamp = Date.now();
    cb(null, `${cleanName}_${timestamp}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|avif/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const resumeFilter = (req, file, cb) => {
  const allowed = /pdf|doc|docx/;
  if (allowed.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word files are allowed'), false);
  }
};

const uploadAvatar = multer({ storage: avatarStorage, fileFilter: imageFilter, limits: { fileSize: 3 * 1024 * 1024 } });
const uploadResume = multer({ storage: resumeStorage, fileFilter: resumeFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { uploadAvatar, uploadResume };
