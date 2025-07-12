const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token with enhanced security
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '30d',
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '90d',
  });
};

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

    // Generate both tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to user (optional, for token revocation)
    user.refreshToken = refreshToken;
    await user.save();

    console.log('✅ New user registered and tokens generated:', user.username);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        token,
        refreshToken,
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
    
    // ALWAYS generate NEW tokens on login
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    // Save new refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    console.log('✅ User login successful with NEW tokens:', user.username);
    console.log('🔄 New JWT Token generated for user:', user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful - New tokens generated',
      data: {
        token,
        refreshToken,
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
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'your-secret-key');
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid refresh token type',
        });
      }

      // Find user
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found or inactive',
        });
      }

      // Verify this is the current refresh token
      if (user.refreshToken !== refreshToken) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid refresh token',
        });
      }

      // Generate new tokens
      const newToken = generateToken(user._id);
      const newRefreshToken = generateRefreshToken(user._id);

      // Update refresh token
      user.refreshToken = newRefreshToken;
      await user.save();

      console.log('✅ Tokens refreshed successfully for user:', user.username);

      res.status(200).json({
        status: 'success',
        message: 'Tokens refreshed successfully',
        data: {
          token: newToken,
          refreshToken: newRefreshToken,
          user: user.getPublicProfile(),
        },
      });
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired refresh token',
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
    
    // Generate new tokens after password change
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    
    await user.save();

    console.log('✅ Password changed and new tokens generated for user:', user.username);

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully - New tokens generated',
      data: {
        token,
        refreshToken,
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

module.exports = router;