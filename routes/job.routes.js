const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const optionalAuth = require('../middleware/optionalAuth.middleware');
const {
  getJobs, getJob, createJob, updateJob,
  deleteJob, getMyJobs, toggleSaveJob, getSavedJobs,
  getCategories
} = require('../controllers/job.controller');

router.get('/', optionalAuth, getJobs);
router.get('/categories', getCategories);
router.get('/my-jobs', protect, requireRole('jobposter'), getMyJobs);
router.get('/saved', protect, requireRole('jobseeker'), getSavedJobs);
router.post('/', protect, requireRole('jobposter'), createJob);
// :id route with regex to only match valid MongoDB ObjectIds (24 hex characters)
router.get('/:id([0-9a-fA-F]{24})', optionalAuth, getJob);
router.put('/:id([0-9a-fA-F]{24})', protect, requireRole('jobposter'), updateJob);
router.delete('/:id([0-9a-fA-F]{24})', protect, requireRole('jobposter'), deleteJob);
router.post('/:id([0-9a-fA-F]{24})/save', protect, requireRole('jobseeker'), toggleSaveJob);

module.exports = router;
