const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, plan, reddit_username } = req.body;
    
    const user = await User.update(req.user.id, {
      name,
      plan,
      reddit_username
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        reddit_username: user.reddit_username
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update user skills
router.put('/skills', auth, async (req, res) => {
  try {
    const { skills } = req.body;
    
    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: 'Skills must be an array' });
    }

    // Validate skills format
    for (const skill of skills) {
      if (!skill.skill || typeof skill.level !== 'number') {
        return res.status(400).json({ error: 'Each skill must have skill name and level' });
      }
    }

    const updatedSkills = await User.updateSkills(req.user.id, skills);

    res.json({
      message: 'Skills updated successfully',
      skills: updatedSkills
    });
  } catch (error) {
    console.error('Skills update error:', error);
    res.status(500).json({ error: 'Failed to update skills' });
  }
});

// Get user skills
router.get('/skills', auth, async (req, res) => {
  try {
    const skills = await User.getSkills(req.user.id);
    res.json({ skills });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ error: 'Failed to get skills' });
  }
});

// Get user profile with skills
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.getWithSkills(req.user.id);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        reddit_username: user.reddit_username,
        skills: user.skills || []
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

module.exports = router;
