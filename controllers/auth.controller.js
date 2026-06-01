const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { verifyGoogleToken } = require('../services/googleOAuth.service');
const { success, error } = require('../utils/response.util');

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
      writer.on('finish', () => resolve(`/uploads/avatars/${filename}`));
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
      if (picture && (!user.avatar || user.avatar.startsWith('http'))) {
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
    }

    if (!user.isActive) return error(res, 'Account has been deactivated', 401);

    // 4. Issue JWT
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
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { skills },
      { new: true }
    );
    return success(res, user, 'Skills updated');
  } catch (err) {
    return error(res, err.message || 'Skills update failed', 500);
  }
};

module.exports = { googleAuth, getMe, updateProfile, updateSkills };
