const Job = require('../models/Job.model');
const Application = require('../models/Application.model');
const { success, error } = require('../utils/response.util');
const asyncHandler = require('../utils/asyncHandler');

const getJobs = asyncHandler(async (req, res) => {
  const {
    search, skills, category, experienceLevel,
    budgetType, minBudget, maxBudget, matchSkills,
    sort = 'newest', page = 1, limit = 12
  } = req.query;

  const query = { status: 'open' };

  // Filter to only include jobs from the past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  query.createdAt = { $gte: sevenDaysAgo };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  if (skills) query.skills = { $in: skills.split(',').map(s => new RegExp(s.trim(), 'i')) };
  if (category) query.category = { $regex: category, $options: 'i' };
  if (experienceLevel) query.experienceLevel = experienceLevel;
  if (budgetType) query['budget.type'] = budgetType;
  if (minBudget) query['budget.min'] = { $gte: Number(minBudget) };
  if (maxBudget) query['budget.max'] = { $lte: Number(maxBudget) };

  let forceZeroResults = false;

  // Filter by user skills if matchSkills is requested and user is authenticated
  if (matchSkills === 'true' && req.user) {
    const userSkills = req.user.skills || [];
    if (userSkills.length > 0) {
      const userSkillNames = userSkills.map(s => s.skill.trim()).filter(Boolean);
      if (userSkillNames.length > 0) {
        const skillsRegexes = userSkillNames.map(s => new RegExp(`^${s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i'));
        
        const matchQuery = {
          $or: [
            { skills: { $in: skillsRegexes } },
            { tags: { $in: skillsRegexes } }
          ]
        };
        
        if (query.$or) {
          const existingOr = query.$or;
          delete query.$or;
          query.$and = [
            { $or: existingOr },
            matchQuery
          ];
        } else {
          query.$or = matchQuery.$or;
        }
      } else {
        forceZeroResults = true;
      }
    } else {
      forceZeroResults = true;
    }
  }

  if (forceZeroResults) {
    return success(res, {
      jobs: [],
      total: 0,
      pages: 0,
      currentPage: Number(page)
    });
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    budget_high: { 'budget.max': -1 },
    budget_low: { 'budget.min': 1 },
    popular: { applicationCount: -1 }
  };

  const [jobs, total] = await Promise.all([
    Job.find(query)
      .populate('poster', 'name company avatar')
      .sort(sortMap[sort] || { createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean(),
    Job.countDocuments(query)
  ]);

  // Add saved status for authenticated users
  const userId = req.user?._id?.toString();
  const jobsWithSaved = jobs.map(job => ({
    ...job,
    isSaved: userId ? (job.savedBy || []).map(id => id.toString()).includes(userId) : false,
    savedBy: undefined
  }));

  return success(res, {
    jobs: jobsWithSaved,
    total,
    pages: Math.ceil(total / Number(limit)),
    currentPage: Number(page)
  });
});

const getJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id)
    .populate('poster', 'name company avatar location createdAt');

  if (!job) return error(res, 'Job not found', 404);

  await Job.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

  let hasApplied = false;
  let isSaved = false;

  if (req.user) {
    const app = await Application.findOne({ job: req.params.id, applicant: req.user._id });
    hasApplied = !!app;
    isSaved = job.savedBy.map(id => id.toString()).includes(req.user._id.toString());
  }

  const jobObj = job.toObject();
  delete jobObj.savedBy;

  return success(res, { ...jobObj, hasApplied, isSaved });
});

const createJob = asyncHandler(async (req, res) => {
  const { title, description, skills, budget, duration, experienceLevel, category, location, status } = req.body;
  if (!title || !description) return error(res, 'Title and description are required', 400);

  const job = await Job.create({
    title, description, poster: req.user._id,
    skills: Array.isArray(skills) ? skills : (skills || '').split(',').map(s => s.trim()).filter(Boolean),
    budget, duration, experienceLevel, category, location, status
  });

  return success(res, job, 'Job created', 201);
});

const updateJob = asyncHandler(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.id, poster: req.user._id });
  if (!job) return error(res, 'Job not found or unauthorized', 404);

  if (req.body.skills && typeof req.body.skills === 'string') {
    req.body.skills = req.body.skills.split(',').map(s => s.trim()).filter(Boolean);
  }

  const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  return success(res, updated, 'Job updated');
});

const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.id, poster: req.user._id });
  if (!job) return error(res, 'Job not found or unauthorized', 404);
  await job.deleteOne();
  return success(res, null, 'Job deleted');
});

const getMyJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ poster: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  return success(res, jobs);
});

const toggleSaveJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return error(res, 'Job not found', 404);

  const userId = req.user._id;
  const isSaved = job.savedBy.map(id => id.toString()).includes(userId.toString());

  if (isSaved) {
    job.savedBy = job.savedBy.filter(id => id.toString() !== userId.toString());
  } else {
    job.savedBy.push(userId);
  }

  await job.save();
  return success(res, { isSaved: !isSaved }, isSaved ? 'Job unsaved' : 'Job saved');
});

const getSavedJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ savedBy: req.user._id, status: 'open' })
    .populate('poster', 'name company avatar')
    .sort({ createdAt: -1 })
    .lean();

  const jobsWithSaved = jobs.map(job => ({ ...job, isSaved: true, savedBy: undefined }));
  return success(res, jobsWithSaved);
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await Job.distinct('category', { status: 'open' });
  const activeCategories = categories.filter(Boolean).sort();
  return success(res, activeCategories);
});

module.exports = { getJobs, getJob, createJob, updateJob, deleteJob, getMyJobs, toggleSaveJob, getSavedJobs, getCategories };
