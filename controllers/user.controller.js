const User = require('../models/User.model');
const { success, error } = require('../utils/response.util');
const asyncHandler = require('../utils/asyncHandler');
const fs = require('fs');
const path = require('path');
const { parseResume } = require('../services/resumeParser.service');

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  return success(res, user);
});

const updateProfile = asyncHandler(async (req, res) => {
  const forbidden = ['password', 'role', 'email'];
  forbidden.forEach(key => delete req.body[key]);

  // Handle nested objects safely
  const updateData = { ...req.body };

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('-password');

  return success(res, user, 'Profile updated');
});

const updateSkills = asyncHandler(async (req, res) => {
  const { skills } = req.body;
  if (!Array.isArray(skills)) return error(res, 'Skills must be an array', 400);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { skills },
    { new: true }
  ).select('-password');

  return success(res, user, 'Skills updated');
});

const uploadAvatar = asyncHandler(async (req, res) => {
  console.log('Request headers:', req.headers);
  console.log('Request file:', req.file);
  console.log('Request body:', req.body);

  if (!req.file) return error(res, 'No file uploaded', 400);

  // Delete old avatar if exists
  const currentUser = await User.findById(req.user._id);
  
  if (currentUser.avatar) {
    try {
      const avatarPath = currentUser.avatar.startsWith('http')
        ? new URL(currentUser.avatar).pathname
        : currentUser.avatar;

      if (avatarPath.startsWith('/uploads/')) {
        const oldPath = path.join(process.cwd(), avatarPath);

        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    } catch (error) {
      console.error('Failed to delete old avatar:', error);
    }
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: avatarUrl },
    { new: true }
  ).select('-password');

  return success(res, user, 'Avatar uploaded');
});

const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    return error(res, 'No file uploaded', 400);
  }

  const currentUser = await User.findById(req.user._id);

  if (currentUser.resume?.path) {
    const oldPath = path.join(process.cwd(), currentUser.resume.path);

    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const fullResumePath = path.join(
    process.cwd(),
    `uploads/resumes/${req.file.filename}`
  );

  const { text, extractedSkills } = await parseResume(fullResumePath);

  const mergedSkills = [
    ...extractedSkills.frontend,
    ...extractedSkills.backend,
    ...extractedSkills.databases,
    ...extractedSkills.devops,
    ...extractedSkills.tools,
    ...extractedSkills.ai,
    ...extractedSkills.other
  ];

  const uniqueSkills = mergedSkills.filter(
    (skill, index, self) =>
      index === self.findIndex((s) => s.skill === skill.skill)
  );

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        'resume.filename': req.file.filename,
        'resume.path': `/uploads/resumes/${req.file.filename}`,
        'resume.uploadedAt': new Date(),

        resumeText: text,
        parsedSkills: extractedSkills,
        resumeParsedAt: new Date(),

        skills: uniqueSkills
      }
    },
    {
      new: true,
      returnDocument: 'after'
    }
  ).select('-password');

  return success(res, {
    user,
    extractedSkills
  }, 'Resume uploaded and parsed successfully');
});

const updateExperience = asyncHandler(async (req, res) => {
  const { experience } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { experience },
    { new: true }
  ).select('-password');
  return success(res, user, 'Experience updated');
});

module.exports = { getProfile, updateProfile, updateSkills, uploadAvatar, uploadResume, updateExperience };
