const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const User = require('../models/User.model');
const Job = require('../models/Job.model');
const Application = require('../models/Application.model');
const { success } = require('../utils/response.util');
const asyncHandler = require('../utils/asyncHandler');
const { getEmailLogs, getEmailStats } = require('../controllers/admin.controller');

console.log('Admin routes initialized');
//router.use(protect, requireRole('admin'));
router.get('/stats', asyncHandler(async (req, res) => {
  const [users, jobs, applications] = await Promise.all([
    User.countDocuments(),
    Job.countDocuments(),
    Application.countDocuments(),
  ]);
  return success(res, { users, jobs, applications });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  return success(res, users);
}));

router.put('/users/:id/toggle', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  user.isActive = !user.isActive;
  await user.save();
  return success(res, user, `User ${user.isActive ? 'activated' : 'deactivated'}`);
}));

router.get('/jobs', asyncHandler(async (req, res) => {
  const jobs = await Job.find().populate('poster', 'name email').sort({ createdAt: -1 });
  return success(res, jobs);
}));

// ─── Email Logs ───────────────────────────────────────────────────────────────
router.get('/emails/stats', protect, requireRole('admin'), asyncHandler(getEmailStats));
router.get('/emails', protect, requireRole('admin'), asyncHandler(getEmailLogs));

module.exports = router;
