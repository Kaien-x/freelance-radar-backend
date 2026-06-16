'use strict';

const SavedSearch  = require('../models/SavedSearch.model');
const Job          = require('../models/Job.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response.util');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildJobQuery = (filters = {}) => {
  const query = { status: 'open', isSpam: { $ne: true } };
  query.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };

  if (filters.search) {
    query.$or = [
      { title:       { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
    ];
  }
  if (filters.category)        query.category         = { $regex: filters.category, $options: 'i' };
  if (filters.skills?.length)  {
    const regs = filters.skills.map(s => new RegExp(s, 'i'));
    query.$or  = [...(query.$or || []), { skills: { $in: regs } }, { tags: { $in: regs } }];
  }
  if (filters.experienceLevel) query.experienceLevel  = filters.experienceLevel;
  if (filters.budgetType)      query['budget.type']   = filters.budgetType;
  if (filters.minBudget)       query['budget.min']    = { $gte: Number(filters.minBudget) };
  if (filters.maxBudget)       query['budget.max']    = { $lte: Number(filters.maxBudget) };
  if (filters.source)          query.source           = filters.source;
  if (filters.subreddit)       query.subreddit        = filters.subreddit;

  return query;
};

const SORT_MAP = {
  newest:    { createdAt: -1 },
  oldest:    { createdAt: 1 },
  trending:  { upvotes: -1 },
  popular:   { applicationCount: -1 },
  budget_high: { 'budget.max': -1 },
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/saved-searches
 */
const getMySavedSearches = asyncHandler(async (req, res) => {
  const searches = await SavedSearch.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  return success(res, searches);
});

/**
 * POST /api/saved-searches
 */
const createSavedSearch = asyncHandler(async (req, res) => {
  const { name, filters = {}, notificationsEnabled = false } = req.body;

  if (!name?.trim()) return error(res, 'A name for the saved search is required', 400);

  // Sanitise filters — only allow known keys
  const allowedKeys = ['search', 'category', 'skills', 'minBudget', 'maxBudget',
                       'budgetType', 'experienceLevel', 'source', 'subreddit', 'sort'];
  const cleanFilters = {};
  for (const key of allowedKeys) {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      cleanFilters[key] = filters[key];
    }
  }

  const search = await SavedSearch.create({
    userId:               req.user._id,
    name:                 name.trim(),
    filters:              cleanFilters,
    notificationsEnabled: Boolean(notificationsEnabled),
  });

  return success(res, search, 'Saved search created', 201);
});

/**
 * GET /api/saved-searches/:id
 */
const getSavedSearch = asyncHandler(async (req, res) => {
  const search = await SavedSearch.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!search) return error(res, 'Saved search not found', 404);
  return success(res, search);
});

/**
 * PUT /api/saved-searches/:id
 */
const updateSavedSearch = asyncHandler(async (req, res) => {
  const { name, filters, notificationsEnabled } = req.body;

  const search = await SavedSearch.findOne({ _id: req.params.id, userId: req.user._id });
  if (!search) return error(res, 'Saved search not found', 404);

  if (name !== undefined)                  search.name                 = name.trim();
  if (notificationsEnabled !== undefined)  search.notificationsEnabled = Boolean(notificationsEnabled);

  if (filters !== undefined) {
    const allowedKeys = ['search', 'category', 'skills', 'minBudget', 'maxBudget',
                         'budgetType', 'experienceLevel', 'source', 'subreddit', 'sort'];
    for (const key of allowedKeys) {
      if (filters[key] !== undefined) search.filters[key] = filters[key];
    }
    search.markModified('filters');
  }

  await search.save();
  return success(res, search, 'Saved search updated');
});

/**
 * DELETE /api/saved-searches/:id
 */
const deleteSavedSearch = asyncHandler(async (req, res) => {
  const search = await SavedSearch.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!search) return error(res, 'Saved search not found', 404);
  return success(res, null, 'Saved search deleted');
});

// ─── Run / preview ────────────────────────────────────────────────────────────

/**
 * POST /api/saved-searches/:id/run
 * Execute the saved search and return matching jobs.
 */
const runSavedSearch = asyncHandler(async (req, res) => {
  const search = await SavedSearch.findOne({ _id: req.params.id, userId: req.user._id });
  if (!search) return error(res, 'Saved search not found', 404);

  const { page = 1, limit = 12 } = req.query;
  const query = buildJobQuery(search.filters);
  const sort  = SORT_MAP[search.filters.sort] || { createdAt: -1 };

  const [jobs, total] = await Promise.all([
    Job.find(query)
      .populate('poster', 'name company avatar')
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean(),
    Job.countDocuments(query),
  ]);

  // Update audit fields
  search.lastRunAt   = new Date();
  search.resultCount = total;
  await search.save();

  const userId = req.user._id.toString();
  const jobsWithSaved = jobs.map(job => ({
    ...job,
    isSaved: (job.savedBy || []).map(id => id.toString()).includes(userId),
    savedBy: undefined,
  }));

  return success(res, {
    jobs: jobsWithSaved,
    total,
    pages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    savedSearch: { id: search._id, name: search.name, filters: search.filters },
  });
});

/**
 * GET /api/saved-searches/preview
 * Preview results for a filter set without saving.
 */
const previewSearch = asyncHandler(async (req, res) => {
  const filters = {
    search:          req.query.search,
    category:        req.query.category,
    skills:          req.query.skills ? req.query.skills.split(',') : [],
    minBudget:       req.query.minBudget,
    maxBudget:       req.query.maxBudget,
    budgetType:      req.query.budgetType,
    experienceLevel: req.query.experienceLevel,
    source:          req.query.source,
    subreddit:       req.query.subreddit,
    sort:            req.query.sort || 'newest',
  };

  const query = buildJobQuery(filters);
  const sort  = SORT_MAP[filters.sort] || { createdAt: -1 };
  const limit = Math.min(Number(req.query.limit) || 12, 25);
  const page  = Number(req.query.page) || 1;

  const [jobs, total] = await Promise.all([
    Job.find(query)
      .populate('poster', 'name company avatar')
      .sort(sort)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean(),
    Job.countDocuments(query),
  ]);

  return success(res, { jobs, total, pages: Math.ceil(total / limit), currentPage: page });
});

module.exports = {
  getMySavedSearches,
  createSavedSearch,
  getSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  runSavedSearch,
  previewSearch,
};
