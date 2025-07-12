const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken, getJWTConfig } = require('../utils/tokenManager');

// Enhanced protect middleware with centralized token management
const protect = async (req, res, next) => {
  console.log('🔐 [AUTH MIDDLEWARE] =================================');
  console.log('🔐 [AUTH MIDDLEWARE] Request URL:', req.originalUrl);
  console.log('🔐 [AUTH MIDDLEWARE] Method:', req.method);
  console.log('🔐 [AUTH MIDDLEWARE] Headers:', req.headers);
  
  // Log JWT configuration for debugging
  const jwtConfig = getJWTConfig();
  console.log('🔐 [AUTH MIDDLEWARE] JWT Config:', jwtConfig);
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
        code: 'NO_TOKEN'
      });
    }

    try {
      // Use centralized token verification
      console.log('🔐 [AUTH MIDDLEWARE] Attempting to verify token with centralized manager...');
      const decoded = verifyToken(token, 'access');
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
          code: 'USER_NOT_FOUND'
        });
      }

      console.log('🔐 [AUTH MIDDLEWARE] ✅ User found:', user._id, user.username);
      console.log('🔐 [AUTH MIDDLEWARE] User isActive:', user.isActive);

      if (!user.isActive) {
        console.log('🔐 [AUTH MIDDLEWARE] ❌ User account is deactivated');
        return res.status(401).json({
          status: 'error',
          message: 'User account is deactivated.',
          code: 'USER_INACTIVE'
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
      
      // Enhanced error handling for different JWT errors
      let errorCode = 'INVALID_TOKEN';
      let errorMessage = 'Invalid token.';
      
      switch (error.name) {
        case 'TokenExpiredError':
          errorCode = 'TOKEN_EXPIRED';
          errorMessage = 'Token has expired. Please refresh your token.';
          break;
        case 'JsonWebTokenError':
          if (error.message.includes('invalid signature')) {
            errorCode = 'INVALID_SIGNATURE';
            errorMessage = 'Token signature is invalid. Please login again to get a new token.';
          } else if (error.message.includes('malformed')) {
            errorCode = 'MALFORMED_TOKEN';
            errorMessage = 'Token is malformed. Please login again.';
          }
          break;
        case 'NotBeforeError':
          errorCode = 'TOKEN_NOT_ACTIVE';
          errorMessage = 'Token is not active yet.';
          break;
        default:
          errorCode = 'INVALID_TOKEN';
          errorMessage = 'Invalid token. Please login again.';
      }
      
      return res.status(401).json({
        status: 'error',
        message: errorMessage,
        code: errorCode,
        debug: {
          errorName: error.name,
          errorMessage: error.message,
          tokenPreview: token ? token.substring(0, 30) + '...' : 'no token',
          jwtConfig: getJWTConfig(),
          timestamp: new Date().toISOString(),
          suggestion: 'Please login again to get a fresh token'
        }
      });
    }
  } catch (error) {
    console.log('🔐 [AUTH MIDDLEWARE] ❌ Server error in authentication middleware');
    console.log('🔐 [AUTH MIDDLEWARE] Server error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error in authentication middleware.',
      code: 'SERVER_ERROR'
    });
  }
};

// Enhanced optional authentication with centralized token management
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
      // Use centralized token verification
      const decoded = verifyToken(token, 'access');

      // Get user from token
      const user = await User.findById(decoded.id);

      if (user && user.isActive) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (error) {
      // Invalid token, continue without user
      console.log('🔐 [OPTIONAL AUTH] Token verification failed, continuing without user:', error.message);
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('🔐 [OPTIONAL AUTH] Server error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error in optional authentication middleware.',
      code: 'SERVER_ERROR'
    });
  }
};

// Check if user is admin (optional, for future use)
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Access denied. Authentication required.',
      code: 'NO_AUTH'
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Admin privileges required.',
      code: 'ADMIN_REQUIRED'
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
          code: 'NO_AUTH'
        });
      }

      const resourceId = req.params[resourceIdParam];
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          status: 'error',
          message: 'Resource not found.',
          code: 'RESOURCE_NOT_FOUND'
        });
      }

      // Check if user owns the resource or is admin
      if (resource.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You can only access your own resources.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('🔐 [OWNER CHECK] Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Server error in ownership check.',
        code: 'SERVER_ERROR'
      });
    }
  };
};

// Rate limiting by user with enhanced logging
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
      console.log('🔐 [RATE LIMIT] User exceeded rate limit:', req.user.username);
      return res.status(429).json({
        status: 'error',
        message: 'Rate limit exceeded. Too many requests.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
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
  userRateLimit
};