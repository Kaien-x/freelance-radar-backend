const Application = require('../models/Application.model');
const Job = require('../models/Job.model');
const { sendEmail } = require('../services/email.service');
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
  const { jobId, proposal, coverLetter, portfolioUrl, bidAmount } = req.body;

  const textProposal = proposal || coverLetter || '';
  if (!jobId || !textProposal) return error(res, 'Job ID and cover letter are required', 400);
  if (textProposal.length < 50) return error(res, 'Cover letter must be at least 50 characters', 400);

  const job = await Job.findById(jobId).populate('poster', 'name email');
  if (!job) return error(res, 'Job not found', 404);
  if (job.status !== 'open') return error(res, 'This job is no longer accepting applications', 400);

  // Prevent applying to reddit jobs via this flow
  if (job.source === 'reddit') return error(res, 'Cannot apply to Reddit jobs via this site', 400);

  const existing = await Application.findOne({ job: jobId, applicant: req.user._id });
  if (existing) return error(res, 'You have already applied to this job', 400);

  const application = await Application.create({
    job: jobId,
    applicant: req.user._id,
    proposal: textProposal,
    coverLetter: coverLetter || '',
    portfolioUrl: portfolioUrl || '',
    bidAmount
  });

  await Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });

  // Notify poster by email (if poster exists)
  try {
    if (job.poster && job.poster.email) {
      const applicant = req.user;
      const subject = `New application for ${job.title}`;
      const applicantsUrl = `${process.env.FRONTEND_URL}/poster/applicants/${jobId}`;
      const skillsList = (applicant.skills || []).map(s => s.skill).filter(Boolean);
      const skillTags = skillsList.length > 0
        ? skillsList.map(s => `<span style="background:rgba(124,58,237,0.15);border:1px solid #4c1d95;color:#a78bfa;padding:4px 10px;border-radius:20px;font-size:12px;display:inline-block;margin:2px 4px 2px 0;">${s}</span>`).join('')
        : '<span style="color:#6b7280;font-size:13px;">Not provided</span>';

      const initials = applicant.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'NA';

      const portfolioSection = portfolioUrl ? `
  <div style="margin-bottom:20px;">
    <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Portfolio</p>
    <a href="${portfolioUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#12072a;border:1px solid #2d1f4e;border-radius:8px;padding:8px 14px;text-decoration:none;">
      <span style="font-size:12px;color:#7c3aed;">${portfolioUrl}</span>
    </a>
  </div>` : '';

      const html = `
      <div style="margin:0;padding:0;background:#06030f;width:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#06030f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;background:#06030f;">

        <div style="max-width:540px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;">
<div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;">

  <div style="background:#1a0f2e;padding:24px;text-align:center;border-bottom:1px solid #2d1f4e;">
    <div style="display:inline-flex;align-items:center;gap:10px;background:#7c3aed;padding:10px 20px;border-radius:10px;">
      <span style="color:#fff;font-size:17px;font-weight:600;">⚡ FreelancerRadar</span>
    </div>
  </div>

  <div style="padding:32px 36px;">

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:40px;height:40px;background:rgba(124,58,237,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;">
        👤
      </div>
      <div>
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">New application</p>
        <h1 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;line-height:1.3;">${job.title}</h1>
      </div>
    </div>

    <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:10px;padding:16px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;background:#7c3aed;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#fff;flex-shrink:0;">
          ${initials}
        </div>
        <div>
          <p style="margin:0;font-size:14px;font-weight:600;color:#fff;">${applicant.name}</p>
          <p style="margin:0;font-size:12px;color:#6b7280;">${applicant.email}</p>
        </div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Skills</p>
      <div>${skillTags}</div>
    </div>

    <div style="margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Cover letter</p>
      <div style="background:#12072a;border:1px solid #2d1f4e;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:14px 16px;">
        <p style="margin:0;font-size:13px;color:#d1d5db;line-height:1.7;">${textProposal}</p>
      </div>
    </div>

    ${portfolioSection}

    <div style="text-align:center;">
      <a href="${applicantsUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:13px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        View all applicants
      </a>
    </div>

  </div>

  <div style="background:#12072a;padding:16px 36px;border-top:1px solid #2d1f4e;text-align:center;">
    <p style="margin:0;font-size:11px;color:#4b5563;">© 2026 FreelancerRadar · Built by Manvendra</p>
  </div>

</div>
</div>

      </td>
    </tr>
  </table>
</div>
`;

      await sendEmail(job.poster.email, subject, html);
    }
  } catch (mailErr) {
    console.error('Application email failed:', mailErr.message);
  }

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

// GET /api/applications/check/:jobId — check if current user applied
const checkApplied = asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;
  if (!jobId) return error(res, 'Job ID required', 400);
  const existing = await Application.findOne({ job: jobId, applicant: req.user._id });
  return success(res, { hasApplied: !!existing });
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

  // Notify applicant for certain status changes
  try {
    if (['viewed', 'hired'].includes(status)) {
      const appWithApplicant = await application.populate('applicant');
      const applicant = appWithApplicant.applicant;

      if (applicant && applicant.email) {
        const isHired = status === 'hired';
        const subject = isHired
          ? `You've been accepted for ${application.job.title}`
          : `Your application was reviewed — ${application.job.title}`;

        const coverLetter = application.proposal || application.coverLetter || '';

        const statusSection = isHired ? `
      <div style="background:rgba(34,197,94,0.08);border:1px solid #166534;border-radius:10px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:16px;flex-shrink:0;">✅</span>
        <p style="margin:0;font-size:13px;color:#86efac;line-height:1.6;">Check your email for a message from the employer. Make sure to respond promptly to secure the project.</p>
      </div>` : `
      <div style="background:rgba(59,130,246,0.08);border:1px solid #1d4ed8;border-radius:10px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:16px;flex-shrink:0;">ℹ️</span>
        <p style="margin:0;font-size:13px;color:#93c5fd;line-height:1.6;">The employer may reach out to you directly via email. Make sure to check your inbox regularly.</p>
      </div>`;

        const iconBg = isHired ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)';
        const iconColor = isHired ? '#4ade80' : '#60a5fa';
        const icon = isHired ? '🎉' : '👁️';
        const headline = isHired ? "You've been accepted!" : 'Your application was reviewed';
        const borderColor = isHired ? '#22c55e' : '#3b82f6';

        const bodyText = isHired
          ? `Congratulations <strong style="color:#e5e7eb;">${applicant.name}</strong>! The employer has accepted your application for <strong style="color:#e5e7eb;">${application.job.title}</strong>. They will contact you shortly to discuss next steps.`
          : `Hi <strong style="color:#e5e7eb;">${applicant.name}</strong>, the employer has reviewed your application for <strong style="color:#e5e7eb;">${application.job.title}</strong>. This is a positive sign — stay tuned for further updates.`;

        const html = `
        <div style="margin:0;padding:0;background:#06030f;width:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#06030f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;background:#06030f;">

        <div style="max-width:540px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;">
          
<div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;">

  <div style="background:#1a0f2e;padding:24px;text-align:center;border-bottom:1px solid #2d1f4e;">
    <div style="display:inline-flex;align-items:center;gap:10px;background:#7c3aed;padding:10px 20px;border-radius:10px;">
      <span style="color:#fff;font-size:17px;font-weight:600;">⚡ FreelancerRadar</span>
    </div>
  </div>

  <div style="padding:32px 36px;">

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:40px;height:40px;background:${iconBg};border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">
        ${icon}
      </div>
      <div>
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Application update</p>
        <h1 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;line-height:1.3;">${headline}</h1>
      </div>
    </div>

    <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 20px;">${bodyText}</p>

    ${statusSection}

    <div style="margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Your cover letter</p>
      <div style="background:#12072a;border:1px solid #2d1f4e;border-left:3px solid ${borderColor};border-radius:0 8px 8px 0;padding:14px 16px;">
        <p style="margin:0;font-size:13px;color:#d1d5db;line-height:1.7;">${coverLetter}</p>
      </div>
    </div>

  </div>

  <div style="background:#12072a;padding:16px 36px;border-top:1px solid #2d1f4e;text-align:center;">
    <p style="margin:0;font-size:11px;color:#4b5563;">© 2026 FreelancerRadar · Built by Manvendra</p>
  </div>

</div>
</div>

      </td>
    </tr>
  </table>
</div>
`;

        await sendEmail(applicant.email, subject, html, { type: 'alert' });
      }
    }
  } catch (mailErr) {
    console.error('Status change email failed:', mailErr.message);
  }

  return success(res, application, 'Status updated');
});

module.exports = {
  getMyApplications,
  getApplication,
  applyToJob,
  withdrawApplication,
  getJobApplicants,
  updateApplicationStatus,
  checkApplied
};
