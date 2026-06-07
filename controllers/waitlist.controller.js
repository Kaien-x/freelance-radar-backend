const Waitlist = require('../models/Waitlist.model');
const { success, error } = require('../utils/response.util');
const asyncHandler = require('../utils/asyncHandler');
const { sendEmail } = require('../services/email.service');

const validateEmail = (email) => {
    if (!email) return false;
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return re.test(String(email).toLowerCase());
}

// POST /api/waitlist
const joinWaitlist = asyncHandler(async (req, res) => {
    const { email, name } = req.body || {};
    if (!email || !validateEmail(email)) return error(res, 'Invalid email', 400);

    const existing = await Waitlist.findOne({ email: email.toLowerCase().trim() });
    if (existing) return success(res, null, 'You are already on the waitlist!');

    const entry = await Waitlist.create({ email: email.toLowerCase().trim(), name: name || '', source: 'landing-page' });

    // Send confirmation email
    try {
        const subject = "You're on the FreelancerRadar Pro waitlist!";
        const displayName = (name && name.trim()) ? name.trim() : 'there';
        const html = `
      <div style="margin:0;padding:0;background:#06030f;width:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#06030f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;background:#06030f;">

        <div style="max-width:540px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;">
          <div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid #2d1f4e;">

            <!-- Header -->
            <div style="background:#1a0f2e;padding:24px;text-align:center;border-bottom:1px solid #2d1f4e;">
              <div style="display:inline-flex;align-items:center;gap:10px;background:#7c3aed;padding:10px 20px;border-radius:10px;">
                <span style="color:#fff;font-size:17px;font-weight:600;">⚡ FreelancerRadar</span>
              </div>
            </div>

            <!-- Body -->
            <div style="padding:32px 36px;">

              <!-- Icon + Title -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td valign="middle" style="width:48px;padding-right:12px;">
                    <div style="width:40px;height:40px;background:rgba(124,58,237,0.15);border-radius:10px;text-align:center;line-height:40px;font-size:20px;">🔔</div>
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Waitlist Update</p>
                    <h1 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;line-height:1.3;">You're on the list!</h1>
                  </td>
                </tr>
              </table>

              <!-- Body text -->
              <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 20px;">
                Hi <strong style="color:#e5e7eb;">${displayName}</strong>, thanks for your interest in FreelancerRadar Pro. You'll be among the first to know when we launch.
              </p>

              <!-- What's coming in Pro -->
              <div style="background:#12072a;border:1px solid #2d1f4e;border-radius:10px;padding:18px;margin-bottom:20px;">
                <p style="font-weight:600;color:#e5e7eb;margin:0 0 12px;font-size:14px;">What's coming in Pro</p>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr><td style="padding:3px 0;color:#c7c3d9;font-size:14px;">· &nbsp;Instant email alerts for skill-matched jobs</td></tr>
                  <tr><td style="padding:3px 0;color:#c7c3d9;font-size:14px;">· &nbsp;AI job quality scoring</td></tr>
                  <tr><td style="padding:3px 0;color:#c7c3d9;font-size:14px;">· &nbsp;Priority job feed — newest first, no delay</td></tr>
                  <tr><td style="padding:3px 0;color:#c7c3d9;font-size:14px;">· &nbsp;Resume-based auto skill detection</td></tr>
                </table>
              </div>

              <!-- Notice -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.25);border-radius:10px;">
                <tr>
                  <td valign="top" style="padding:14px 0 14px 16px;width:30px;font-size:18px;line-height:1;">✅</td>
                  <td valign="middle" style="padding:14px 16px 14px 10px;font-size:13px;color:#c7c3d9;line-height:1.6;">
                    We'll email you as soon as it's ready — no spam, just one email when Pro launches.
                  </td>
                </tr>
              </table>

            </div>

            <!-- Footer -->
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

        await sendEmail(entry.email, subject, html);
    } catch (mailErr) {
        console.error('Waitlist confirmation email failed:', mailErr.message);
    }

    return success(res, entry, 'Successfully joined waitlist!');
});

// GET /api/admin/waitlist
const adminGetWaitlist = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const total = await Waitlist.countDocuments();
    const entries = await Waitlist.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    return success(res, { entries, total, pages: Math.ceil(total / limit) });
});

// DELETE /api/admin/waitlist/:id
const adminDeleteWaitlist = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const entry = await Waitlist.findById(id);
    if (!entry) return error(res, 'Waitlist entry not found', 404);
    await entry.deleteOne();
    return success(res, null, 'Deleted');
});

module.exports = { joinWaitlist, adminGetWaitlist, adminDeleteWaitlist };
