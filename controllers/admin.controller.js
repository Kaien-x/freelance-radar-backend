const EmailLog = require('../models/EmailLog.model');
const { success } = require('../utils/response.util');

const EMAIL_TYPES = ['verification', 'alert', 'digest', 'reset-password', 'welcome', 'general'];

/**
 * GET /api/admin/emails
 * Query: page, limit, status, type
 */
const getEmailLogs = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const { status, type } = req.query;

  const filter = {};
  if (status && ['sent', 'failed'].includes(status)) filter.status = status;
  if (type && EMAIL_TYPES.includes(type)) filter.type = type;

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    EmailLog.find(filter)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email'),
    EmailLog.countDocuments(filter),
  ]);

  return success(res, {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
};

/**
 * GET /api/admin/emails/stats
 */
const getEmailStats = async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalSent, totalFailed, sentToday, failedToday, byType] = await Promise.all([
    EmailLog.countDocuments({ status: 'sent' }),
    EmailLog.countDocuments({ status: 'failed' }),
    EmailLog.countDocuments({ status: 'sent', sentAt: { $gte: startOfToday } }),
    EmailLog.countDocuments({ status: 'failed', sentAt: { $gte: startOfToday } }),
    EmailLog.aggregate([
      { $match: { status: 'sent' } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ]);

  const breakdownByType = EMAIL_TYPES.reduce((acc, t) => {
    acc[t] = 0;
    return acc;
  }, {});

  byType.forEach(({ _id, count }) => {
    if (_id) breakdownByType[_id] = count;
  });

  return success(res, {
    totalSent,
    totalFailed,
    sentToday,
    failedToday,
    breakdownByType,
  });
};

module.exports = { getEmailLogs, getEmailStats };
