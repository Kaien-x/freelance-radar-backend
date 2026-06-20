'use strict';

const ActivityLog = require('../models/ActivityLog.model');
const User        = require('../models/User.model');
const Waitlist    = require('../models/Waitlist.model');
const { success, error } = require('../utils/response.util');
const asyncHandler = require('../utils/asyncHandler');

// ── Called from frontend on page visit / job click ───────────────────────────
const logEvent = asyncHandler(async (req, res) => {
  const { event, page, meta } = req.body;
  if (!event) return error(res, 'event is required', 400);

  await ActivityLog.create({ user: req.user._id, event, page: page || null, meta: meta || null });
  return success(res, null, 'ok');
});

// ── Admin: summary list — one row per user ────────────────────────────────────
const getActivitySummary = asyncHandler(async (req, res) => {
  // Aggregate: for each user get total events, last seen, login count, pages visited
  const rows = await ActivityLog.aggregate([
    {
      $group: {
        _id:        '$user',
        lastSeen:   { $max: '$createdAt' },
        totalEvents:{ $sum: 1 },
        loginCount: { $sum: { $cond: [{ $eq: ['$event', 'login'] }, 1, 0] } },
        pages:      { $addToSet: '$page' },
        lastPage:   { $last: '$page' },
      },
    },
    { $sort: { lastSeen: -1 } },
    { $limit: 200 },
    {
      $lookup: {
        from:         'users',
        localField:   '_id',
        foreignField: '_id',
        as:           'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id:        0,
        userId:     '$_id',
        name:       '$user.name',
        email:      '$user.email',
        role:       '$user.role',
        avatar:     '$user.avatar',
        joinedAt:   '$user.createdAt',
        lastSeen:   1,
        totalEvents:1,
        loginCount: 1,
        pageCount:  { $size: { $filter: { input: '$pages', as: 'p', cond: { $ne: ['$$p', null] } } } },
        lastPage:   1,
      },
    },
  ]);

  return success(res, rows);
});

// ── Admin: full timeline for one user ─────────────────────────────────────────
const getUserTimeline = asyncHandler(async (req, res) => {
  const logs = await ActivityLog.find({ user: req.params.userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return success(res, logs);
});

// ── Admin: outreach email list ────────────────────────────────────────────────
// Returns waitlist signups + 10 most recent users who are NOT on the waitlist
const getOutreachList = asyncHandler(async (req, res) => {
  const [waitlistEntries, recentUsers] = await Promise.all([
    Waitlist.find().sort({ createdAt: -1 }).lean(),
    User.find({ role: { $ne: 'admin' } })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('name email createdAt role')
      .lean(),
  ]);

  const waitlistEmails = new Set(waitlistEntries.map(w => w.email.toLowerCase()));

  const nonWaitlistUsers = recentUsers
    .filter(u => !waitlistEmails.has(u.email.toLowerCase()))
    .slice(0, 10);

  return success(res, { waitlist: waitlistEntries, recentUsers: nonWaitlistUsers });
});

module.exports = { logEvent, getActivitySummary, getUserTimeline, getOutreachList };
