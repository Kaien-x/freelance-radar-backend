const router = require('express').Router();
const optionalAuth = require('../middleware/optionalAuth.middleware');
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const {
  getRedditJobsList,
  getRedditJobById,
  getStats,
  getSubreddits,
  manualSync,
  getSyncStatus,
  searchRedditJobs,
} = require('../controllers/reddit.controller');

/**
 * GET /api/jobs/reddit
 * Get all Reddit jobs with pagination and filtering
 * Query: page, limit, subreddit, search, sortBy
 */
router.get('/', optionalAuth, getRedditJobsList);

/**
 * GET /api/jobs/reddit/stats
 * Get statistics about Reddit jobs
 */
router.get('/stats', getStats);

/**
 * GET /api/jobs/reddit/subreddits
 * Get available subreddits with job counts
 */
router.get('/subreddits', getSubreddits);

/**
 * GET /api/jobs/reddit/sync/status
 * Get sync status and last update info
 */
router.get('/sync/status', getSyncStatus);

/**
 * POST /api/jobs/reddit/sync
 * Manually trigger sync (optional - for testing)
 * NOTE: Add authentication/admin check if desired
 */
router.post('/sync', protect, requireRole('admin'), manualSync);

/**
 * GET /api/jobs/reddit/search
 * Search Reddit jobs by query
 * Query: q (search query), page, limit
 */
router.get('/search', optionalAuth, searchRedditJobs);

/**
 * GET /api/jobs/reddit/:id
 * Get single Reddit job by ID
 */
router.get('/:id', optionalAuth, getRedditJobById);

module.exports = router;
