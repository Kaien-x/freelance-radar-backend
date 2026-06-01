const { getRedditJobs, getRedditStats } = require('../services/reddit.service');
const { triggerSync } = require('../services/cron.service');
const { success, error } = require('../utils/response.util');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const Job = require('../models/Job.model');

/**
 * Get Reddit jobs with filtering and pagination
 */
const getRedditJobsList = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    subreddit,
    search,
    sortBy = 'newest'
  } = req.query;

  const result = await getRedditJobs({
    page: Number(page),
    limit: Number(limit),
    subreddit: subreddit || null,
    search: search || null,
    sortBy: sortBy || 'newest'
  });

  return success(res, result);
});

/**
 * Get a single Reddit job by ID
 */
const getRedditJobById = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job || job.source !== 'reddit') {
    return error(res, 'Reddit job not found', 404);
  }

  // Increment views
  await Job.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

  return success(res, job);
});

/**
 * Get Reddit job statistics
 */
const getStats = asyncHandler(async (req, res) => {
  const stats = await getRedditStats();
  return success(res, stats);
});

/**
 * Get available subreddits
 */
const getSubreddits = asyncHandler(async (req, res) => {
  const { REDDIT_COMMUNITIES } = require('../services/reddit.service');
  
  const subredditStats = await Job.aggregate([
    { $match: { source: 'reddit' } },
    { $group: { _id: '$subreddit', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Map to readable format
  const result = subredditStats.map(item => ({
    name: item._id,
    jobCount: item.count,
  }));

  return success(res, {
    configured: REDDIT_COMMUNITIES,
    available: result,
    total: result.reduce((sum, r) => sum + r.jobCount, 0)
  });
});

/**
 * Manual sync trigger (Admin only - optional)
 * For testing and immediate refresh
 */
const manualSync = asyncHandler(async (req, res) => {
  // Optional: Add role check here
  // if (req.user?.role !== 'admin') {
  //   return error(res, 'Only admins can trigger sync', 403);
  // }

  logger.info('Manual sync initiated by user');
  
  const results = await triggerSync();
  
  return success(res, results, 'Reddit job sync completed', 202);
});

/**
 * Get sync status/logs (optional for debugging)
 */
const getSyncStatus = asyncHandler(async (req, res) => {
  const jobCount = await Job.countDocuments({ source: 'reddit' });
  const lastCreated = await Job.findOne({ source: 'reddit' })
    .sort({ createdAt: -1 })
    .lean();

  return success(res, {
    totalRedditJobs: jobCount,
    lastJobCreated: lastCreated?.createdAt || null,
    lastJobTitle: lastCreated?.title || null,
  });
});

/**
 * Search Reddit jobs
 */
const searchRedditJobs = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 12 } = req.query;

  if (!q || q.trim().length === 0) {
    return error(res, 'Search query required', 400);
  }

  const result = await getRedditJobs({
    page: Number(page),
    limit: Number(limit),
    search: q.trim(),
    sortBy: 'newest'
  });

  return success(res, result);
});

module.exports = {
  getRedditJobsList,
  getRedditJobById,
  getStats,
  getSubreddits,
  manualSync,
  getSyncStatus,
  searchRedditJobs,
};
