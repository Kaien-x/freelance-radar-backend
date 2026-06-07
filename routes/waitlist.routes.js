const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { joinWaitlist, adminGetWaitlist, adminDeleteWaitlist } = require('../controllers/waitlist.controller');

// Public endpoint
router.post('/', joinWaitlist);

// Admin endpoints (mounted under /api/admin/waitlist)
const adminRouter = express.Router();
adminRouter.use(protect);
adminRouter.use(requireRole('admin'));
adminRouter.get('/', adminGetWaitlist);
adminRouter.delete('/:id', adminDeleteWaitlist);

module.exports = { public: router, admin: adminRouter };
