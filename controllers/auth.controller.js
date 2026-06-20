const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User.model');
const ActivityLog = require('../models/ActivityLog.model');
const { verifyGoogleToken } = require('../services/googleOAuth.service');
const { sendWelcomeEmail, sendPasswordResetEmail, sendEmailVerificationOTP } = require('../services/email.service');
const { success, error } = require('../utils/response.util');
const jobCategoryMap = require('../jobCategoryMap.json');

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const downloadGoogleAvatar = async (url, googleId) => {
  if (!url) return null;
  try {
    const dir = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Use a high-res version of the Google avatar if possible
    // Google URLs often end in =s96-c. We can remove it for original size or change to =s400
    const highResUrl = url.replace(/=s\d+-c$/, '=s400-c');

    const filename = `google_${googleId}_${Date.now()}.jpg`;
    const filepath = path.join(dir, filename);

    const response = await axios({
      url: highResUrl,
      method: 'GET',
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filepath);

      response.data.pipe(writer);

      writer.on('finish', () => {
        const fileUrl = `/uploads/avatars/${filename}`;
        resolve(fileUrl);
      });

      writer.on('error', reject);
    });
  } catch (err) {
    console.error('Failed to download Google avatar:', err.message);
    return null;
  }
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/google
 * Body: { idToken: string, role?: 'jobseeker' | 'jobposter' }
 */
const googleAuth = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) return error(res, 'Google ID token is required', 400);

    // 1. Verify with Google
    let payload;
    try {
      payload = await verifyGoogleToken(idToken);
    } catch (verifyErr) {
      console.error('Google token verification failed:', verifyErr.message);
      return error(res, 'Invalid or expired Google token', 401);
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) return error(res, 'Google account has no email address', 400);

    // 2. Try to find user by googleId first, then by email
    let user = await User.findOne({ googleId });
    let needsSave = false;

    if (!user) {
      user = await User.findOne({ email });

      if (user) {
        // Link existing account to Google
        user.googleId = googleId;
        user.isEmailVerified = true;
        needsSave = true;
      }
    }

    // Process avatar if user exists (newly linked or existing)
    if (user) {
      // Only download avatar if user has no avatar at all
      if (picture && !user.avatar) {
        const localAvatar = await downloadGoogleAvatar(picture, googleId);

        if (localAvatar) {
          user.avatar = localAvatar;
          needsSave = true;
        }
      }

      if (needsSave) {
        await user.save();
      }
    }

    // 3. Create new user if still not found
    let isNewUser = false;
    if (!user) {
      const assignedRole = ['jobseeker', 'jobposter'].includes(role)
        ? role
        : 'jobseeker';

      let localAvatar = null;
      if (picture) {
        localAvatar = await downloadGoogleAvatar(picture, googleId) || picture;
      }

      user = await User.create({
        googleId,
        email,
        name,
        avatar: localAvatar,
        role: assignedRole,
        isEmailVerified: true,
        isActive: true,
      });
      isNewUser = true;
    }

    if (!user.isActive) return error(res, 'Account has been deactivated', 401);

    // Send welcome email for first-time Google sign-ups
    if (isNewUser) {
      sendWelcomeEmail(user.email, user.name).catch((err) =>
        console.error('Welcome email (Google) failed:', err.message)
      );
    }

    // 4. Issue JWT + log login event
    ActivityLog.create({ user: user._id, event: 'login', meta: { method: 'google' } }).catch(() => {});
    const token = generateToken(user._id);
    return success(res, { user, token }, 'Google authentication successful');
  } catch (err) {
    console.error('Google auth error:', err);
    return error(res, err.message || 'Google authentication failed', 500);
  }
};

// ─── Preserved profile/skills endpoints ──────────────────────────────────────

const getMe = async (req, res) => {
  try {
    return success(res, req.user);
  } catch (err) {
    return error(res, 'Failed to get user data', 500);
  }
};

const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password;
    delete updates.role;
    delete updates.email;
    delete updates.googleId;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );
    return success(res, user, 'Profile updated');
  } catch (err) {
    return error(res, err.message || 'Profile update failed', 500);
  }
};

const updateSkills = async (req, res) => {
  try {
    const { skills } = req.body;

    const formattedSkills = skills.map(skill => ({
      skill,
      level: 'beginner',
      years: 0
    }));

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { skills: formattedSkills },
      { new: true }
    );

    return success(res, user, 'Skills updated');
  } catch (err) {
    console.error(err);
    return error(res, err.message || 'Skills update failed', 500);
  }
};

module.exports = { googleAuth, getMe, updateProfile, updateSkills };

// ─── Email / Password Auth ────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { name, email, password, role? }
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password)
      return error(res, 'Name, email and password are required', 400);

    if (password.length < 8)
      return error(res, 'Password must be at least 8 characters', 400);

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      // If account exists via Google, tell the user to use Google login
      if (exists.googleId && !exists.password)
        return error(res, 'An account with this email already exists. Please sign in with Google.', 409);
      return error(res, 'An account with this email already exists.', 409);
    }

    const assignedRole = ['jobseeker', 'jobposter'].includes(role) ? role : 'jobseeker';

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: assignedRole,
      isEmailVerified: false,
      isActive: true,
      emailVerificationOtp: otp,
      emailVerificationExpires: new Date(Date.now() + 15 * 60 * 1000) // 15 mins
    });

    // Send welcome email and OTP email
    sendWelcomeEmail(user.email, user.name).catch((err) =>
      console.error('Welcome email failed:', err.message)
    );
    sendEmailVerificationOTP(user.email, user.name, otp).catch((err) =>
      console.error('OTP email failed:', err.message)
    );

    const token = generateToken(user._id);
    return success(res, { user, token }, 'Registration successful', 201);
  } catch (err) {
    console.error('Register error:', err);
    return error(res, err.message || 'Registration failed', 500);
  }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return error(res, 'Email and password are required', 400);

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user)
      return error(res, 'Invalid email or password', 401);

    // Account created with Google only — no password set
    if (!user.password)
      return error(res, 'This account uses Google Sign-In. Please sign in with Google.', 401);

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return error(res, 'Invalid email or password', 401);

    if (!user.isActive)
      return error(res, 'Account has been deactivated', 401);

    ActivityLog.create({ user: user._id, event: 'login', meta: { method: 'email' } }).catch(() => {});
    const token = generateToken(user._id);
    return success(res, { user, token }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, err.message || 'Login failed', 500);
  }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return error(res, 'Email is required', 400);

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always respond with success to prevent email enumeration
    if (!user || !user.isActive) {
      return success(res, null, 'If an account with that email exists, a reset link has been sent.');
    }

    // Google-only accounts have no password to reset
    if (user.googleId && !user.password) {
      return success(res, null, 'If an account with that email exists, a reset link has been sent.');
    }

    // Generate secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (emailErr) {
      console.error('Password reset email failed:', emailErr.message);
      // Clean up the token if email failed
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save({ validateBeforeSave: false });
      return error(res, 'Failed to send reset email. Please try again.', 500);
    }

    return success(res, null, 'If an account with that email exists, a reset link has been sent.');
  } catch (err) {
    console.error('Forgot password error:', err);
    return error(res, err.message || 'Failed to process request', 500);
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password)
      return error(res, 'Token and new password are required', 400);

    if (password.length < 8)
      return error(res, 'Password must be at least 8 characters', 400);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user)
      return error(res, 'Password reset link is invalid or has expired.', 400);

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    const jwtToken = generateToken(user._id);
    return success(res, { user, token: jwtToken }, 'Password reset successful');
  } catch (err) {
    console.error('Reset password error:', err);
    return error(res, err.message || 'Failed to reset password', 500);
  }
};

/**
 * POST /api/auth/verify-email
 * Body: { otp }
 */
const verifyEmailOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return error(res, 'Verification code is required', 400);

    const user = await User.findById(req.user._id);
    if (!user) return error(res, 'User not found', 404);

    if (user.isEmailVerified) return error(res, 'Email is already verified', 400);

    if (user.emailVerificationOtp !== otp) {
      return error(res, 'Invalid verification code', 400);
    }

    if (user.emailVerificationExpires < Date.now()) {
      return error(res, 'Verification code has expired. Please request a new one.', 400);
    }

    user.isEmailVerified = true;
    user.emailVerificationOtp = null;
    user.emailVerificationExpires = null;
    await user.save();

    const token = generateToken(user._id);
    return success(res, { user, token }, 'Email verified successfully');
  } catch (err) {
    console.error('Verify email error:', err);
    return error(res, err.message || 'Failed to verify email', 500);
  }
};

/**
 * POST /api/auth/resend-verification
 */
const resendVerificationOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return error(res, 'User not found', 404);

    if (user.isEmailVerified) return error(res, 'Email is already verified', 400);

    // Rate limit checking could go here (e.g., check if expires is > 14 mins away)

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationOtp = otp;
    user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    try {
      await sendEmailVerificationOTP(user.email, user.name, otp);
    } catch (emailErr) {
      console.error('OTP email failed:', emailErr.message);
      return error(res, 'Failed to send verification email', 500);
    }

    return success(res, null, 'Verification code sent');
  } catch (err) {
    console.error('Resend verification error:', err);
    return error(res, err.message || 'Failed to resend verification code', 500);
  }
};

const getAllSkills = async (req, res) => {
  try {
    const skills = jobCategoryMap;
    return success(res, skills);
  } catch (err) {
    console.error('Get all skills error:', err);
    return error(res, err.message || 'Failed to get skills', 500);
  }
}

module.exports = { googleAuth, register, login, forgotPassword, resetPassword, getMe, updateProfile, updateSkills , getAllSkills, verifyEmailOTP, resendVerificationOTP };

