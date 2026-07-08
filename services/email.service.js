const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog.model');
const User = require('../models/User.model');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

const writeEmailLog = async ({ to, subject, type, status, body, error, userId }) => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId && to) {
      const user = await User.findOne({ email: to.toLowerCase() }).select('_id');
      resolvedUserId = user?._id;
    }
    await EmailLog.create({
      to,
      subject,
      type,
      status,
      body,
      error: status === 'failed' ? error : null,
      userId: resolvedUserId || null,
      sentAt: new Date(),
    });
  } catch (logErr) {
    console.error('EmailLog write failed:', logErr.message);
  }
};

const sendAndLog = async (to, subject, html, { type = 'general', userId = null } = {}) => {
  try {
    const mailOptions = {
      from: `FreelanceRadar <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };
    const info = await transporter.sendMail(mailOptions);
    await writeEmailLog({ to, subject, type, status: 'sent', body: html, userId });
    return info;
  } catch (err) {
    await writeEmailLog({
      to,
      subject,
      type,
      status: 'failed',
      body: html,
      error: err.message,
      userId,
    });
    throw err;
  }
};

/**
 * Send an email via Gmail.
 * @param {string} to       - Recipient email address
 * @param {string} subject  - Email subject
 * @param {string} html     - HTML body content
 */
const sendEmail = async (to, subject, html) => sendAndLog(to, subject, html, { type: 'general' });

// ─── Email Templates ──────────────────────────────────────────────────────────

const sendWelcomeEmail = (to, name) =>
  sendAndLog(
    to,
    'Welcome to FreelancerRadar!',
    `
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
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:56px;height:56px;background:rgba(124,58,237,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:26px;">
          🚀
        </div>
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#ffffff;">Welcome, ${name}!</h1>
        <p style="margin:0;font-size:14px;color:#6b7280;">Your account is ready to go</p>
      </div>

      <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 28px;text-align:center;">
        You can now browse freelance jobs matched to your skills, apply to opportunities, and grow your freelance career — all in one place.
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:28px;">
        <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="font-size:20px;margin-bottom:6px;">💼</div>
          <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.4;">Browse freelance jobs</p>
        </div>
        <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="font-size:20px;margin-bottom:6px;">✨</div>
          <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.4;">AI skill matching</p>
        </div>
        <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="font-size:20px;margin-bottom:6px;">🔔</div>
          <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.4;">Job alerts coming soon</p>
        </div>
      </div>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:13px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
          Go to dashboard
        </a>
      </div>

      <p style="color:#4b5563;font-size:12px;text-align:center;margin:0;">
        If you did not create this account, you can safely ignore this email.
      </p>
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
  `,
    { type: 'welcome' }
  );

const sendPasswordResetEmail = (to, name, resetUrl) =>
  sendAndLog(
    to,
    'Reset Your FreelancerRadar Password',
    `
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
        <div style="width:40px;height:40px;background:rgba(124,58,237,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">
          🔒
        </div>
        <div>
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Security</p>
          <h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;">Password reset request</h1>
        </div>
      </div>

      <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 8px;">
        Hi <strong style="color:#e5e7eb;">${name}</strong>, we received a request to reset your FreelancerRadar password.
      </p>
      <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 28px;">
        Click the button below to create a new password. This link expires in <strong style="color:#f59e0b;">15 minutes</strong>.
      </p>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:13px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
          Reset my password
        </a>
      </div>

      <div style="background:rgba(124,58,237,0.08);border:1px solid #2d1f4e;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Or copy this link</p>
        <a href="${resetUrl}" style="font-size:12px;color:#7c3aed;word-break:break-all;">${resetUrl}</a>
      </div>

      <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;text-align:center;">
        If you didn't request this, you can safely ignore this email.<br/>Your password will remain unchanged.
      </p>
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
  `,
    { type: 'reset-password' }
  );

const sendEmailVerificationOTP = (to, name, otp) =>
  sendAndLog(
    to,
    'Verify your email address - FreelancerRadar',
    `
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
        <div style="width:40px;height:40px;background:rgba(124,58,237,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">
          ✉️
        </div>
        <div>
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Account setup</p>
          <h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;">Verify your email</h1>
        </div>
      </div>

      <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 28px;">
        Hi <strong style="color:#e5e7eb;">${name}</strong>, thanks for joining FreelancerRadar! Use the code below to verify your email address. Expires in <strong style="color:#f59e0b;">15 minutes</strong>.
      </p>

      <p style="margin:0 0 10px;font-size:12px;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:0.08em;">Your verification code</p>
      <div style="background:#12072a;border:1px dashed #4c1d95;border-radius:12px;padding:24px;text-align:center;margin-bottom:8px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:14px;color:#a78bfa;">${otp}</span>
      </div>
      <p style="margin:0 0 24px;font-size:12px;color:#4b5563;text-align:center;">Enter this code on the verification page</p>

      <div style="background:rgba(124,58,237,0.08);border:1px solid #2d1f4e;border-radius:10px;padding:14px 16px;">
        <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
          If you did not sign up for FreelancerRadar, you can safely ignore this email. No account will be created.
        </p>
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
  `,
    { type: 'verification' }
  );

// ─── Job match alert ──────────────────────────────────────────────────────────

const sendJobMatchAlert = (to, name, jobs) => {
  const jobRows = jobs.map(j => {
    const score = j.matchScore || 0;
    const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#6b7280';
    const url = j.source === 'reddit'
      ? (j.redditUrl || j.url || '#')
      : `${process.env.FRONTEND_URL}/jobs/${j._id}`;
    return `
    <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:10px;padding:16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <a href="${url}" target="_blank" style="font-size:14px;font-weight:600;color:#a78bfa;text-decoration:none;flex:1;margin-right:12px;">${j.title}</a>
        <span style="font-size:12px;font-weight:700;color:${scoreColor};white-space:nowrap;">${score}% match</span>
      </div>
      <p style="margin:0;font-size:12px;color:#6b7280;">r/${j.subreddit || 'platform'} · ${j.category || 'General'}</p>
    </div>`;
  }).join('');

  return sendAndLog(
    to,
    `⚡ ${jobs.length} new job match${jobs.length > 1 ? 'es' : ''} for you`,
    `
<div style="margin:0;padding:0;background:#06030f;width:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#06030f;min-height:100vh;">
  <tr><td align="center" style="padding:40px 16px;">
    <div style="max-width:540px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;font-family:sans-serif;">
      <div style="background:#1a0f2e;padding:24px;text-align:center;border-bottom:1px solid #2d1f4e;">
        <span style="background:#7c3aed;color:#fff;font-size:17px;font-weight:600;padding:10px 20px;border-radius:10px;">⚡ FreelancerRadar</span>
      </div>
      <div style="padding:32px 36px;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#ffffff;">New jobs matched to your skills</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;">Hi ${name}, we found ${jobs.length} new job${jobs.length > 1 ? 's' : ''} that match your profile.</p>
        ${jobRows}
        <div style="text-align:center;margin-top:24px;">
          <a href="${process.env.FRONTEND_URL}/jobs" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">View all jobs</a>
        </div>
        <p style="margin:16px 0 0;font-size:11px;color:#4b5563;text-align:center;">To stop these alerts, update your <a href="${process.env.FRONTEND_URL}/settings" style="color:#7c3aed;">notification settings</a>.</p>
      </div>
      <div style="background:#12072a;padding:16px 36px;border-top:1px solid #2d1f4e;text-align:center;">
        <p style="margin:0;font-size:11px;color:#4b5563;">© 2026 FreelancerRadar · Built by Manvendra</p>
      </div>
    </div>
  </td></tr>
</table>
</div>`,
    { type: 'job-alert' }
  );
};

// ─── Saved search alert ───────────────────────────────────────────────────────

const sendSavedSearchAlert = (to, name, searchName, jobs) => {
  const jobRows = jobs.map(j => {
    const url = j.source === 'reddit'
      ? (j.redditUrl || j.url || '#')
      : `${process.env.FRONTEND_URL}/jobs/${j._id}`;
    return `
    <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:10px;padding:14px;margin-bottom:8px;">
      <a href="${url}" target="_blank" style="font-size:14px;font-weight:600;color:#a78bfa;text-decoration:none;">${j.title}</a>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${j.category || 'General'} · ${j.source === 'reddit' ? `r/${j.subreddit}` : 'Platform'}</p>
    </div>`;
  }).join('');

  return sendAndLog(
    to,
    `🔔 New results for saved search: "${searchName}"`,
    `
<div style="margin:0;padding:0;background:#06030f;width:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#06030f;min-height:100vh;">
  <tr><td align="center" style="padding:40px 16px;">
    <div style="max-width:540px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;font-family:sans-serif;">
      <div style="background:#1a0f2e;padding:24px;text-align:center;border-bottom:1px solid #2d1f4e;">
        <span style="background:#7c3aed;color:#fff;font-size:17px;font-weight:600;padding:10px 20px;border-radius:10px;">⚡ FreelancerRadar</span>
      </div>
      <div style="padding:32px 36px;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#ffffff;">New results for "${searchName}"</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;">Hi ${name}, ${jobs.length} new job${jobs.length > 1 ? 's' : ''} match your saved search.</p>
        ${jobRows}
        <div style="text-align:center;margin-top:24px;">
          <a href="${process.env.FRONTEND_URL}/jobs" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Run this search</a>
        </div>
        <p style="margin:16px 0 0;font-size:11px;color:#4b5563;text-align:center;">To stop these alerts, manage your <a href="${process.env.FRONTEND_URL}/settings" style="color:#7c3aed;">saved searches</a>.</p>
      </div>
      <div style="background:#12072a;padding:16px 36px;border-top:1px solid #2d1f4e;text-align:center;">
        <p style="margin:0;font-size:11px;color:#4b5563;">© 2026 FreelancerRadar · Built by Manvendra</p>
      </div>
    </div>
  </td></tr>
</table>
</div>`,
    { type: 'saved-search-alert' }
  );
};

// ─── Weekly digest (free plan) ────────────────────────────────────────────────

const sendWeeklyDigest = (to, name, jobs, userId = null) => {
  const jobRows = jobs.map(j => {
    const score = j.matchScore || 0;
    const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#6b7280';
    const url = j.source === 'reddit'
      ? (j.redditUrl || j.url || '#')
      : `${process.env.FRONTEND_URL}/jobs/${j._id}`;
    const ageDays = Math.max(0, Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000));
    const ageLabel = ageDays === 0 ? 'today' : ageDays === 1 ? '1 day ago' : `${ageDays} days ago`;
    return `
    <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:10px;padding:16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <a href="${url}" target="_blank" style="font-size:14px;font-weight:600;color:#a78bfa;text-decoration:none;flex:1;margin-right:12px;">${j.title}</a>
        <span style="font-size:12px;font-weight:700;color:${scoreColor};white-space:nowrap;">${score}% match</span>
      </div>
      <p style="margin:0;font-size:12px;color:#6b7280;">r/${j.subreddit || 'platform'} · ${j.category || 'General'} · posted ${ageLabel}</p>
    </div>`;
  }).join('');

  return sendAndLog(
    to,
    `📬 Your weekly job matches — ${jobs.length} job${jobs.length > 1 ? 's' : ''} picked for you`,
    `
<div style="margin:0;padding:0;background:#06030f;width:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#06030f;min-height:100vh;">
  <tr><td align="center" style="padding:40px 16px;">
    <div style="max-width:540px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;font-family:sans-serif;">
      <div style="background:#1a0f2e;padding:24px;text-align:center;border-bottom:1px solid #2d1f4e;">
        <span style="background:#7c3aed;color:#fff;font-size:17px;font-weight:600;padding:10px 20px;border-radius:10px;">⚡ FreelancerRadar</span>
      </div>
      <div style="padding:32px 36px;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#ffffff;">Your weekly matches</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;">Hi ${name}, here are this week's best jobs matched to your skills.</p>
        ${jobRows}
        <div style="text-align:center;margin-top:24px;">
          <a href="${process.env.FRONTEND_URL}/jobs" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">See all jobs</a>
        </div>
        <div style="background:rgba(124,58,237,0.08);border:1px solid #2d1f4e;border-radius:10px;padding:14px 16px;margin-top:24px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
            ⚡ Pro users got these matches <strong style="color:#a78bfa;">the moment they were posted</strong> — not days later.<br/>
            <a href="${process.env.FRONTEND_URL}/settings" style="color:#7c3aed;font-weight:600;">Join the Pro waitlist →</a>
          </p>
        </div>
        <p style="margin:16px 0 0;font-size:11px;color:#4b5563;text-align:center;">Don't want the weekly digest? Turn it off in <a href="${process.env.FRONTEND_URL}/settings" style="color:#7c3aed;">settings</a>.</p>
      </div>
      <div style="background:#12072a;padding:16px 36px;border-top:1px solid #2d1f4e;text-align:center;">
        <p style="margin:0;font-size:11px;color:#4b5563;">© 2026 FreelancerRadar · Built by Manvendra</p>
      </div>
    </div>
  </td></tr>
</table>
</div>`,
    { type: 'weekly-digest', userId }
  );
};

// ─── Feedback admin notification ──────────────────────────────────────────────

const sendFeedbackAdminNotification = (feedback) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  if (!adminEmail) return Promise.resolve();

  const typeLabel = { bug: '🐛 Bug Report', feature: '💡 Feature Request', feedback: '💬 Feedback', contact: '📩 Contact' }[feedback.type] || 'Submission';

  return sendAndLog(
    adminEmail,
    `[FreelancerRadar] ${typeLabel} from ${feedback.name}`,
    `
<div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0f0a1e;border-radius:12px;border:1px solid #2d1f4e;overflow:hidden;">
  <div style="background:#1a0f2e;padding:16px 24px;border-bottom:1px solid #2d1f4e;">
    <p style="margin:0;font-size:13px;color:#a78bfa;font-weight:600;">${typeLabel}</p>
  </div>
  <div style="padding:24px;">
    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;">FROM</p>
    <p style="margin:0 0 16px;font-size:14px;color:#e5e7eb;">${feedback.name} &lt;${feedback.email}&gt;</p>
    ${feedback.subject ? `<p style="margin:0 0 4px;font-size:11px;color:#6b7280;">SUBJECT</p><p style="margin:0 0 16px;font-size:14px;color:#e5e7eb;">${feedback.subject}</p>` : ''}
    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;">MESSAGE</p>
    <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:8px;padding:14px;">
      <p style="margin:0;font-size:14px;color:#d1d5db;white-space:pre-wrap;">${feedback.message}</p>
    </div>
    ${feedback.page ? `<p style="margin:12px 0 0;font-size:11px;color:#4b5563;">Submitted from: ${feedback.page}</p>` : ''}
  </div>
</div>`,
    { type: 'feedback' }
  );
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailVerificationOTP,
  sendJobMatchAlert,
  sendSavedSearchAlert,
  sendWeeklyDigest,
  sendFeedbackAdminNotification,
};
