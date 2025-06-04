const express = require('express');
const User = require('../models/User');
const Video = require('../models/Video');
const { protect, optionalAuth, admin } = require('../middleware/auth');
const { processUploadedVideo, deleteS3Object, getSignedUrl } = require('../services/videoService');
const { ethers } = require('ethers');
const crypto = require('crypto');
const axios = require('axios');
const { getNextBloomDropTime } = require('../services/bloomService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const router = express.Router();

// Configuration pour la récupération du solde de tokens
const TOKEN_CONTRACT_ADDRESS = '0x8b2D045381c7B9E09dC72fc3DDEbC1c74724E78D';
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

// Adresse de paiement officielle (à ne jamais modifier côté client)
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS || '0x21bee69e692ceb4c02b66c7a45620684904ba395';

// Get token balance for an address - MUST BE BEFORE /:username route
router.get('/token-balance/:address', optionalAuth, async (req, res, next) => {
  try {
    const { address } = req.params;
    
    // Validate address format
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid wallet address format',
      });
    }

    try {
      // Try to get balance from blockchain
      const provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'https://worldchain-mainnet.g.alchemy.com/v2/YOUR_KEY'
      );
      
      const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);
      
      const [rawBalance, decimals] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals()
      ]);
      
      const balance = ethers.formatUnits(rawBalance, decimals);
      
      res.status(200).json({
        status: 'success',
        data: {
          address,
          balance: parseFloat(balance),
          rawBalance: rawBalance.toString(),
          decimals: decimals.toString()
        },
      });
    } catch (blockchainError) {
      console.error('Blockchain error:', blockchainError);
      
      // Fallback: return 0 balance if blockchain call fails
      res.status(200).json({
        status: 'success',
        data: {
          address,
          balance: 0,
          rawBalance: '0',
          decimals: '18',
          note: 'Balance fetched from fallback (blockchain temporarily unavailable)'
        },
      });
    }
  } catch (error) {
    console.error('Token balance error:', error);
    next(error);
  }
});

// Search users - MUST BE BEFORE /:username route
router.get('/search/:query', optionalAuth, async (req, res, next) => {
  try {
    const { query } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } }
      ],
      isActive: true
    })
    .select('username displayName avatar verified followersCount')
    .sort({ followersCount: -1 })
    .skip(skip)
    .limit(limit);

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users,
        pagination: {
          page,
          limit,
          hasMore: users.length === limit
        }
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user's credit balance
router.get('/credits', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }
    res.status(200).json({
      status: 'success',
      data: {
        credits: user.credits || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching user credits:', error);
    next(error);
  }
});

// Get user profile
router.get('/:username', optionalAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const userProfile = user.getPublicProfile();

    // Add follow status if authenticated
    if (req.user) {
      userProfile.isFollowing = req.user.following.includes(user._id);
      userProfile.isFollowedBy = user.following.includes(req.user._id);
    } else {
      userProfile.isFollowing = false;
      userProfile.isFollowedBy = false;
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: userProfile,
      },
    });
  } catch (error) {
    next(error);
  }
});

// NOUVELLE ROUTE: Get user's videos
router.get('/:username/videos', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username: req.params.username });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Check if profile is private and user is not following
    if (user.isPrivate && req.user && req.user._id.toString() !== user._id.toString()) {
      const isFollowing = req.user.following.includes(user._id);
      if (!isFollowing) {
        return res.status(403).json({
          status: 'error',
          message: 'This profile is private',
        });
      }
    }

    const videos = await Video.find({
      user: user._id,
      isPublic: true,
      isActive: true,
      // Filtre de modération: uniquement les vidéos approuvées
      moderationStatus: 'approved'
    })
    .populate('user', 'username displayName avatar verified')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    res.status(200).json({
      status: 'success',
      results: videos.length,
      data: {
        videos,
        pagination: {
          page,
          limit,
          hasMore: videos.length === limit
        }
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get user's followers
router.get('/:username/followers', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username: req.params.username })
      .populate({
        path: 'followers',
        select: 'username displayName avatar verified followersCount',
        options: { skip, limit }
      });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      results: user.followers.length,
      data: {
        followers: user.followers,
        pagination: {
          page,
          limit,
          hasMore: user.followers.length === limit
        }
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get user's following
router.get('/:username/following', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username: req.params.username })
      .populate({
        path: 'following',
        select: 'username displayName avatar verified followersCount',
        options: { skip, limit }
      });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      results: user.following.length,
      data: {
        following: user.following,
        pagination: {
          page,
          limit,
          hasMore: user.following.length === limit
        }
      },
    });
  } catch (error) {
    next(error);
  }
});

// Follow/Unfollow user
router.post('/:username/follow', protect, async (req, res, next) => {
  try {
    const targetUser = await User.findOne({ username: req.params.username });

    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot follow yourself',
      });
    }

    const isFollowing = req.user.following.includes(targetUser._id);

    if (isFollowing) {
      // Unfollow
      req.user.following = req.user.following.filter(
        id => id.toString() !== targetUser._id.toString()
      );
      targetUser.followers = targetUser.followers.filter(
        id => id.toString() !== req.user._id.toString()
      );
    } else {
      // Follow
      req.user.following.push(targetUser._id);
      targetUser.followers.push(req.user._id);
    }

    await req.user.updateFollowingCount();
    await targetUser.updateFollowersCount();

    res.status(200).json({
      status: 'success',
      message: isFollowing ? 'User unfollowed' : 'User followed',
      data: {
        isFollowing: !isFollowing,
        followersCount: targetUser.followersCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Route pour initier l'achat de crédits
router.post('/initiate-credit-purchase', protect, async (req, res) => {
  try {
    const { creditAmount } = req.body;
    
    if (!creditAmount || creditAmount <= 0 || creditAmount > 3500) {
      return res.status(400).json({ error: 'Invalid credit amount (1-3500 credits)' });
    }

    // Générer un ID de référence unique
    const reference = crypto.randomUUID().replace(/-/g, '');
    
    // Calculer le prix en WLD (1 WLD = 35 crédits)
    const wldPrice = creditAmount / 35;
    
    if (wldPrice < 0.1) {
      return res.status(400).json({ error: 'Minimum purchase is 4 credits (0.1 WLD)' });
    }

    // Stocker la demande d'achat en tant que pending
    const user = await User.findById(req.user.id);
    user.creditPurchaseHistory.push({
      amount: creditAmount,
      wldPaid: wldPrice,
      transactionId: 'pending',
      reference: reference,
      status: 'pending'
    });
    await user.save();

    res.json({ 
      reference,
      creditAmount,
      wldPrice,
      id: reference 
    });
  } catch (error) {
    console.error('Error initiating credit purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route pour confirmer l'achat de crédits
router.post('/confirm-credit-purchase', protect, async (req, res) => {
  try {
    const { reference, transaction_id } = req.body;
    
    if (!reference || !transaction_id) {
      return res.status(400).json({ error: 'Missing reference or transaction_id' });
    }

    // Vérifier la transaction avec l'API World
    const response = await axios.get(
      `https://developer.worldcoin.org/api/v2/minikit/transaction/${transaction_id}?app_id=${process.env.WORLD_APP_ID}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WORLD_DEV_PORTAL_API_KEY}`,
        },
      }
    );
    
    const transaction = response.data;
    
    if (transaction.reference === reference && transaction.status !== 'failed') {
      // Trouver l'utilisateur et la demande d'achat
      const user = await User.findById(req.user.id);
      const purchaseIndex = user.creditPurchaseHistory.findIndex(
        p => p.reference === reference && p.status === 'pending'
      );
      
      if (purchaseIndex === -1) {
        return res.status(404).json({ error: 'Purchase request not found' });
      }
      
      const purchase = user.creditPurchaseHistory[purchaseIndex];
      
      // Mettre à jour le statut et ajouter les crédits
      user.creditPurchaseHistory[purchaseIndex].status = 'completed';
      user.creditPurchaseHistory[purchaseIndex].transactionId = transaction_id;
      user.credits += purchase.amount;
      
      await user.save();
      
      res.json({ 
        success: true, 
        credits: user.credits,
        purchasedAmount: purchase.amount
      });
    } else {
      // Marquer comme échoué
      const user = await User.findById(req.user.id);
      const purchaseIndex = user.creditPurchaseHistory.findIndex(
        p => p.reference === reference && p.status === 'pending'
      );
      
      if (purchaseIndex !== -1) {
        user.creditPurchaseHistory[purchaseIndex].status = 'failed';
        await user.save();
      }
      
      res.status(400).json({ error: 'Transaction verification failed' });
    }
  } catch (error) {
    console.error('Error confirming credit purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route pour obtenir l'historique des achats de crédits
router.get('/credit-purchase-history', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('creditPurchaseHistory credits');
    res.json({
      credits: user.credits,
      history: user.creditPurchaseHistory.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt))
    });
  } catch (error) {
    console.error('Error fetching credit purchase history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint DEV/TEST pour créditer un utilisateur (à utiliser uniquement en test)
router.post('/add-test-credits', protect, async (req, res) => {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.credits += amount;
    await user.save();
    res.json({ success: true, credits: user.credits });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

// Endpoint sécurisé pour fournir l'adresse de paiement au front
router.get('/payment/address', (req, res) => {
  res.json({ address: PAYMENT_ADDRESS });
});

// Added: Route to get the next Bloom drop time
router.get('/next-bloom-drop', async (req, res, next) => {
  try {
    const nextDropTime = await getNextBloomDropTime();
    res.status(200).json({
      status: 'success',
      data: {
        nextBloomDropTime: nextDropTime
      }
    });
  } catch (error) {
    console.error('Error fetching next bloom drop time:', error);
    next(error); // Pass to error handler
  }
});

module.exports = router;