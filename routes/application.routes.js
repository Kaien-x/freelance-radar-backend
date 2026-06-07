const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const {
  getMyApplications,
  getApplication,
  applyToJob,
  withdrawApplication,
  getJobApplicants,
  updateApplicationStatus,
  checkApplied
} = require('../controllers/application.controller');

router.use(protect);

router.get('/', requireRole('jobseeker'), getMyApplications);
router.get('/check/:jobId', requireRole('jobseeker'), checkApplied);
router.post('/', requireRole('jobseeker'), applyToJob);
router.get('/:id', getApplication);
router.delete('/:id', requireRole('jobseeker'), withdrawApplication);
router.get('/job/:jobId', requireRole('jobposter'), getJobApplicants);
router.patch('/:id/status', requireRole('jobposter'), updateApplicationStatus);

module.exports = router;
