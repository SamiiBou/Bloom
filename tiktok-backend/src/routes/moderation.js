const express = require('express');
const Video = require('../models/Video');
const ModerationResult = require('../models/ModerationResult');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const contentModerationService = require('../services/contentModerationService');

const router = express.Router();

// Middleware pour vérifier les permissions d'administrateur
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Vérifier si l'utilisateur est admin (vous pouvez adapter selon votre système)
    const user = await User.findById(req.user._id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin privileges required'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error checking admin privileges'
    });
  }
};

// Obtenir les statistiques de modération
router.get('/stats', protect, requireAdmin, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '7d';
    
    console.log(`📊 Récupération des stats de modération (${timeframe})`);
    
    const stats = await ModerationResult.getModerationStats(timeframe);
    
    // Statistiques supplémentaires des vidéos
    const videoStats = await Video.aggregate([
      {
        $group: {
          _id: '$moderationStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const videoStatusCounts = {};
    videoStats.forEach(stat => {
      videoStatusCounts[stat._id] = stat.count;
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        moderation: stats,
        videoStatus: {
          pending: videoStatusCounts.pending || 0,
          approved: videoStatusCounts.approved || 0,
          rejected: videoStatusCounts.rejected || 0,
          under_review: videoStatusCounts.under_review || 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch moderation stats'
    });
  }
});

// Obtenir les vidéos en attente de modération
router.get('/pending', protect, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = req.query.filter || 'all'; // 'all', 'needs_review', 'auto_rejected'
    
    let matchConditions = {};
    
    switch (filter) {
      case 'needs_review':
        matchConditions = {
          'contentModeration.needsManualReview': true,
          moderationStatus: 'under_review'
        };
        break;
      case 'auto_rejected':
        matchConditions = {
          'contentModeration.autoModerationStatus': 'rejected',
          moderationStatus: 'rejected'
        };
        break;
      case 'pending':
        matchConditions = {
          moderationStatus: 'pending'
        };
        break;
      default:
        matchConditions = {
          moderationStatus: { $in: ['pending', 'under_review'] }
        };
    }
    
    console.log(`🔍 Récupération des vidéos en modération (filtre: ${filter})`);
    
    const videos = await Video.find(matchConditions)
      .populate('user', 'username displayName avatar verified')
      .populate('contentModeration.autoModerationResult')
      .sort({ 'contentModeration.lastModeratedAt': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Video.countDocuments(matchConditions);
    
    const videosWithDetails = videos.map(video => {
      const videoObj = video.toObject();
      
      // Ajouter les détails de modération si disponibles
      if (video.contentModeration.autoModerationResult) {
        videoObj.moderationDetails = video.contentModeration.autoModerationResult;
      }
      
      return videoObj;
    });
    
    res.status(200).json({
      status: 'success',
      results: videos.length,
      data: {
        videos: videosWithDetails,
        pagination: {
          page,
          limit,
          total,
          hasMore: skip + videos.length < total
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des vidéos en attente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch pending videos'
    });
  }
});

// Approuver manuellement une vidéo
router.post('/:videoId/approve', protect, requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { notes } = req.body;
    
    console.log(`✅ Approbation manuelle de la vidéo: ${videoId}`);
    
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found'
      });
    }
    
    // Mettre à jour la vidéo
    const updateData = {
      moderationStatus: 'approved',
      'contentModeration.autoModerationStatus': 'approved',
      'contentModeration.isAutoApproved': false, // Approuvé manuellement
      'contentModeration.needsManualReview': false,
      'contentModeration.lastModeratedAt': new Date(),
      'contentModeration.manualReview.reviewed': true,
      'contentModeration.manualReview.reviewedBy': req.user._id,
      'contentModeration.manualReview.reviewedAt': new Date(),
      'contentModeration.manualReview.reviewDecision': 'approve',
      'contentModeration.manualReview.reviewNotes': notes || ''
    };
    
    await Video.findByIdAndUpdate(videoId, updateData);
    
    // Mettre à jour le résultat de modération si il existe
    if (video.contentModeration.autoModerationResult) {
      await ModerationResult.findByIdAndUpdate(
        video.contentModeration.autoModerationResult,
        {
          action: 'approved',
          'manualReview.reviewed': true,
          'manualReview.reviewedBy': req.user._id,
          'manualReview.reviewedAt': new Date(),
          'manualReview.reviewDecision': 'approve',
          'manualReview.reviewNotes': notes || ''
        }
      );
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Video approved successfully',
      data: {
        videoId,
        action: 'approved',
        reviewedBy: req.user.username
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'approbation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to approve video'
    });
  }
});

// Rejeter manuellement une vidéo
router.post('/:videoId/reject', protect, requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { reason, notes } = req.body;
    
    console.log(`🚫 Rejet manuel de la vidéo: ${videoId}`);
    
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found'
      });
    }
    
    // Mettre à jour la vidéo
    const updateData = {
      moderationStatus: 'rejected',
      'contentModeration.autoModerationStatus': 'rejected',
      'contentModeration.isAutoApproved': false,
      'contentModeration.needsManualReview': false,
      'contentModeration.lastModeratedAt': new Date(),
      'contentModeration.manualReview.reviewed': true,
      'contentModeration.manualReview.reviewedBy': req.user._id,
      'contentModeration.manualReview.reviewedAt': new Date(),
      'contentModeration.manualReview.reviewDecision': 'reject',
      'contentModeration.manualReview.reviewNotes': notes || ''
    };
    
    if (reason) {
      updateData['contentModeration.rejectionReasons'] = [reason];
    }
    
    await Video.findByIdAndUpdate(videoId, updateData);
    
    // Mettre à jour le résultat de modération si il existe
    if (video.contentModeration.autoModerationResult) {
      await ModerationResult.findByIdAndUpdate(
        video.contentModeration.autoModerationResult,
        {
          action: 'rejected',
          'manualReview.reviewed': true,
          'manualReview.reviewedBy': req.user._id,
          'manualReview.reviewedAt': new Date(),
          'manualReview.reviewDecision': 'reject',
          'manualReview.reviewNotes': notes || ''
        }
      );
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Video rejected successfully',
      data: {
        videoId,
        action: 'rejected',
        reason,
        reviewedBy: req.user.username
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du rejet:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reject video'
    });
  }
});

// Relancer la modération automatique sur une vidéo
router.post('/:videoId/remoderate', protect, requireAdmin, async (req, res) => {
  try {
    const { videoId } = req.params;
    
    console.log(`🔄 Nouvelle modération pour la vidéo: ${videoId}`);
    
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found'
      });
    }
    
    // Marquer comme en cours d'analyse
    await Video.findByIdAndUpdate(videoId, {
      'contentModeration.autoModerationStatus': 'analyzing',
      'contentModeration.lastModeratedAt': new Date()
    });
    
    // Relancer la modération (utiliser l'URL S3 cette fois)
    const moderationResult = await contentModerationService.moderateVideoFromUrl(video.videoUrl, {
      failSafe: 'allow'
    });
    
    // Sauvegarder le nouveau résultat
    const moderationDoc = new ModerationResult({
      video: video._id,
      user: video.user,
      isAllowed: moderationResult.isAllowed,
      confidence: moderationResult.confidence,
      detectedContent: moderationResult.detectedContent,
      details: moderationResult.details,
      warnings: moderationResult.warnings,
      error: moderationResult.error,
      processingTime: 0, // Pas calculé pour la remodération
      action: moderationResult.isAllowed ? 'approved' : 'rejected'
    });
    
    await moderationDoc.save();
    
    // Mettre à jour la vidéo
    const updateData = {
      'contentModeration.autoModerationStatus': moderationResult.isAllowed ? 'approved' : 'rejected',
      'contentModeration.autoModerationResult': moderationDoc._id,
      'contentModeration.isAutoApproved': moderationResult.isAllowed,
      'contentModeration.moderationConfidence': moderationResult.confidence,
      'contentModeration.lastModeratedAt': new Date(),
      'contentModeration.needsManualReview': !moderationResult.isAllowed && moderationResult.confidence < 0.9
    };
    
    if (!moderationResult.isAllowed) {
      updateData['contentModeration.rejectionReasons'] = moderationResult.detectedContent;
      updateData.moderationStatus = updateData['contentModeration.needsManualReview'] ? 'under_review' : 'rejected';
    } else {
      updateData.moderationStatus = 'approved';
    }
    
    await Video.findByIdAndUpdate(videoId, updateData);
    
    res.status(200).json({
      status: 'success',
      message: 'Video remoderated successfully',
      data: {
        videoId,
        result: {
          isAllowed: moderationResult.isAllowed,
          confidence: moderationResult.confidence,
          detectedContent: moderationResult.detectedContent
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la nouvelle modération:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to remoderate video',
      error: error.message
    });
  }
});

// Mettre à jour la configuration de modération
router.put('/config', protect, requireAdmin, async (req, res) => {
  try {
    const { 
      adultContentThreshold,
      violentContentThreshold,
      racyContentThreshold
    } = req.body;
    
    const newConfig = {};
    
    if (adultContentThreshold !== undefined) {
      newConfig.adultContentThreshold = Math.max(0, Math.min(1, adultContentThreshold));
    }
    if (violentContentThreshold !== undefined) {
      newConfig.violentContentThreshold = Math.max(0, Math.min(1, violentContentThreshold));
    }
    if (racyContentThreshold !== undefined) {
      newConfig.racyContentThreshold = Math.max(0, Math.min(1, racyContentThreshold));
    }
    
    contentModerationService.updateModerationConfig(newConfig);
    
    res.status(200).json({
      status: 'success',
      message: 'Moderation configuration updated',
      data: {
        config: contentModerationService.moderationConfig
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update configuration'
    });
  }
});

// Obtenir la configuration actuelle
router.get('/config', protect, requireAdmin, async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      data: {
        config: contentModerationService.moderationConfig
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch configuration'
    });
  }
});

module.exports = router; 