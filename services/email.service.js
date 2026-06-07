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

module.exports = { sendEmail, sendWelcomeEmail, sendPasswordResetEmail, sendEmailVerificationOTP };
