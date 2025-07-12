const express = require('express');
const Video = require('../models/Video');
const User = require('../models/User');
const ModerationResult = require('../models/ModerationResult');
const { protect, optionalAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const contentModerationService = require('../services/contentModerationService');
const { uploadToBunny } = require('../config/bunny');

const router = express.Router();

// Configuration Multer pour l'upload de fichiers
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Helper function to upload to Bunny CDN
const uploadToBunnyCDN = async (file, folder = 'videos') => {
  const result = await uploadToBunny(file.buffer, file.originalname, folder, file.mimetype);
  return {
    url: result.url,
    key: result.key
  };
};

/**
 * Fonction utilitaire pour effectuer la modération de contenu
 */
async function performContentModeration(video, videoUrl = null) {
  console.log(`🛡️ Démarrage de la modération de contenu pour la vidéo: ${video._id}`);
  
  let moderationResult;
  let processingStartTime = Date.now();
  
  try {
    // Utiliser l'URL pour la modération si fournie, sinon utiliser l'URL de la vidéo
    const urlToModerate = videoUrl || video.videoUrl;
    
    moderationResult = await contentModerationService.moderateVideoFromUrl(urlToModerate, {
      failSafe: 'allow' // En cas d'erreur, autoriser la vidéo par défaut
    });
    
    const processingTime = Date.now() - processingStartTime;
    
    // Sauvegarder le résultat de modération
    const moderationDoc = new ModerationResult({
      video: video._id,
      user: video.user,
      isAllowed: moderationResult.isAllowed,
      confidence: moderationResult.confidence,
      detectedContent: moderationResult.detectedContent,
      details: moderationResult.details,
      warnings: moderationResult.warnings,
      error: moderationResult.error,
      processingTime: processingTime,
      moderationConfig: {
        adultContentThreshold: contentModerationService.moderationConfig.adultContentThreshold,
        violentContentThreshold: contentModerationService.moderationConfig.violentContentThreshold,
        racyContentThreshold: contentModerationService.moderationConfig.racyContentThreshold
      },
      action: moderationResult.isAllowed ? 'approved' : 'rejected'
    });
    
    await moderationDoc.save();
    
    // Mettre à jour la vidéo avec les résultats de modération
    const updateData = {
      'contentModeration.autoModerationStatus': moderationResult.isAllowed ? 'approved' : 'rejected',
      'contentModeration.autoModerationResult': moderationDoc._id,
      'contentModeration.isAutoApproved': moderationResult.isAllowed,
      'contentModeration.moderationConfidence': moderationResult.confidence,
      'contentModeration.lastModeratedAt': new Date()
    };
    
    // Déterminer si une révision manuelle est nécessaire
    const needsManualReview = !moderationResult.isAllowed && moderationResult.confidence < 0.9;
    updateData['contentModeration.needsManualReview'] = needsManualReview;
    
    if (!moderationResult.isAllowed) {
      updateData['contentModeration.rejectionReasons'] = moderationResult.detectedContent;
      updateData.moderationStatus = needsManualReview ? 'under_review' : 'rejected';
    } else {
      updateData.moderationStatus = 'approved';
    }
    
    await Video.findByIdAndUpdate(video._id, updateData);
    
    console.log(`🛡️ Modération terminée: ${moderationResult.isAllowed ? 'APPROUVÉ' : 'REJETÉ'} (confiance: ${(moderationResult.confidence * 100).toFixed(1)}%)`);
    if (moderationResult.detectedContent.length > 0) {
      console.log(`🚨 Problèmes détectés: ${moderationResult.detectedContent.join(', ')}`);
    }
    
    return moderationResult;
    
  } catch (moderationError) {
    console.error('❌ Erreur lors de la modération:', moderationError);
    
    // En cas d'erreur, marquer pour révision manuelle
    await Video.findByIdAndUpdate(video._id, {
      'contentModeration.autoModerationStatus': 'error',
      'contentModeration.needsManualReview': true,
      moderationStatus: 'under_review'
    });
    
    return {
      isAllowed: false, // Par sécurité, ne pas approuver automatiquement
      confidence: 0,
      detectedContent: ['moderation_error'],
      error: moderationError.message
    };
  }
}

// Get all videos (feed)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type; // 'short', 'long' ou undefined pour tous
    const skip = (page - 1) * limit;

    console.log(`📱 Récupération des vidéos - Page: ${page}, Limit: ${limit}, Type: ${type || 'tous'}`);

    // Construire le filtre de recherche
    const filter = { 
      isPublic: true, 
      isActive: true,
      // Filtre de modération: uniquement les vidéos approuvées
      moderationStatus: 'approved'
    };

    // Ajouter le filtre de type si spécifié
    if (type && ['short', 'long'].includes(type)) {
      filter.type = type;
    }

    const videos = await Video.find(filter)
    .populate('user', 'username displayName avatar verified')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    // Ajouter les informations de like/follow pour l'utilisateur connecté
    let videosWithUserData = videos;
    if (req.user) {
      videosWithUserData = videos.map(video => {
        const videoObj = video.toObject();
        videoObj.isLiked = video.isLikedByUser(req.user._id);
        // TODO: Ajouter isFollowing si nécessaire
        return videoObj;
      });
    }

    console.log(`✅ ${videos.length} vidéos récupérées (type: ${type || 'tous'})`);

    res.status(200).json({
      status: 'success',
      results: videos.length,
      data: {
        videos: videosWithUserData,
        pagination: {
          page,
          limit,
          hasMore: videos.length === limit
        }
      },
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des vidéos:', error);
    next(error);
  }
});

// NOUVELLE ROUTE: Get following videos (feed des abonnements)
router.get('/following', protect, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log(`👥 Récupération des vidéos des abonnements - User: ${req.user.username}, Page: ${page}`);

    // Récupérer les utilisateurs suivis
    const currentUser = await User.findById(req.user._id).populate('following');
    const followingIds = currentUser.following.map(user => user._id);

    if (followingIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: {
          videos: [],
          pagination: {
            page,
            limit,
            hasMore: false
          }
        },
      });
    }

    const videos = await Video.find({ 
      user: { $in: followingIds },
      isPublic: true, 
      isActive: true,
      // Filtre de modération: uniquement les vidéos approuvées
      moderationStatus: 'approved'
    })
    .populate('user', 'username displayName avatar verified')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    // Ajouter les informations de like pour l'utilisateur connecté
    const videosWithUserData = videos.map(video => {
      const videoObj = video.toObject();
      videoObj.isLiked = video.isLikedByUser(req.user._id);
      videoObj.user.isFollowing = true; // Par définition, puisqu'on suit ces utilisateurs
      return videoObj;
    });

    console.log(`✅ ${videos.length} vidéos des abonnements récupérées`);

    res.status(200).json({
      status: 'success',
      results: videos.length,
      data: {
        videos: videosWithUserData,
        pagination: {
          page,
          limit,
          hasMore: videos.length === limit
        }
      },
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des vidéos suivies:', error);
    next(error);
  }
});

// Get video by ID
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    console.log(`🎥 Récupération de la vidéo ID: ${req.params.id}`);

    const video = await Video.findById(req.params.id)
      .populate('user', 'username displayName avatar verified')
      .populate('comments.user', 'username displayName avatar');

    if (!video || !video.isActive) {
      console.log(`❌ Vidéo non trouvée: ${req.params.id}`);
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    // Add view if user is authenticated
    if (req.user) {
      await video.addView(
        req.user._id, 
        req.ip, 
        req.get('User-Agent')
      );
    }

    const videoObj = video.toObject();
    if (req.user) {
      videoObj.isLiked = video.isLikedByUser(req.user._id);
    }

    console.log(`✅ Vidéo récupérée: ${video.description?.substring(0, 50)}...`);

    res.status(200).json({
      status: 'success',
      data: {
        video: videoObj,
      },
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la vidéo:', error);
    next(error);
  }
});

// Like/Unlike video
router.post('/:id/like', protect, async (req, res, next) => {
  try {
    console.log(`❤️ Toggle like vidéo ${req.params.id} par ${req.user.username}`);

    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    const likeIndex = video.likes.findIndex(
      like => like.user.toString() === req.user._id.toString()
    );

    if (likeIndex > -1) {
      // Unlike
      video.likes.splice(likeIndex, 1);
      console.log(`💔 Unlike par ${req.user.username}`);
    } else {
      // Like
      video.likes.push({ user: req.user._id });
      console.log(`❤️ Like par ${req.user.username}`);
    }

    await video.updateLikesCount();

    res.status(200).json({
      status: 'success',
      message: likeIndex > -1 ? 'Video unliked' : 'Video liked',
      data: {
        isLiked: likeIndex === -1,
        likesCount: video.likesCount,
      },
    });
  } catch (error) {
    console.error('❌ Erreur lors du like/unlike:', error);
    next(error);
  }
});

// Add comment to video
router.post('/:videoId/comments', protect, async (req, res, next) => {
  try {
    const { content } = req.body;

    console.log(`💬 Ajout commentaire sur vidéo ${req.params.videoId} par ${req.user.username}`);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Comment content is required',
      });
    }

    if (content.trim().length > 500) {
      return res.status(400).json({
        status: 'error',
        message: 'Comment cannot exceed 500 characters',
      });
    }

    const video = await Video.findById(req.params.videoId);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    video.comments.push({
      user: req.user._id,
      text: content.trim(),
    });

    await video.updateCommentsCount();

    // Populate the new comment for response
    await video.populate('comments.user', 'username displayName avatar');

    const newComment = video.comments[video.comments.length - 1];

    console.log(`✅ Commentaire ajouté: "${content.substring(0, 30)}..."`);

    res.status(201).json({
      status: 'success',
      message: 'Comment added successfully',
      data: {
        comment: newComment,
        commentsCount: video.commentsCount,
      },
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout du commentaire:', error);
    next(error);
  }
});

// Get comments for a video
router.get('/:videoId/comments', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    console.log(`💬 Récupération des commentaires - Vidéo: ${req.params.videoId}, Page: ${page}`);

    const video = await Video.findById(req.params.videoId)
      .populate({
        path: 'comments.user',
        select: 'username displayName avatar verified'
      });

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    // Sort comments by date (newest first) and paginate
    const allComments = video.comments.sort((a, b) => b.createdAt - a.createdAt);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const comments = allComments.slice(startIndex, endIndex);

    console.log(`✅ ${comments.length} commentaires récupérés sur ${allComments.length} total`);

    res.status(200).json({
      status: 'success',
      results: comments.length,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total: allComments.length,
          hasMore: endIndex < allComments.length
        }
      },
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des commentaires:', error);
    next(error);
  }
});

// NOUVELLE ROUTE: Delete comment
router.delete('/:videoId/comments/:commentId', protect, async (req, res, next) => {
  try {
    console.log(`🗑️ Suppression commentaire ${req.params.commentId} par ${req.user.username}`);

    const video = await Video.findById(req.params.videoId);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    const comment = video.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found',
      });
    }

    // Vérifier que l'utilisateur peut supprimer ce commentaire
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this comment',
      });
    }

    comment.remove();
    await video.updateCommentsCount();

    console.log(`✅ Commentaire supprimé`);

    res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du commentaire:', error);
    next(error);
  }
});

// Delete video (only owner)
router.delete('/:id', protect, async (req, res, next) => {
  try {
    console.log(`🗑️ Suppression vidéo ${req.params.id} par ${req.user.username}`);

    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found',
      });
    }

    if (video.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this video',
      });
    }

    // TODO: Delete video files from S3 using video.videoKey and video.thumbnailKey

    await Video.findByIdAndDelete(req.params.id);

    // Update user's video count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { videosCount: -1 }
    });

    console.log(`✅ Vidéo supprimée`);

    res.status(200).json({
      status: 'success',
      message: 'Video deleted successfully',
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la vidéo:', error);
    next(error);
  }
});

// Create video from URL (for AI-generated videos)
router.post('/', protect, async (req, res, next) => {
  try {
    const { videoUrl, description, hashtags, metadata, title, category, type } = req.body;

    console.log(`🎬 Création d'une nouvelle vidéo par ${req.user.username}`);

    if (!videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Video URL is required',
      });
    }

    // Déterminer le type de vidéo
    let videoType = 'short'; // Par défaut
    if (type && ['short', 'long'].includes(type)) {
      videoType = type;
    }

    // Créer la nouvelle vidéo avec statut de modération initial
    const video = new Video({
      user: req.user._id,
      title: title || 'Nouvelle vidéo',
      videoUrl: videoUrl,
      description: description || 'Nouvelle vidéo',
      category: category || 'other',
      type: videoType,
      hashtags: hashtags || [],
      metadata: metadata || {},
      isPublic: true,
      isActive: true,
      // Définir le statut de modération initial
      moderationStatus: 'pending',
      contentModeration: {
        autoModerationStatus: 'analyzing',
        isAutoApproved: false,
        needsManualReview: false,
        lastModeratedAt: new Date()
      }
    });

    await video.save();

    // Effectuer la modération de contenu
    console.log(`🛡️ Démarrage de la modération de contenu...`);
    const moderationResult = await performContentModeration(video, videoUrl);

    // Mettre à jour le compteur de vidéos de l'utilisateur
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { videosCount: 1 }
    });

    // Populer les données utilisateur pour la réponse
    await video.populate('user', 'username displayName avatar verified');

    console.log(`✅ Vidéo créée avec succès: ${video._id}`);

    // Réponse incluant les informations de modération
    res.status(201).json({
      status: 'success',
      message: 'Video created and moderated successfully',
      data: {
        video: video
      },
      moderation: {
        status: moderationResult.isAllowed ? 'approved' : 'rejected',
        confidence: moderationResult.confidence,
        detectedIssues: moderationResult.detectedContent,
        needsReview: !moderationResult.isAllowed && moderationResult.confidence < 0.9,
        message: moderationResult.isAllowed 
          ? 'Contenu approuvé automatiquement' 
          : moderationResult.confidence < 0.9 
            ? 'Contenu en attente de révision manuelle'
            : 'Contenu rejeté automatiquement'
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création de la vidéo:', error);
    next(error);
  }
});

// Upload video file (for user-uploaded videos)
router.post('/upload', protect, upload.single('video'), async (req, res, next) => {
  try {
    console.log(`📁 Upload de vidéo par ${req.user.username}`);

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Video file is required',
      });
    }

    // Upload vers Bunny CDN
    console.log('🐰 Upload vers Bunny CDN...');
    const uploadResult = await uploadToBunnyCDN(req.file, 'videos');

    // Récupérer les métadonnées depuis le body
    const description = req.body.description || 'Nouvelle vidéo uploadée';
    const title = req.body.title;
    const category = req.body.category;
    const hashtags = req.body.hashtags ? JSON.parse(req.body.hashtags) : [];
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    const duration = req.body.duration ? parseInt(req.body.duration) : 0;
    const manualType = req.body.type; // Permettre de spécifier manuellement le type

    // Déterminer le type de vidéo
    let videoType = 'short'; // Par défaut
    if (manualType && ['short', 'long'].includes(manualType)) {
      videoType = manualType; // Type spécifié manuellement
    } else if (duration > 60) {
      videoType = 'long'; // Auto-détection: plus de 60 secondes = longue vidéo
    }

    console.log(`📊 Type de vidéo déterminé: ${videoType} (durée: ${duration}s, manuel: ${manualType || 'non'})`);

    // Générer un titre automatique si non fourni
    const videoTitle = title || (description.length > 50 ? description.substring(0, 50) + '...' : description);

    // Créer la nouvelle vidéo avec statut de modération initial
    const video = new Video({
      user: req.user._id,
      title: videoTitle,
      videoUrl: uploadResult.url,
      videoKey: uploadResult.key,
      description: description,
      category: category || 'other',
      duration: duration,
      type: videoType,
      hashtags: hashtags,
      metadata: {
        ...metadata,
        originalFileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date()
      },
      isPublic: true,
      isActive: true,
      // Définir le statut de modération initial
      moderationStatus: 'pending',
      contentModeration: {
        autoModerationStatus: 'analyzing',
        isAutoApproved: false,
        needsManualReview: false,
        lastModeratedAt: new Date()
      }
    });

    await video.save();

    // Effectuer la modération de contenu
    console.log(`🛡️ Démarrage de la modération de contenu...`);
    const moderationResult = await performContentModeration(video, uploadResult.url);

    // Mettre à jour le compteur de vidéos de l'utilisateur
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { videosCount: 1 }
    });

    // Populer les données utilisateur pour la réponse
    await video.populate('user', 'username displayName avatar verified');

    console.log(`✅ Vidéo uploadée avec succès: ${video._id} (type: ${videoType})`);

    // Réponse incluant les informations de modération
    res.status(201).json({
      status: 'success',
      message: 'Video uploaded and moderated successfully',
      data: {
        video: video
      },
      moderation: {
        status: moderationResult.isAllowed ? 'approved' : 'rejected',
        confidence: moderationResult.confidence,
        detectedIssues: moderationResult.detectedContent,
        needsReview: !moderationResult.isAllowed && moderationResult.confidence < 0.9,
        message: moderationResult.isAllowed 
          ? 'Contenu approuvé automatiquement' 
          : moderationResult.confidence < 0.9 
            ? 'Contenu en attente de révision manuelle'
            : 'Contenu rejeté automatiquement'
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'upload de la vidéo:', error);
    next(error);
  }
});

// Route pour tracker une vidéo regardée en entier et attribuer des tokens
router.post('/track-watch', protect, async (req, res, next) => {
  try {
    console.log('🎯 [track-watch] === DEBUT TRACKING VIDÉO ===');
    console.log('🎯 [track-watch] User ID:', req.user._id);
    console.log('🎯 [track-watch] Username:', req.user.username);
    console.log('🎯 [track-watch] Request body:', req.body);
    
    const { videoId, section, duration } = req.body;

    // Validation des paramètres
    if (!videoId || !section || !duration) {
      console.log('❌ [track-watch] Validation échouée - paramètres manquants');
      return res.status(400).json({
        status: 'error',
        message: 'videoId, section, and duration are required'
      });
    }

    if (!['home', 'videos'].includes(section)) {
      console.log('❌ [track-watch] Section invalide:', section);
      return res.status(400).json({
        status: 'error',
        message: 'section must be either "home" or "videos"'
      });
    }

    // Vérifier que la vidéo existe
    console.log('🔍 [track-watch] Recherche de la vidéo:', videoId);
    const video = await Video.findById(videoId);
    if (!video) {
      console.log('❌ [track-watch] Vidéo non trouvée:', videoId);
      return res.status(404).json({
        status: 'error',
        message: 'Video not found'
      });
    }
    console.log('✅ [track-watch] Vidéo trouvée:', video.title || video.description?.substring(0, 50));

    // Vérifier si l'utilisateur a déjà été récompensé pour cette vidéo
    console.log('🔍 [track-watch] Recherche de l\'utilisateur...');
    const user = await User.findById(req.user._id);
    console.log('✅ [track-watch] Utilisateur trouvé:', user.username);
    console.log('📊 [track-watch] GrabBalance actuelle:', user.grabBalance);
    console.log('📊 [track-watch] Vidéos déjà regardées:', user.watchedVideos.length);
    
    const alreadyWatched = user.watchedVideos.some(
      w => w.videoId.toString() === videoId && w.section === section
    );
    console.log('🔍 [track-watch] Déjà regardée?', alreadyWatched);

    if (alreadyWatched) {
      console.log('ℹ️ [track-watch] Vidéo déjà trackée pour cet utilisateur');
      return res.status(200).json({
        status: 'success',
        message: 'Video already tracked',
        tokensEarned: 0
      });
    }

    // Calculer les tokens selon la section
    let tokensEarned = section === 'home' ? 0.1 : 0.2;
    
    // Bonus x2 pour les utilisateurs vérifiés humains
    const isHumanVerified = user.humanVerified || false;
    if (isHumanVerified) {
      tokensEarned *= 2;
      console.log('🤖 [track-watch] Bonus x2 pour utilisateur vérifié humain! Tokens doublés:', tokensEarned);
    } else {
      console.log('⚠️ [track-watch] Utilisateur non vérifié humain, tokens normaux:', tokensEarned);
    }
    
    console.log('💰 [track-watch] Tokens finaux à attribuer:', tokensEarned, 'pour section:', section);

    // Mettre à jour l'utilisateur
    console.log('💾 [track-watch] Mise à jour de l\'utilisateur...');
    const updateResult = await User.findByIdAndUpdate(req.user._id, {
      $inc: { grabBalance: tokensEarned },
      $push: {
        watchedVideos: {
          videoId,
          section,
          tokensEarned,
          watchedAt: new Date()
        }
      }
    }, { new: true });
    
    console.log('✅ [track-watch] Mise à jour réussie');
    console.log('📊 [track-watch] Nouvelle grabBalance:', updateResult.grabBalance);
    console.log('📊 [track-watch] Nouvelles vidéos regardées:', updateResult.watchedVideos.length);

    console.log(`✅ [track-watch] User ${req.user.username} earned ${tokensEarned} tokens for watching video ${videoId} in ${section} section`);

    console.log('🎯 [track-watch] === FIN TRACKING VIDÉO ===');
    res.status(200).json({
      status: 'success',
      message: 'Video watch tracked successfully',
      tokensEarned,
      newGrabBalance: updateResult.grabBalance
    });

  } catch (error) {
    console.error('❌ [track-watch] Erreur lors du tracking de vidéo:', error);
    next(error);
  }
});

module.exports = router;