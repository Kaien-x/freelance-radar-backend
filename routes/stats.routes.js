const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User.model');
const Job = require('../models/Job.model');
const { success } = require('../utils/response.util');

// Public endpoint - no auth middleware
router.get('/', asyncHandler(async (req, res) => {
  const userCount = await User.countDocuments();
  const jobCount = await Job.countDocuments();
  return success(res, { userCount, jobCount });
}));

module.exports = router;
