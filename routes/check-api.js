const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User.model');

const router = express.Router();

// Check API connection and database status
router.get('/', async (req, res) => {
  try {
    // Test database connection
    const userCount = await User.countDocuments();
    
    // Get database info
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    const status = {
      api_status: 'Connected',
      database_status: dbStatus,
      database_type: 'MongoDB with Mongoose',
      database_path: process.env.MONGODB_URI,
      environment: process.env.NODE_ENV,
      port: process.env.PORT,
      timestamp: new Date().toISOString(),
      user_count: userCount,
      api_endpoints: [
        'GET /api/auth/me',
        'POST /api/auth/login',
        'POST /api/auth/register',
        'GET /api/jobs',
        'POST /api/jobs',
        'GET /api/proposals',
        'POST /api/proposals/generate',
        'GET /api/admin/stats'
      ]
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      api_status: 'Error',
      database_status: 'Error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
