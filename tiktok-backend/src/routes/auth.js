const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { generateTokenPair, verifyToken, refreshTokenPair } = require('../utils/tokenManager');

const router = express.Router();

// Register user
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, displayName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username },
        { email: email || null }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this username or email',
      });
    }

    // Create user
    const user = await User.create({
      username,
      email: email || undefined,
      password,
      displayName: displayName || username,
    });

    // Generate token pair with centralized manager
    const tokenPair = generateTokenPair(user._id);

    // Save refresh token to user (optional, for token revocation)
    user.refreshToken = tokenPair.refreshToken;
    await user.save();

    console.log('✅ New user registered and tokens generated:', user.username);
    console.log('🔑 [REGISTER] Token pair generated for user:', user._id);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        expiresIn: tokenPair.expiresIn,
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        status: 'error',
        message: `${field} already exists`,
      });
    }
    next(error);
  }
});

// Enhanced Login - Always generate NEW tokens
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, username } = req.body;

    // Check if email/username and password are provided
    if ((!email && !username) || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email/username and password',
      });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: email || null },
        { username: username || null }
      ]
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    
    // ALWAYS generate NEW tokens on login using centralized manager
    const tokenPair = generateTokenPair(user._id);
    
    // Save new refresh token to user
    user.refreshToken = tokenPair.refreshToken;
    await user.save();

    console.log('✅ User login successful with NEW tokens:', user.username);
    console.log('🔑 [LOGIN] Fresh token pair generated for user:', user._id);
    console.log('🔑 [LOGIN] Token will be valid for:', tokenPair.expiresIn);

    res.status(200).json({
      status: 'success',
      message: 'Login successful - Fresh tokens generated',
      data: {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        expiresIn: tokenPair.expiresIn,
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    next(error);
  }
});

// Token Refresh Endpoint
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token required',
      });
    }

    try {
      // Verify refresh token using centralized manager
      const decoded = verifyToken(refreshToken, 'refresh');

      // Find user and explicitly select refreshToken field
      const user = await User.findById(decoded.id).select('+refreshToken');
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found or inactive',
        });
      }

      // Verify this is the current refresh token
      if (user.refreshToken !== refreshToken) {
        console.log('🔐 [REFRESH] Refresh token mismatch');
        console.log('🔐 [REFRESH] Expected:', user.refreshToken?.substring(0, 30) + '...');
        console.log('🔐 [REFRESH] Received:', refreshToken.substring(0, 30) + '...');
        return res.status(401).json({
          status: 'error',
          message: 'Invalid refresh token - token mismatch',
        });
      }

      // Generate new token pair using centralized manager
      const newTokenPair = generateTokenPair(user._id);

      // Update refresh token
      user.refreshToken = newTokenPair.refreshToken;
      await user.save();

      console.log('✅ Tokens refreshed successfully for user:', user.username);
      console.log('🔑 [REFRESH] New token pair generated for user:', user._id);

      res.status(200).json({
        status: 'success',
        message: 'Tokens refreshed successfully',
        data: {
          token: newTokenPair.accessToken,
          refreshToken: newTokenPair.refreshToken,
          tokenType: newTokenPair.tokenType,
          expiresIn: newTokenPair.expiresIn,
          user: user.getPublicProfile(),
        },
      });
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
        debug: {
          errorName: error.name,
          errorMessage: error.message,
          suggestion: 'Please login again to get new tokens'
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      status: 'success',
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/me', protect, async (req, res, next) => {
  try {
    const allowedUpdates = ['displayName', 'bio', 'avatar', 'isPrivate'];
    const updates = {};

    // Filter allowed updates
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid updates provided',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.put('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide current password and new password',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect',
      });
    }

    user.password = newPassword;
    
    // Generate new token pair after password change using centralized manager
    const tokenPair = generateTokenPair(user._id);
    user.refreshToken = tokenPair.refreshToken;
    
    await user.save();

    console.log('✅ Password changed and new tokens generated for user:', user.username);
    console.log('🔑 [PASSWORD_CHANGE] Fresh token pair generated for user:', user._id);

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully - Fresh tokens generated',
      data: {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        expiresIn: tokenPair.expiresIn,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Enhanced Logout - invalidate refresh token
router.post('/logout', protect, async (req, res, next) => {
  try {
    // Clear refresh token from user
    await User.findByIdAndUpdate(req.user._id, { 
      $unset: { refreshToken: "" } 
    });

    console.log('✅ User logged out and refresh token cleared:', req.user.username);

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

// World ID verification endpoint
router.post('/worldcoin-verify', async (req, res, next) => {
  try {
    const { proof, merkle_root, nullifier_hash, action, signal, app_id } = req.body;

    console.log('World ID verification data:', req.body);

    // Vérifier que les données requises sont présentes
    if (!proof || !merkle_root || !nullifier_hash || !action || !app_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required verification data',
      });
    }

    // Vérifier l'action
    if (action !== 'verifyhuman') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action for human verification',
      });
    }

    // Vérifier l'app_id
    if (app_id !== process.env.WORLD_APP_ID && app_id !== 'app_f957956822118ea9a349f25a28f41176') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid app ID',
      });
    }

    // Vérifier si ce nullifier_hash a déjà été utilisé
    const existingUser = await User.findOne({ humanVerificationNullifier: nullifier_hash });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'This verification has already been used',
      });
    }

    // TODO: Ici, en production, vous devriez vérifier la preuve avec l'API World ID
    // const verifyCloudProof = require('@worldcoin/minikit-js').verifyCloudProof;
    // const verifyRes = await verifyCloudProof(
    //   { proof, merkle_root, nullifier_hash },
    //   app_id,
    //   action,
    //   signal
    // );
    // if (!verifyRes.success) {
    //   return res.status(400).json({
    //     status: 'error',
    //     message: 'Invalid World ID proof',
    //   });
    // }

    // Simuler la vérification réussie pour le développement
    console.log('✅ World ID verification simulated as successful');

    res.status(200).json({
      status: 'success',
      message: 'World ID verification successful',
      data: {
        verified: true,
        nullifier_hash,
        action,
        tokensBonus: true, // Indique que l'utilisateur peut recevoir le bonus
      },
    });
  } catch (error) {
    console.error('World ID verification error:', error);
    next(error);
  }
});

// Mettre à jour le statut de vérification humaine de l'utilisateur
router.post('/update-human-verification', protect, async (req, res, next) => {
  try {
    const { nullifier_hash, verification_level } = req.body;

    if (!nullifier_hash) {
      return res.status(400).json({
        status: 'error',
        message: 'Nullifier hash is required',
      });
    }

    // Vérifier si ce nullifier_hash a déjà été utilisé par un autre utilisateur
    const existingUser = await User.findOne({ 
      humanVerificationNullifier: nullifier_hash,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'This verification has already been used by another user',
      });
    }

    // Mettre à jour l'utilisateur actuel
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        humanVerified: true,
        humanVerifiedAt: new Date(),
        humanVerificationNullifier: nullifier_hash,
        minikitVerificationLevel: verification_level || 'orb',
        // Bonus de tokens pour la vérification humaine
        $inc: { grabBalance: 10 } // 10 tokens bonus
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    console.log(`✅ User ${updatedUser.username} verified as human with bonus tokens`);

    res.json({
      status: 'success',
      message: 'Human verification updated successfully',
      data: {
        humanVerified: updatedUser.humanVerified,
        tokensBonus: 10,
        newBalance: updatedUser.grabBalance,
        verifiedAt: updatedUser.humanVerifiedAt
      }
    });

  } catch (error) {
    console.error('Update human verification error:', error);
    next(error);
  }
});

// DEBUG: Token configuration info
router.get('/debug/token-config', (req, res) => {
  try {
    const { getJWTConfig } = require('../utils/tokenManager');
    const config = getJWTConfig();
    
    res.json({
      status: 'success',
      message: 'JWT configuration info',
      data: {
        ...config,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error getting JWT config',
      error: error.message
    });
  }
});

// DEBUG: Test token flow
router.get('/debug/test-token-flow', (req, res) => {
  try {
    const { testTokenFlow } = require('../utils/tokenManager');
    const testResult = testTokenFlow();
    
    res.json({
      status: 'success',
      message: 'Token flow test completed',
      data: testResult
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error testing token flow',
      error: error.message
    });
  }
});

// EMERGENCY: Force token refresh for authenticated users
router.post('/emergency-refresh', protect, async (req, res) => {
  try {
    console.log('🚨 [EMERGENCY_REFRESH] Emergency token refresh requested by user:', req.user._id);
    
    // Generate completely new token pair
    const tokenPair = generateTokenPair(req.user._id);
    
    // Update refresh token in database
    const user = await User.findById(req.user._id);
    user.refreshToken = tokenPair.refreshToken;
    user.lastLogin = new Date(); // Update last login
    await user.save();
    
    console.log('🚨 [EMERGENCY_REFRESH] Emergency tokens generated successfully for user:', req.user.username);
    
    res.status(200).json({
      status: 'success',
      message: 'Emergency token refresh completed - Use these new tokens immediately',
      data: {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        expiresIn: tokenPair.expiresIn,
        user: user.getPublicProfile(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('🚨 [EMERGENCY_REFRESH] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Emergency token refresh failed',
      error: error.message
    });
  }
});

// EMERGENCY: Force token refresh without authentication (using refresh token)
router.post('/emergency-refresh-with-refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token is required'
      });
    }
    
    console.log('🚨 [EMERGENCY_REFRESH_RT] Emergency refresh with refresh token requested');
    
    // Use the existing refresh token logic
    const decoded = verifyToken(refreshToken, 'refresh');
    
    // Find user and explicitly select refreshToken field
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found or inactive'
      });
    }
    
    // Generate new token pair
    const tokenPair = generateTokenPair(user._id);
    
    // Update refresh token
    user.refreshToken = tokenPair.refreshToken;
    user.lastLogin = new Date();
    await user.save();
    
    console.log('🚨 [EMERGENCY_REFRESH_RT] Emergency tokens generated successfully for user:', user.username);
    
    res.status(200).json({
      status: 'success',
      message: 'Emergency token refresh completed with refresh token',
      data: {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        expiresIn: tokenPair.expiresIn,
        user: user.getPublicProfile(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('🚨 [EMERGENCY_REFRESH_RT] Error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Emergency token refresh failed',
      error: error.message,
      suggestion: 'Please login again to get fresh tokens'
    });
  }
});

module.exports = router;