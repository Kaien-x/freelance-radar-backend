const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch {
    // no token — continue as guest
  }
  next();
};

module.exports = optionalAuth;
