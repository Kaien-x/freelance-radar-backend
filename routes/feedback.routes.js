'use strict';

const router = require('express').Router();
const { protect }      = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/role.middleware');
const optionalAuth     = require('../middleware/optionalAuth.middleware');
const {
  submitFeedback,
  getMyFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedback,
  deleteFeedback,
  getFeedbackStats,
} = require('../controllers/feedback.controller');

// ── Public / authenticated user routes ────────────────────────────────────────
router.post('/',    optionalAuth, submitFeedback);  // anyone can submit
router.get('/my',   protect, getMyFeedback);        // view own submissions

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get(  '/admin/stats',  protect, requireRole('admin'), getFeedbackStats);
router.get(  '/admin',        protect, requireRole('admin'), getAllFeedback);
router.get(  '/admin/:id',    protect, requireRole('admin'), getFeedbackById);
router.patch('/admin/:id',    protect, requireRole('admin'), updateFeedback);
router.delete('/admin/:id',   protect, requireRole('admin'), deleteFeedback);

module.exports = router;
