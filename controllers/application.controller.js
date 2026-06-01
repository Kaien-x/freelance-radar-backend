const Application = require('../models/Application.model');
const Job = require('../models/Job.model');
const { success, error } = require('../utils/response.util');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/applications — get logged-in user's applications
const getMyApplications = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 10 } = req.query;
  const query = { applicant: req.user._id };

  if (status && status !== 'all') query.status = status;

  let applications = await Application.find(query)
    .populate({
      path: 'job',
      select: 'title description skills budget location status poster category',
      populate: { path: 'poster', select: 'name company avatar' }
    })
    .sort({ createdAt: -1 })
    .lean();

  // search filter after populate
  if (search) {
    const term = search.toLowerCase();
    applications = applications.filter(app =>
      app.job?.title?.toLowerCase().includes(term) ||
      app.job?.poster?.name?.toLowerCase().includes(term) ||
      app.job?.poster?.company?.name?.toLowerCase().includes(term)
    );
  }

  const total = applications.length;
  const paginated = applications.slice((page - 1) * limit, page * limit);

  return success(res, {
    applications: paginated,
    total,
    pages: Math.ceil(total / limit),
    currentPage: Number(page)
  });
});

// GET /api/applications/:id — get single application
const getApplication = asyncHandler(async (req, res) => {
  const application = await Application.findOne({
    _id: req.params.id,
    applicant: req.user._id
  }).populate({
    path: 'job',
    populate: { path: 'poster', select: 'name company avatar location' }
  });

  if (!application) return error(res, 'Application not found', 404);
  return success(res, application);
});

// POST /api/applications — apply to a job
const applyToJob = asyncHandler(async (req, res) => {
  const { jobId, proposal, coverLetter, bidAmount } = req.body;

  if (!jobId || !proposal) return error(res, 'Job ID and proposal are required', 400);
  if (proposal.length < 50) return error(res, 'Proposal must be at least 50 characters', 400);

  const job = await Job.findById(jobId);
  if (!job) return error(res, 'Job not found', 404);
  if (job.status !== 'open') return error(res, 'This job is no longer accepting applications', 400);

  const existing = await Application.findOne({ job: jobId, applicant: req.user._id });
  if (existing) return error(res, 'You have already applied to this job', 400);

  const application = await Application.create({
    job: jobId,
    applicant: req.user._id,
    proposal,
    coverLetter,
    bidAmount
  });

  await Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });

  const populated = await application.populate({
    path: 'job',
    select: 'title skills budget location',
    populate: { path: 'poster', select: 'name company' }
  });

  return success(res, populated, 'Application submitted successfully', 201);
});

// DELETE /api/applications/:id — withdraw application
const withdrawApplication = asyncHandler(async (req, res) => {
  const application = await Application.findOne({
    _id: req.params.id,
    applicant: req.user._id
  });

  if (!application) return error(res, 'Application not found', 404);
  if (application.status !== 'pending') {
    return error(res, 'Can only withdraw pending applications', 400);
  }

  application.status = 'withdrawn';
  application.withdrawnAt = new Date();
  await application.save();

  await Job.findByIdAndUpdate(application.job, { $inc: { applicationCount: -1 } });

  return success(res, null, 'Application withdrawn');
});

// GET /api/applications/job/:jobId — poster views applicants for their job
const getJobApplicants = asyncHandler(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, poster: req.user._id });
  if (!job) return error(res, 'Job not found or unauthorized', 404);

  const applications = await Application.find({ job: req.params.jobId })
    .populate('applicant', 'name avatar title skills location bio hourlyRate')
    .sort({ createdAt: -1 });

  return success(res, applications);
});

// PATCH /api/applications/:id/status — poster updates applicant status
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['viewed', 'shortlisted', 'rejected', 'hired'];
  if (!validStatuses.includes(status)) return error(res, 'Invalid status', 400);

  const application = await Application.findById(req.params.id).populate('job');
  if (!application) return error(res, 'Application not found', 404);

  if (String(application.job.poster) !== String(req.user._id)) {
    return error(res, 'Unauthorized', 403);
  }

  application.status = status;
  await application.save();
  return success(res, application, 'Status updated');
});

module.exports = {
  getMyApplications,
  getApplication,
  applyToJob,
  withdrawApplication,
  getJobApplicants,
  updateApplicationStatus
};
