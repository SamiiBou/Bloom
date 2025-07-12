const express = require('express');
const { 
  getJWTConfig, 
  testTokenFlow, 
  generateTokenPair, 
  verifyToken 
} = require('../utils/tokenManager');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/debug/jwt-config - JWT configuration info
router.get('/jwt-config', (req, res) => {
  try {
    const config = getJWTConfig();
    
    res.json({
      status: 'success',
      message: 'JWT configuration information',
      data: {
        ...config,
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
        systemInfo: {
          platform: process.platform,
          nodeVersion: process.version,
          uptime: process.uptime()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error getting JWT configuration',
      error: error.message
    });
  }
});

// GET /api/debug/test-token-flow - Test complete token flow
router.get('/test-token-flow', (req, res) => {
  try {
    const testResult = testTokenFlow();
    
    res.json({
      status: 'success',
      message: 'Token flow test completed',
      data: {
        ...testResult,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error testing token flow',
      error: error.message
    });
  }
});

// POST /api/debug/verify-token - Verify a specific token
router.post('/verify-token', (req, res) => {
  try {
    const { token, expectedType = 'access' } = req.body;
    
    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is required'
      });
    }
    
    console.log('🔍 [DEBUG] Token verification requested');
    
    try {
      const decoded = verifyToken(token, expectedType);
      
      res.json({
        status: 'success',
        message: 'Token verification successful',
        data: {
          isValid: true,
          decoded: decoded,
          tokenType: decoded.type,
          userId: decoded.id,
          expiresAt: new Date(decoded.exp * 1000).toISOString(),
          issuedAt: new Date(decoded.iat * 1000).toISOString(),
          jti: decoded.jti,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.json({
        status: 'error',
        message: 'Token verification failed',
        data: {
          isValid: false,
          error: error.name,
          message: error.message,
          tokenPreview: token.substring(0, 30) + '...',
          jwtConfig: getJWTConfig(),
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error in token verification endpoint',
      error: error.message
    });
  }
});

// GET /api/debug/current-user - Get current user info (requires auth)
router.get('/current-user', protect, (req, res) => {
  try {
    res.json({
      status: 'success',
      message: 'Current user information',
      data: {
        user: req.user.getPublicProfile(),
        authInfo: {
          userId: req.user._id,
          username: req.user.username,
          authMethod: req.user.authMethod,
          isActive: req.user.isActive,
          lastLogin: req.user.lastLogin,
          hasRefreshToken: !!req.user.refreshToken
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error getting current user info',
      error: error.message
    });
  }
});

// GET /api/debug/auth-status - Check authentication status (optional auth)
router.get('/auth-status', optionalAuth, (req, res) => {
  try {
    res.json({
      status: 'success',
      message: 'Authentication status',
      data: {
        isAuthenticated: !!req.user,
        user: req.user ? req.user.getPublicProfile() : null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error checking auth status',
      error: error.message
    });
  }
});

// POST /api/debug/generate-test-token - Generate test token (for debugging)
router.post('/generate-test-token', (req, res) => {
  try {
    const { userId = 'test-user-id' } = req.body;
    
    console.log('🧪 [DEBUG] Test token generation requested for user:', userId);
    
    const tokenPair = generateTokenPair(userId);
    
    res.json({
      status: 'success',
      message: 'Test token generated successfully',
      data: {
        ...tokenPair,
        userId: userId,
        timestamp: new Date().toISOString(),
        warning: 'This is a test token for debugging purposes only'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error generating test token',
      error: error.message
    });
  }
});

// GET /api/debug/health - Health check with JWT info
router.get('/health', (req, res) => {
  try {
    const jwtConfig = getJWTConfig();
    
    res.json({
      status: 'success',
      message: 'Debug service health check',
      data: {
        service: 'JWT Debug Service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        jwt: {
          secretConfigured: jwtConfig.secretConfigured,
          secretLength: jwtConfig.secretLength,
          accessTokenExpiry: jwtConfig.accessTokenExpiry,
          refreshTokenExpiry: jwtConfig.refreshTokenExpiry,
          algorithm: jwtConfig.algorithm
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

module.exports = router; 