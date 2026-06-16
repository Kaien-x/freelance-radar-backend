'use strict';

const Feedback   = require('../models/Feedback.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response.util');
const { sendFeedbackAdminNotification } = require('../services/email.service');
const logger = require('../utils/logger');

// ─── Public / Authenticated ───────────────────────────────────────────────────

/**
 * POST /api/feedback
 * Anyone (logged in or not) can submit feedback.
 */
const submitFeedback = asyncHandler(async (req, res) => {
  const { name, email, type, subject, message, page } = req.body;

  if (!name?.trim())    return error(res, 'Name is required', 400);
  if (!email?.trim())   return error(res, 'Email is required', 400);
  if (!message?.trim()) return error(res, 'Message is required', 400);
  if (message.length < 10) return error(res, 'Message must be at least 10 characters', 400);

  const validTypes = ['bug', 'feature', 'feedback', 'contact'];
  const feedbackType = validTypes.includes(type) ? type : 'feedback';

  const feedback = await Feedback.create({
    userId:    req.user?._id || null,
    name:      name.trim(),
    email:     email.trim().toLowerCase(),
    type:      feedbackType,
    subject:   (subject || '').trim(),
    message:   message.trim(),
    userAgent: req.headers['user-agent'] || '',
    page:      (page || '').trim(),
  });

  // Notify admin asynchronously — don't let email failure block the response
  sendFeedbackAdminNotification(feedback).catch(err =>
    logger.error('Admin feedback notification failed:', err.message)
  );

  return success(res, { id: feedback._id }, 'Thank you for your feedback!', 201);
});

/**
 * GET /api/feedback/my
 * Authenticated users can see their own submissions.
 */
const getMyFeedback = asyncHandler(async (req, res) => {
  const items = await Feedback.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .select('-adminNotes -userAgent')
    .lean();
  return success(res, items);
});

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/feedback
 * Admin: list all feedback with optional filters.
 */
const getAllFeedback = asyncHandler(async (req, res) => {
  const { status, type, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (type)   query.type   = type;

  const [items, total] = await Promise.all([
    Feedback.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean(),
    Feedback.countDocuments(query),
  ]);

  return success(res, {
    items,
    total,
    pages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
  });
});

/**
 * GET /api/admin/feedback/:id
 */
const getFeedbackById = asyncHandler(async (req, res) => {
  const item = await Feedback.findById(req.params.id).populate('userId', 'name email').lean();
  if (!item) return error(res, 'Feedback not found', 404);

  // Mark as read when admin views it for the first time
  if (item.status === 'new') {
    await Feedback.findByIdAndUpdate(req.params.id, { status: 'read' });
    item.status = 'read';
  }

  return success(res, item);
});

/**
 * PATCH /api/admin/feedback/:id
 * Admin: update status and/or add notes.
 */
const updateFeedback = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  const validStatuses = ['new', 'read', 'in-progress', 'resolved', 'closed'];

  const update = {};
  if (status) {
    if (!validStatuses.includes(status)) return error(res, 'Invalid status', 400);
    update.status = status;
    if (status === 'resolved') update.resolvedAt = new Date();
  }
  if (adminNotes !== undefined) update.adminNotes = adminNotes;

  const item = await Feedback.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!item) return error(res, 'Feedback not found', 404);

  return success(res, item, 'Feedback updated');
});

/**
 * DELETE /api/admin/feedback/:id
 */
const deleteFeedback = asyncHandler(async (req, res) => {
  const item = await Feedback.findByIdAndDelete(req.params.id);
  if (!item) return error(res, 'Feedback not found', 404);
  return success(res, null, 'Feedback deleted');
});

/**
 * GET /api/admin/feedback/stats
 */
const getFeedbackStats = asyncHandler(async (req, res) => {
  const [byType, byStatus, total] = await Promise.all([
    Feedback.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    Feedback.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Feedback.countDocuments(),
  ]);
  return success(res, { total, byType, byStatus });
});

module.exports = {
  submitFeedback,
  getMyFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedback,
  deleteFeedback,
  getFeedbackStats,
};
