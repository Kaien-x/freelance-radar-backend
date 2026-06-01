const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { error } = require('../utils/response.util');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return error(res, 'Not authorized', 401);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return error(res, 'User not found', 401);
    if (!req.user.isActive) return error(res, 'Account deactivated', 401);
    
    next();
  } catch (err) {
    return error(res, 'Not authorized', 401);
  }
};

module.exports = { protect };
