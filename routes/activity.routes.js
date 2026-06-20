'use strict';

const router = require('express').Router();
const { protect }     = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const {
  logEvent,
  getActivitySummary,
  getUserTimeline,
  getOutreachList,
} = require('../controllers/activity.controller');

// User-facing — log events from the frontend
router.post('/', protect, logEvent);

// Admin-only
router.get('/summary',         protect, requireRole('admin'), getActivitySummary);
router.get('/user/:userId',    protect, requireRole('admin'), getUserTimeline);
router.get('/outreach-list',   protect, requireRole('admin'), getOutreachList);

module.exports = router;
