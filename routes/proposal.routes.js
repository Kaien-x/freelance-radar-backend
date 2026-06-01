const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { generate, getMyProposals, updateProposal, deleteProposal } = require('../controllers/proposal.controller');

router.post('/generate', protect, requireRole('jobseeker'), generate);
router.get('/', protect, requireRole('jobseeker'), getMyProposals);
router.patch('/:id', protect, requireRole('jobseeker'), updateProposal);
router.delete('/:id', protect, requireRole('jobseeker'), deleteProposal);

module.exports = router;
