const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Centralized JWT configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  accessTokenExpiry: process.env.JWT_EXPIRES_IN || '24h',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  algorithm: 'HS256'
};

// Enhanced logging for token operations
const logTokenOperation = (operation, data) => {
  const timestamp = new Date().toISOString();
  console.log(`🔐 [TOKEN ${operation.toUpperCase()}] ${timestamp} =================================`);
  Object.entries(data).forEach(([key, value]) => {
    if (key.includes('secret') || key.includes('token')) {
      console.log(`🔐 [TOKEN ${operation.toUpperCase()}] ${key}: ${typeof value === 'string' ? value.substring(0, 20) + '...' : value}`);
    } else {
      console.log(`🔐 [TOKEN ${operation.toUpperCase()}] ${key}:`, value);
    }
  });
  console.log(`🔐 [TOKEN ${operation.toUpperCase()}] =================================`);
};

// Generate access token
const generateAccessToken = (userId, additionalPayload = {}) => {
  logTokenOperation('GENERATE_ACCESS', {
    userId,
    jwtSecretConfigured: !!process.env.JWT_SECRET,
    jwtSecretLength: JWT_CONFIG.secret.length,
    expiresIn: JWT_CONFIG.accessTokenExpiry,
    algorithm: JWT_CONFIG.algorithm
  });

  try {
    const payload = {
      id: userId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(), // Unique token ID
      ...additionalPayload
    };

    const token = jwt.sign(payload, JWT_CONFIG.secret, {
      expiresIn: JWT_CONFIG.accessTokenExpiry,
      algorithm: JWT_CONFIG.algorithm
    });

    // Immediate verification test
    const decoded = jwt.verify(token, JWT_CONFIG.secret);
    
    logTokenOperation('GENERATE_ACCESS_SUCCESS', {
      tokenLength: token.length,
      payloadId: decoded.id,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
      jti: decoded.jti
    });

    return token;
  } catch (error) {
    logTokenOperation('GENERATE_ACCESS_ERROR', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Generate refresh token
const generateRefreshToken = (userId, additionalPayload = {}) => {
  logTokenOperation('GENERATE_REFRESH', {
    userId,
    expiresIn: JWT_CONFIG.refreshTokenExpiry
  });

  try {
    const payload = {
      id: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(),
      ...additionalPayload
    };

    const token = jwt.sign(payload, JWT_CONFIG.secret, {
      expiresIn: JWT_CONFIG.refreshTokenExpiry,
      algorithm: JWT_CONFIG.algorithm
    });

    logTokenOperation('GENERATE_REFRESH_SUCCESS', {
      tokenLength: token.length,
      payloadId: payload.id,
      jti: payload.jti
    });

    return token;
  } catch (error) {
    logTokenOperation('GENERATE_REFRESH_ERROR', {
      error: error.message
    });
    throw error;
  }
};

// Verify token with enhanced error handling
const verifyToken = (token, expectedType = 'access') => {
  logTokenOperation('VERIFY', {
    tokenPreview: token.substring(0, 30) + '...',
    tokenLength: token.length,
    expectedType,
    jwtSecretConfigured: !!process.env.JWT_SECRET,
    jwtSecretLength: JWT_CONFIG.secret.length
  });

  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret);
    
    // Verify token type
    if (expectedType && decoded.type !== expectedType) {
      throw new Error(`Invalid token type. Expected '${expectedType}', got '${decoded.type}'`);
    }

    logTokenOperation('VERIFY_SUCCESS', {
      userId: decoded.id,
      tokenType: decoded.type,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
      jti: decoded.jti
    });

    return decoded;
  } catch (error) {
    logTokenOperation('VERIFY_ERROR', {
      error: error.name,
      message: error.message,
      tokenPreview: token.substring(0, 30) + '...'
    });
    throw error;
  }
};

// Generate token pair (access + refresh)
const generateTokenPair = (userId, additionalPayload = {}) => {
  logTokenOperation('GENERATE_PAIR', {
    userId,
    timestamp: new Date().toISOString()
  });

  try {
    const accessToken = generateAccessToken(userId, additionalPayload);
    const refreshToken = generateRefreshToken(userId, additionalPayload);

    logTokenOperation('GENERATE_PAIR_SUCCESS', {
      accessTokenLength: accessToken.length,
      refreshTokenLength: refreshToken.length,
      userId
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: JWT_CONFIG.accessTokenExpiry,
      refreshExpiresIn: JWT_CONFIG.refreshTokenExpiry
    };
  } catch (error) {
    logTokenOperation('GENERATE_PAIR_ERROR', {
      error: error.message,
      userId
    });
    throw error;
  }
};

// Refresh token pair
const refreshTokenPair = (refreshToken) => {
  logTokenOperation('REFRESH_PAIR', {
    refreshTokenPreview: refreshToken.substring(0, 30) + '...'
  });

  try {
    const decoded = verifyToken(refreshToken, 'refresh');
    
    // Generate new token pair
    const newTokenPair = generateTokenPair(decoded.id);
    
    logTokenOperation('REFRESH_PAIR_SUCCESS', {
      userId: decoded.id,
      oldJti: decoded.jti
    });

    return newTokenPair;
  } catch (error) {
    logTokenOperation('REFRESH_PAIR_ERROR', {
      error: error.message
    });
    throw error;
  }
};

// Get JWT configuration info (for debugging)
const getJWTConfig = () => {
  return {
    secretConfigured: !!process.env.JWT_SECRET,
    secretLength: JWT_CONFIG.secret.length,
    secretPreview: JWT_CONFIG.secret.substring(0, 10) + '...',
    accessTokenExpiry: JWT_CONFIG.accessTokenExpiry,
    refreshTokenExpiry: JWT_CONFIG.refreshTokenExpiry,
    algorithm: JWT_CONFIG.algorithm,
    environment: process.env.NODE_ENV || 'development'
  };
};

// Test token generation and verification
const testTokenFlow = (userId = 'test-user-id') => {
  console.log('🧪 [TOKEN TEST] Starting token flow test...');
  
  try {
    // Generate tokens
    const tokenPair = generateTokenPair(userId);
    
    // Verify access token
    const accessDecoded = verifyToken(tokenPair.accessToken, 'access');
    
    // Verify refresh token
    const refreshDecoded = verifyToken(tokenPair.refreshToken, 'refresh');
    
    // Test refresh flow
    const refreshedPair = refreshTokenPair(tokenPair.refreshToken);
    
    console.log('🧪 [TOKEN TEST] ✅ All token operations successful!');
    
    return {
      success: true,
      originalPair: tokenPair,
      accessDecoded,
      refreshDecoded,
      refreshedPair
    };
  } catch (error) {
    console.log('🧪 [TOKEN TEST] ❌ Token flow test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateTokenPair,
  refreshTokenPair,
  getJWTConfig,
  testTokenFlow,
  JWT_CONFIG
}; 