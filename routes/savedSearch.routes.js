'use strict';

const router = require('express').Router();
const { protect }     = require('../middleware/auth.middleware');
const optionalAuth    = require('../middleware/optionalAuth.middleware');
const {
  getMySavedSearches,
  createSavedSearch,
  getSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  runSavedSearch,
  previewSearch,
} = require('../controllers/savedSearch.controller');

// All routes require authentication (jobseekers only — enforced inside controller by userId scope)
router.use(protect);

router.get(  '/preview',          previewSearch);      // GET  /api/saved-searches/preview
router.get(  '/',                  getMySavedSearches);  // GET  /api/saved-searches
router.post( '/',                  createSavedSearch);   // POST /api/saved-searches
router.get(  '/:id',              getSavedSearch);      // GET  /api/saved-searches/:id
router.put(  '/:id',              updateSavedSearch);   // PUT  /api/saved-searches/:id
router.delete('/:id',             deleteSavedSearch);   // DEL  /api/saved-searches/:id
router.post( '/:id/run',          runSavedSearch);      // POST /api/saved-searches/:id/run

module.exports = router;
