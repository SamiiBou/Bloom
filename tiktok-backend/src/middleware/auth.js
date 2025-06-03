const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

      // Get user from token
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Token is valid but user no longer exists.',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User account is deactivated.',
        });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token.',
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error in authentication middleware.',
    });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token, continue without user
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

      // Get user from token
      const user = await User.findById(decoded.id);

      if (user && user.isActive) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (error) {
      // Invalid token, continue without user
      req.user = null;
    }

    next();
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error in optional authentication middleware.',
    });
  }
};

// Check if user is admin (optional, for future use)
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Access denied. Authentication required.',
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Admin privileges required.',
    });
  }

  next();
};

// Check if user owns the resource or is admin
const ownerOrAdmin = (Model, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Access denied. Authentication required.',
        });
      }

      const resourceId = req.params[resourceIdParam];
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          status: 'error',
          message: 'Resource not found.',
        });
      }

      // Check if user owns the resource or is admin
      if (resource.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You can only access your own resources.',
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Server error in ownership check.',
      });
    }
  };
};

// Rate limiting by user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!requests.has(userId)) {
      requests.set(userId, []);
    }

    const userRequests = requests.get(userId);
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => time > windowStart);
    requests.set(userId, validRequests);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        status: 'error',
        message: 'Rate limit exceeded. Too many requests.',
      });
    }

    // Add current request
    validRequests.push(now);
    next();
  };
};

module.exports = {
  protect,
  optionalAuth,
  adminOnly,
  ownerOrAdmin,
  userRateLimit,
};