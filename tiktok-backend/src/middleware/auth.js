const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  console.log('🔐 [AUTH MIDDLEWARE] =================================');
  console.log('🔐 [AUTH MIDDLEWARE] Request URL:', req.originalUrl);
  console.log('🔐 [AUTH MIDDLEWARE] Method:', req.method);
  console.log('🔐 [AUTH MIDDLEWARE] Headers:', req.headers);
  console.log('🔐 [AUTH MIDDLEWARE] =================================');
  
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('🔐 [AUTH MIDDLEWARE] ✅ Token found in Authorization header');
      console.log('🔐 [AUTH MIDDLEWARE] Token preview:', token.substring(0, 30) + '...');
    } else {
      console.log('🔐 [AUTH MIDDLEWARE] ❌ No Authorization header or Bearer token found');
      console.log('🔐 [AUTH MIDDLEWARE] Authorization header:', req.headers.authorization);
    }

    // Check if token exists
    if (!token) {
      console.log('🔐 [AUTH MIDDLEWARE] ❌ No token provided');
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.',
      });
    }

    try {
      // Verify token
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      console.log('🔐 [AUTH MIDDLEWARE] JWT_SECRET configured:', !!process.env.JWT_SECRET);
      console.log('🔐 [AUTH MIDDLEWARE] JWT_SECRET preview:', jwtSecret.substring(0, 10) + '...');
      console.log('🔐 [AUTH MIDDLEWARE] JWT_SECRET length:', jwtSecret.length);
      console.log('🔐 [AUTH MIDDLEWARE] Attempting to verify token...');
      
      const decoded = jwt.verify(token, jwtSecret);
      console.log('🔐 [AUTH MIDDLEWARE] ✅ Token verified successfully');
      console.log('🔐 [AUTH MIDDLEWARE] Decoded payload:', decoded);

      // Get user from token
      console.log('🔐 [AUTH MIDDLEWARE] Looking for user with ID:', decoded.id);
      const user = await User.findById(decoded.id);

      if (!user) {
        console.log('🔐 [AUTH MIDDLEWARE] ❌ User not found in database');
        return res.status(401).json({
          status: 'error',
          message: 'Token is valid but user no longer exists.',
        });
      }

      console.log('🔐 [AUTH MIDDLEWARE] ✅ User found:', user._id, user.username);
      console.log('🔐 [AUTH MIDDLEWARE] User isActive:', user.isActive);

      if (!user.isActive) {
        console.log('🔐 [AUTH MIDDLEWARE] ❌ User account is deactivated');
        return res.status(401).json({
          status: 'error',
          message: 'User account is deactivated.',
        });
      }

      // Add user to request object
      req.user = user;
      console.log('🔐 [AUTH MIDDLEWARE] ✅ Authentication successful, proceeding to next middleware');
      next();
    } catch (error) {
      console.log('🔐 [AUTH MIDDLEWARE] ❌ Token verification failed');
      console.log('🔐 [AUTH MIDDLEWARE] Error name:', error.name);
      console.log('🔐 [AUTH MIDDLEWARE] Error message:', error.message);
      console.log('🔐 [AUTH MIDDLEWARE] Error stack:', error.stack);
      
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token.',
        debug: {
          errorName: error.name,
          errorMessage: error.message,
          tokenPreview: token ? token.substring(0, 30) + '...' : 'no token',
          jwtSecretConfigured: !!process.env.JWT_SECRET
        }
      });
    }
  } catch (error) {
    console.log('🔐 [AUTH MIDDLEWARE] ❌ Server error in authentication middleware');
    console.log('🔐 [AUTH MIDDLEWARE] Server error:', error);
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