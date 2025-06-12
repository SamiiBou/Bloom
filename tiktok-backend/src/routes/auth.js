const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '30d',
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

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        token,
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

// Login user
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
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: user.getPublicProfile(),
      },
    });
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
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Logout (invalidate token - in a real app, you'd use a blacklist)
router.post('/logout', protect, (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

// World ID verification endpoint
router.post('/worldcoin-verify', async (req, res, next) => {
  try {
    const { proof, merkle_root, nullifier_hash, action, signal, app_id, verification_level } = req.body;

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

    // Vérifier la preuve avec l'API World ID - IMPLÉMENTATION RÉELLE
    try {
      const { verifyCloudProof } = require('@worldcoin/minikit-js');
      
      console.log('🔍 Verifying proof with World ID API...');
      
      const verifyRes = await verifyCloudProof(
        { 
          proof, 
          merkle_root, 
          nullifier_hash,
          verification_level: verification_level || 'orb'
        },
        app_id,
        action,
        signal
      );

      console.log('🌐 World ID API response:', verifyRes);

      if (!verifyRes.success) {
        console.error('❌ World ID proof verification failed:', verifyRes);
        return res.status(400).json({
          status: 'error',
          message: 'Invalid World ID proof - verification failed',
          details: verifyRes.detail || 'Proof verification rejected by World ID'
        });
      }

      console.log('✅ World ID proof verification successful');

    } catch (verifyError) {
      console.error('❌ Error during World ID proof verification:', verifyError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to verify proof with World ID service',
        details: verifyError.message
      });
    }

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