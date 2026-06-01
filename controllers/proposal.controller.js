const Proposal = require('../models/Proposal.model');
const Job = require('../models/Job.model');
const { success, error } = require('../utils/response.util');
const asyncHandler = require('../utils/asyncHandler');
const { generateProposal } = require('../services/ai.service');

const generate = asyncHandler(async (req, res) => {
  const { jobId, jobTitle, jobDescription, tone = 'professional' } = req.body;

  if (!jobDescription && !jobId) {
    return error(res, 'Job description or job ID is required', 400);
  }

  const validTones = ['professional', 'friendly', 'technical', 'creative'];
  if (!validTones.includes(tone)) return error(res, 'Invalid tone', 400);

  let title = jobTitle || '';
  let description = jobDescription || '';

  if (jobId) {
    const job = await Job.findById(jobId);
    if (job) {
      title = job.title;
      description = job.description;
    }
  }

  const user = req.user;

  const content = await generateProposal({
    jobTitle: title,
    jobDescription: description,
    userSkills: user.skills || [],
    userBio: user.bio || '',
    tone
  });

  const wordCount = content.split(/\s+/).length;

  const proposal = await Proposal.create({
    user: user._id,
    job: jobId || null,
    jobTitle: title,
    jobDescription: description,
    content,
    tone,
    wordCount,
  });

  return success(res, proposal, 'Proposal generated', 201);
});

const getMyProposals = asyncHandler(async (req, res) => {
  const { tone, page = 1, limit = 10 } = req.query;
  const query = { user: req.user._id };
  if (tone) query.tone = tone;

  const [proposals, total] = await Promise.all([
    Proposal.find(query)
      .populate('job', 'title status')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit)),
    Proposal.countDocuments(query)
  ]);

  return success(res, {
    proposals,
    total,
    pages: Math.ceil(total / Number(limit)),
    currentPage: Number(page)
  });
});

const updateProposal = asyncHandler(async (req, res) => {
  const { content, isFavorite } = req.body;
  const proposal = await Proposal.findOne({ _id: req.params.id, user: req.user._id });
  if (!proposal) return error(res, 'Proposal not found', 404);

  if (content !== undefined) {
    proposal.content = content;
    proposal.wordCount = content.split(/\s+/).length;
  }
  if (isFavorite !== undefined) proposal.isFavorite = isFavorite;

  await proposal.save();
  return success(res, proposal, 'Proposal updated');
});

const deleteProposal = asyncHandler(async (req, res) => {
  const proposal = await Proposal.findOne({ _id: req.params.id, user: req.user._id });
  if (!proposal) return error(res, 'Proposal not found', 404);
  await proposal.deleteOne();
  return success(res, null, 'Proposal deleted');
});

module.exports = { generate, getMyProposals, updateProposal, deleteProposal };
