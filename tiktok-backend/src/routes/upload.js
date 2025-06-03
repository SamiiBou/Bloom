const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const AWS = require('aws-sdk');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const Video = require('../models/Video');
const User = require('../models/User');
const Image = require('../models/Image');
const ModerationResult = require('../models/ModerationResult');
const UploadTask = require('../models/UploadTask');
const videoConverter = require('../services/videoConverter');
const contentModerationService = require('../services/contentModerationService');
const imageModerationService = require('../services/imageModerationService');

const router = express.Router();

// Rate limiting plus permissif pour les routes d'upload progress
const uploadProgressLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requêtes par 15 minutes (20 req/min) - plus permissif que le global
  message: 'Too many upload progress requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user ? req.user._id.toString() : req.ip;
  },
});

// Appliquer le rate limiting permissif aux routes de progress
router.use('/progress', uploadProgressLimiter);

// Configuration AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configuration Multer pour stockage temporaire local
const tempStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = process.env.TEMP_UPLOAD_DIR || './temp';
    try {
      await fs.access(tempDir);
    } catch (error) {
      await fs.mkdir(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `upload_${uniqueSuffix}_${file.originalname}`);
  }
});

// Multer pour upload temporaire
const tempUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB
  },
  fileFilter: (req, file, cb) => {
    console.log('--- File Filter Debug ---');
    console.log('Fieldname:', file.fieldname);
    console.log('Detected file.mimetype:', file.mimetype);
    
    if (file.fieldname === 'video') {
      const allowedVideoTypes = process.env.ALLOWED_VIDEO_TYPES?.split(',') || [
        'video/mp4',
        'video/avi',
        'video/mov',
        'video/wmv',
        'video/mkv',
        'video/webm',
        'video/flv',
        'video/m4v'
      ];
      console.log('Allowed video types:', allowedVideoTypes);
      
      if (allowedVideoTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type for video. Only specified video types are allowed.'), false);
      }
    } else if (file.fieldname === 'thumbnail') {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type for thumbnail. Only JPEG, PNG, JPG are allowed.'), false);
      }
    } else {
      cb(new Error('Unexpected fieldname for file upload.'), false);
    }
    console.log('-------------------------');
  },
});

/**
 * Upload un fichier vers S3 depuis le système de fichiers local
 */
async function uploadFileToS3(filePath, s3Key, contentType) {
  const fileContent = await fs.readFile(filePath);
  
  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType,
  };

  const result = await s3.upload(uploadParams).promise();
  return {
    location: result.Location,
    key: result.Key,
    bucket: result.Bucket
  };
}

/**
 * Génère une clé S3 unique pour le fichier
 */
function generateS3Key(originalName, prefix = 'videos', forceExtension = null) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  
  // Déterminer l'extension finale
  let finalExtension;
  if (forceExtension) {
    finalExtension = forceExtension.startsWith('.') ? forceExtension : '.' + forceExtension;
  } else if (prefix === 'videos') {
    finalExtension = '.mp4'; // Force MP4 pour les vidéos
  } else {
    finalExtension = extension; // Garde l'extension originale pour les autres fichiers
  }
  
  return `${prefix}/${uniqueSuffix}-${baseName}${finalExtension}`;
}

/**
 * Fonction utilitaire pour effectuer la modération de contenu sur les images
 */
async function performImageContentModeration(image, imagePath = null, imageUrl = null) {
  console.log(`🛡️ Démarrage de la modération de contenu pour l'image: ${image._id}`);
  
  let moderationResult;
  let processingStartTime = Date.now();
  
  try {
    // Prioriser le fichier local, puis l'URL
    if (imagePath) {
      moderationResult = await imageModerationService.moderateImageFromFile(imagePath, {
        failSafe: 'allow' // En cas d'erreur, autoriser l'image par défaut
      });
    } else if (imageUrl) {
      moderationResult = await imageModerationService.moderateImageFromUrl(imageUrl, {
        failSafe: 'allow'
      });
    } else {
      // Utiliser l'URL de l'image depuis la base de données
      moderationResult = await imageModerationService.moderateImageFromUrl(image.imageUrl, {
        failSafe: 'allow'
      });
    }
    
    const processingTime = Date.now() - processingStartTime;
    
    // Sauvegarder le résultat de modération
    const moderationDoc = new ModerationResult({
      image: image._id, // Pour les images au lieu de video
      user: image.user,
      isAllowed: moderationResult.isAllowed,
      confidence: moderationResult.confidence,
      detectedContent: moderationResult.detectedContent,
      details: moderationResult.details,
      warnings: moderationResult.warnings,
      error: moderationResult.error,
      processingTime: processingTime,
      moderationService: 'openai-moderation',
      moderationConfig: {
        // Utiliser les seuils OpenAI au lieu de Google Cloud
        harassment: imageModerationService.moderationConfig.harassment,
        sexual: imageModerationService.moderationConfig.sexual,
        violence: imageModerationService.moderationConfig.violence
      },
      action: moderationResult.isAllowed ? 'approved' : 'rejected'
    });
    
    await moderationDoc.save();
    
    // Mettre à jour l'image avec les résultats de modération
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
    
    await Image.findByIdAndUpdate(image._id, updateData);
    
    console.log(`🛡️ Modération d'image terminée: ${moderationResult.isAllowed ? 'APPROUVÉ' : 'REJETÉ'} (confiance: ${(moderationResult.confidence * 100).toFixed(1)}%)`);
    if (moderationResult.detectedContent.length > 0) {
      console.log(`🚨 Problèmes détectés: ${moderationResult.detectedContent.join(', ')}`);
    }
    
    return moderationResult;
    
  } catch (moderationError) {
    console.error('❌ Erreur lors de la modération d\'image:', moderationError);
    
    // En cas d'erreur, marquer pour révision manuelle
    await Image.findByIdAndUpdate(image._id, {
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

// Upload video avec conversion automatique et suivi de progression
router.post('/video', protect, (req, res, next) => {
  const upload = tempUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]);

  upload(req, res, async (err) => {
    if (err) {
      console.error('[UPLOAD] Multer error:', err);
      return res.status(400).json({
        status: 'error',
        message: err.message,
      });
    }

    try {
      const { description, music, title, category } = req.body;
      console.log('[UPLOAD] Fields received:', { description, music, title, category });
      if (!req.files || !req.files.video) {
        console.error('[UPLOAD] No video file received');
        return res.status(400).json({
          status: 'error',
          message: 'Video file is required',
        });
      }
      if (!description) {
        console.error('[UPLOAD] No description received');
        return res.status(400).json({
          status: 'error',
          message: 'Description is required',
        });
      }
      const originalVideoFile = req.files.video[0];
      const originalThumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;
      const uploadId = `upload_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
      console.log(`[UPLOAD] 📤 Processing video upload: ${originalVideoFile.originalname} (size: ${originalVideoFile.size} bytes)`);
      if (originalThumbnailFile) {
        console.log(`[UPLOAD] Thumbnail received: ${originalThumbnailFile.originalname} (size: ${originalThumbnailFile.size} bytes)`);
      }
      const uploadTask = new UploadTask({
        user: req.user._id,
        uploadId: uploadId,
        filename: originalVideoFile.filename,
        originalFilename: originalVideoFile.originalname,
        description: description,
        status: 'UPLOADED',
        progress: 5,
        currentStep: '📤 File received...',
        tempFiles: [originalVideoFile.path],
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        }
      });
      if (originalThumbnailFile) {
        uploadTask.tempFiles.push(originalThumbnailFile.path);
      }
      await uploadTask.save();
      console.log(`[UPLOAD] UploadTask created: ${uploadId}`);
      res.status(202).json({
        status: 'accepted',
        message: 'Upload started - use polling to track progress',
        data: {
          uploadId: uploadId,
          initialProgress: 5,
          initialStatus: 'File received, starting processing...'
        }
      });
      console.log('[UPLOAD] Launching async video processing...');
      processVideoAsync(uploadTask, originalVideoFile, originalThumbnailFile, req.body)
        .catch(error => {
          console.error('[UPLOAD] ❌ Async video processing error:', error);
          uploadTask.setError(error, 'async_processing').catch(console.error);
        });
    } catch (error) {
      console.error('[UPLOAD] ❌ Video upload error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Video upload failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
});

// Fonction asynchrone pour traiter la vidéo
async function processVideoAsync(uploadTask, originalVideoFile, originalThumbnailFile, requestBody) {
  let tempFiles = uploadTask.tempFiles || [];
  try {
    console.log(`[UPLOAD] Step 1: Validation`);
    await uploadTask.updateProgress('VALIDATING', 10, '🔍 Validating file...');
    const needsConversion = await videoConverter.needsConversion(originalVideoFile.path);
    let finalVideoPath = originalVideoFile.path;
    let videoMetadata;
    if (needsConversion) {
      console.log(`[UPLOAD] Step 2: Conversion needed, converting to MP4...`);
      await uploadTask.updateProgress('CONVERTING', 20, '🔄 Converting video to MP4...');
      uploadTask.processing.conversionNeeded = true;
      await uploadTask.save();
      const convertedFileName = videoConverter.generateTempFilename(originalVideoFile.originalname, '_converted');
      const convertedVideoPath = path.join(path.dirname(originalVideoFile.path), convertedFileName);
      console.log(`[UPLOAD] Step 2: Starting conversion: ${originalVideoFile.path} -> ${convertedVideoPath}`);
      finalVideoPath = await videoConverter.convertToMP4(originalVideoFile.path, convertedVideoPath);
      tempFiles.push(finalVideoPath);
      uploadTask.tempFiles = tempFiles;
      await uploadTask.save();
      await uploadTask.updateProgress('CONVERTING', 50, '🔄 Video conversion completed...');
      console.log(`[UPLOAD] Step 2: Conversion completed: ${finalVideoPath}`);
    } else {
      console.log('[UPLOAD] Step 2: No conversion needed, using original file');
    }
    videoMetadata = await videoConverter.getVideoMetadata(finalVideoPath);
    console.log(`[UPLOAD] Step 3: Video metadata:`, videoMetadata);
    uploadTask.fileInfo = {
      originalSize: (await fs.stat(originalVideoFile.path)).size,
      convertedSize: (await fs.stat(finalVideoPath)).size,
      duration: videoMetadata.duration,
      format: videoMetadata.format,
      resolution: {
        width: videoMetadata.video?.width || 0,
        height: videoMetadata.video?.height || 0,
      },
      bitrate: videoMetadata.bitrate
    };
    await uploadTask.save();
    console.log(`[UPLOAD] Step 4: Thumbnail generation`);
    await uploadTask.updateProgress('GENERATING_THUMBNAIL', 60, '🖼️ Generating thumbnail...');
    let thumbnailPath = originalThumbnailFile ? originalThumbnailFile.path : null;
    if (!thumbnailPath) {
      const baseName = path.basename(originalVideoFile.originalname, path.extname(originalVideoFile.originalname));
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      const thumbnailFileName = `${baseName}_${timestamp}_${random}_thumb.jpg`;
      const initialThumbnailPath = path.join(path.dirname(originalVideoFile.path), thumbnailFileName);
      console.log(`[UPLOAD] Step 4: Generating thumbnail at ${initialThumbnailPath}`);
      thumbnailPath = await videoConverter.generateThumbnail(finalVideoPath, initialThumbnailPath);
      tempFiles.push(thumbnailPath);
      uploadTask.tempFiles = tempFiles;
      await uploadTask.save();
      console.log(`[UPLOAD] Step 4: Thumbnail generated at ${thumbnailPath}`);
    } else {
      console.log(`[UPLOAD] Step 4: Using provided thumbnail: ${thumbnailPath}`);
    }
    await uploadTask.updateProgress('UPLOADING_TO_S3', 75, '☁️ Uploading to cloud...');
    console.log(`[UPLOAD] Step 5: Uploading to S3...`);
    const videoS3Key = generateS3Key(originalVideoFile.originalname, 'videos');
    const thumbnailS3Key = generateS3Key(path.basename(thumbnailPath), 'thumbnails', '.jpg');
    console.log(`[UPLOAD] Step 5: Uploading video to S3 as ${videoS3Key}`);
    const videoUploadResult = await uploadFileToS3(finalVideoPath, videoS3Key, 'video/mp4');
    console.log(`[UPLOAD] Step 5: Video uploaded to S3:`, videoUploadResult);
    console.log(`[UPLOAD] Step 5: Uploading thumbnail to S3 as ${thumbnailS3Key}`);
    const thumbnailUploadResult = await uploadFileToS3(thumbnailPath, thumbnailS3Key, 'image/jpeg');
    console.log(`[UPLOAD] Step 5: Thumbnail uploaded to S3:`, thumbnailUploadResult);
    uploadTask.videoUrl = videoUploadResult.location;
    uploadTask.videoKey = videoUploadResult.key;
    uploadTask.thumbnailUrl = thumbnailUploadResult.location;
    uploadTask.thumbnailKey = thumbnailUploadResult.key;
    await uploadTask.save();
    console.log(`[UPLOAD] Step 6: S3 upload completed`);
    await uploadTask.updateProgress('UPLOADING_TO_S3', 85, '💾 Creating video record...');
    let musicData = {};
    if (requestBody.music) {
      try {
        musicData = JSON.parse(requestBody.music);
      } catch (error) {
        musicData = { title: requestBody.music };
      }
    }
    const { type } = requestBody;
    let videoType = 'short';
    const videoDuration = Math.round(videoMetadata.duration || 0);
    if (type && ['short', 'long'].includes(type)) {
      videoType = type;
      console.log(`📊 Type de vidéo forcé: ${videoType} (durée: ${videoDuration}s)`);
    } else if (videoDuration > 60) {
      videoType = 'long';
      console.log(`📊 Type de vidéo auto-détecté: ${videoType} (durée: ${videoDuration}s)`);
    }
    const videoTitle = requestBody.title || (uploadTask.description.length > 50 ? uploadTask.description.substring(0, 50) + '...' : uploadTask.description);
    console.log(`[UPLOAD] Step 7: Creating Video document in DB...`);
    const video = new Video({
      user: uploadTask.user,
      title: videoTitle,
      description: uploadTask.description,
      category: requestBody.category || 'other',
      videoUrl: videoUploadResult.location,
      videoKey: videoUploadResult.key,
      thumbnailUrl: thumbnailUploadResult.location,
      thumbnailKey: thumbnailUploadResult.key,
      fileSize: uploadTask.fileInfo.convertedSize,
      duration: videoDuration,
      type: videoType,
      resolution: uploadTask.fileInfo.resolution,
      music: musicData,
      moderationStatus: 'pending',
      contentModeration: {
        autoModerationStatus: 'analyzing',
        isAutoApproved: false,
        needsManualReview: false,
        lastModeratedAt: new Date()
      }
    });
    await video.save();
    uploadTask.video = video._id;
    await uploadTask.save();
    console.log(`[UPLOAD] Step 7: Video document created: ${video._id}`);
    await uploadTask.updateProgress('MODERATING', 90, '🛡️ Content moderation...');
    console.log(`[UPLOAD] Step 8: Starting content moderation...`);
    let moderationResult;
    let processingStartTime = Date.now();
    try {
      moderationResult = await contentModerationService.moderateVideo(finalVideoPath, {
        failSafe: 'allow'
      });
      const processingTime = Date.now() - processingStartTime;
      const moderationDoc = new ModerationResult({
        video: video._id,
        user: uploadTask.user,
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
      const updateData = {
        'contentModeration.autoModerationStatus': moderationResult.isAllowed ? 'approved' : 'rejected',
        'contentModeration.autoModerationResult': moderationDoc._id,
        'contentModeration.isAutoApproved': moderationResult.isAllowed,
        'contentModeration.moderationConfidence': moderationResult.confidence,
        'contentModeration.lastModeratedAt': new Date()
      };
      const needsManualReview = !moderationResult.isAllowed && moderationResult.confidence < 0.9;
      updateData['contentModeration.needsManualReview'] = needsManualReview;
      if (!moderationResult.isAllowed) {
        updateData['contentModeration.rejectionReasons'] = moderationResult.detectedContent;
        updateData.moderationStatus = needsManualReview ? 'under_review' : 'rejected';
      } else {
        updateData.moderationStatus = 'approved';
      }
      await Video.findByIdAndUpdate(video._id, updateData);
      uploadTask.moderation = {
        status: moderationResult.isAllowed ? 'approved' : 'rejected',
        confidence: moderationResult.confidence,
        detectedIssues: moderationResult.detectedContent,
        needsReview: needsManualReview
      };
      console.log(`[UPLOAD] Step 8: Moderation completed: ${moderationResult.isAllowed ? 'APPROUVÉ' : 'REJETÉ'} (confiance: ${(moderationResult.confidence * 100).toFixed(1)}%)`);
    } catch (moderationError) {
      console.error('[UPLOAD] Step 8: Moderation error:', moderationError);
      await Video.findByIdAndUpdate(video._id, {
        'contentModeration.autoModerationStatus': 'error',
        'contentModeration.needsManualReview': true,
        moderationStatus: 'under_review'
      });
      uploadTask.moderation = {
        status: 'error',
        confidence: 0,
        detectedIssues: ['moderation_error'],
        needsReview: true
      };
    }
    await User.findByIdAndUpdate(uploadTask.user, {
      $inc: { videosCount: 1 }
    });
    await video.populate('user', 'username displayName avatar verified');
    await uploadTask.updateProgress('SUCCEEDED', 100, '✅ Upload completed!');
    console.log(`[UPLOAD] Step 9: Upload process completed successfully for video: ${video._id}`);
  } catch (error) {
    console.error('[UPLOAD] ❌ Video processing error:', error);
    await uploadTask.setError(error, 'video_processing');
  } finally {
    if (tempFiles.length > 0) {
      console.log(`[UPLOAD] Step 10: Cleaning up ${tempFiles.length} temporary files...`);
      await videoConverter.cleanupFiles(tempFiles);
      console.log('[UPLOAD] Step 10: Cleanup completed');
    }
  }
}

// Upload thumbnail seulement (pour vidéo existante)
router.post('/thumbnail/:videoId', protect, (req, res, next) => {
  const upload = tempUpload.single('thumbnail');

  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message,
      });
    }

    let tempFiles = [];

    try {
      const { videoId } = req.params;

      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'Thumbnail file is required',
        });
      }

      tempFiles.push(req.file.path);

      // Trouver la vidéo et vérifier la propriété
      const video = await Video.findById(videoId);
      
      if (!video) {
        return res.status(404).json({
          status: 'error',
          message: 'Video not found',
        });
      }

      if (video.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to update this video',
        });
      }

      // Upload vers S3
      const thumbnailS3Key = generateS3Key(req.file.originalname, 'thumbnails');
      const uploadResult = await uploadFileToS3(req.file.path, thumbnailS3Key, req.file.mimetype);

      // Mettre à jour la vidéo
      video.thumbnailUrl = uploadResult.location;
      video.thumbnailKey = uploadResult.key;
      await video.save();

      res.status(200).json({
        status: 'success',
        message: 'Thumbnail uploaded successfully',
        data: {
          thumbnailUrl: video.thumbnailUrl,
        },
      });

    } catch (error) {
      console.error('❌ Thumbnail upload error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Thumbnail upload failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      // Nettoyer les fichiers temporaires
      if (tempFiles.length > 0) {
        await videoConverter.cleanupFiles(tempFiles);
      }
    }
  });
});

// Get upload progress (suivi de progression pour les uploads)
router.get('/progress/:uploadId', protect, async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    // Rechercher la tâche d'upload
    const uploadTask = await UploadTask.findOne({ 
      uploadId: uploadId,
      user: req.user._id // Sécurité: s'assurer que l'utilisateur peut seulement voir ses propres uploads
    }).populate('video', 'title description videoUrl thumbnailUrl');
    
    if (!uploadTask) {
      return res.status(404).json({
        status: 'error',
        message: 'Upload task not found',
      });
    }
    
    // Mapper le statut interne vers un statut plus lisible
    const statusMap = {
      'UPLOADED': '📤 File received',
      'VALIDATING': '🔍 Validating file',
      'CONVERTING': '🔄 Converting video',
      'GENERATING_THUMBNAIL': '🖼️ Generating thumbnail',
      'UPLOADING_TO_S3': '☁️ Uploading to cloud',
      'MODERATING': '🛡️ Content moderation',
      'SUCCEEDED': '✅ Upload completed',
      'FAILED': '❌ Upload failed'
    };
    
    const response = {
      status: 'success',
      data: {
        uploadId: uploadTask.uploadId,
        progress: uploadTask.progress,
        status: uploadTask.status,
        currentStep: uploadTask.currentStep,
        displayStatus: statusMap[uploadTask.status] || uploadTask.currentStep,
        fileInfo: uploadTask.fileInfo,
        processing: {
          conversionNeeded: uploadTask.processing?.conversionNeeded || false,
          timings: {
            started: uploadTask.createdAt,
            conversionStarted: uploadTask.processing?.conversionStarted,
            conversionCompleted: uploadTask.processing?.conversionCompleted,
            thumbnailGenerated: uploadTask.processing?.thumbnailGenerated,
            s3UploadStarted: uploadTask.processing?.s3UploadStarted,
            s3UploadCompleted: uploadTask.processing?.s3UploadCompleted,
            moderationStarted: uploadTask.processing?.moderationStarted,
            moderationCompleted: uploadTask.processing?.moderationCompleted,
          }
        },
        moderation: uploadTask.moderation,
        error: uploadTask.error,
        createdAt: uploadTask.createdAt,
        updatedAt: uploadTask.updatedAt
      }
    };
    
    // Si la tâche est terminée avec succès, inclure les informations de la vidéo
    if (uploadTask.status === 'SUCCEEDED' && uploadTask.video) {
      response.data.video = {
        id: uploadTask.video._id,
        title: uploadTask.video.title,
        description: uploadTask.video.description,
        videoUrl: uploadTask.video.videoUrl,
        thumbnailUrl: uploadTask.video.thumbnailUrl,
        duration: uploadTask.fileInfo?.duration,
        resolution: uploadTask.fileInfo?.resolution
      };
    }
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error fetching upload progress:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch upload progress',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upload image from device
router.post('/image', protect, (req, res, next) => {
  console.log('🖼️ [BACKEND] Image upload endpoint hit');
  console.log('🖼️ [BACKEND] User:', req.user ? req.user._id : 'No user');
  console.log('🖼️ [BACKEND] Headers:', req.headers);
  console.log('🖼️ [BACKEND] Body keys:', Object.keys(req.body));
  console.log('🖼️ [BACKEND] Content-Type:', req.headers['content-type']);
  
  const imageUpload = multer({
    storage: tempStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB for images
    },
    fileFilter: (req, file, cb) => {
      console.log('🖼️ [BACKEND] File filter - fieldname:', file.fieldname);
      console.log('🖼️ [BACKEND] File filter - originalname:', file.originalname);
      console.log('🖼️ [BACKEND] File filter - mimetype:', file.mimetype);
      console.log('🖼️ [BACKEND] File filter - size:', file.size);
      
      const allowedImageTypes = [
        'image/jpeg', 
        'image/png', 
        'image/jpg', 
        'image/webp',
        'image/gif'
      ];
      
      if (allowedImageTypes.includes(file.mimetype)) {
        console.log('🖼️ [BACKEND] File type allowed');
        cb(null, true);
      } else {
        console.log('🖼️ [BACKEND] File type not allowed:', file.mimetype);
        cb(new Error('Invalid file type. Only JPEG, PNG, JPG, WebP, GIF are allowed.'), false);
      }
    },
  }).single('image');

  imageUpload(req, res, async (err) => {
    console.log('🖼️ [BACKEND] Multer processing completed');
    
    if (err) {
      console.error('🖼️ [BACKEND] Multer error:', err);
      return res.status(400).json({
        status: 'error',
        message: err.message,
      });
    }

    console.log('🖼️ [BACKEND] File received:', req.file ? 'YES' : 'NO');
    if (req.file) {
      console.log('🖼️ [BACKEND] File details:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size,
        destination: req.file.destination,
        filename: req.file.filename,
        path: req.file.path
      });
    }

    console.log('🖼️ [BACKEND] Request body:', req.body);

    let tempFiles = [];

    try {
      const { title, description, hashtags } = req.body;
      console.log('🖼️ [BACKEND] Extracted fields:', { title, description, hashtags });

      if (!req.file) {
        console.error('🖼️ [BACKEND] No file provided');
        return res.status(400).json({
          status: 'error',
          message: 'Image file is required',
        });
      }

      tempFiles.push(req.file.path);
      console.log('🖼️ [BACKEND] Added to temp files:', req.file.path);

      console.log(`🖼️ [BACKEND] Processing image upload: ${req.file.originalname}`);

      // Generate S3 key for image
      const imageS3Key = generateS3Key(req.file.originalname, 'images');
      console.log('🖼️ [BACKEND] Generated S3 key:', imageS3Key);

      // Upload image to S3 (make it public)
      console.log('🖼️ [BACKEND] Starting S3 upload...');
      const uploadResult = await uploadFileToS3(req.file.path, imageS3Key, req.file.mimetype);
      console.log('🖼️ [BACKEND] S3 upload completed:', uploadResult);

      console.log(`🖼️ [BACKEND] Image S3 URL: ${uploadResult.location}`);
      console.log(`🖼️ [BACKEND] Image S3 Key: ${uploadResult.key}`);

      // Get file stats
      const fileStats = await fs.stat(req.file.path);
      console.log('🖼️ [BACKEND] File stats:', fileStats);

      // Parse hashtags if provided
      let parsedHashtags = [];
      if (hashtags) {
        try {
          parsedHashtags = typeof hashtags === 'string' ? JSON.parse(hashtags) : hashtags;
          if (!Array.isArray(parsedHashtags)) {
            parsedHashtags = [];
          }
          console.log('🖼️ [BACKEND] Parsed hashtags:', parsedHashtags);
        } catch (parseError) {
          console.log('🖼️ [BACKEND] Error parsing hashtags, using empty array:', parseError);
          parsedHashtags = [];
        }
      }

      // Create image record in database
      console.log('🖼️ [BACKEND] Creating image record in database...');
      
      // Déterminer le titre : seulement utiliser le nom du fichier si aucune description n'est fournie
      let finalTitle = '';
      if (title && title.trim()) {
        // Si un titre explicite est fourni, l'utiliser
        finalTitle = title.trim();
      } else if (!description || !description.trim()) {
        // Si aucune description n'est fournie, utiliser le nom du fichier comme titre
        finalTitle = req.file.originalname.split('.')[0];
      }
      // Sinon, laisser le titre vide (cas où il y a une description mais pas de titre)
      
      console.log('🖼️ [BACKEND] Final title determined:', finalTitle);
      console.log('🖼️ [BACKEND] Final description:', description || 'Image uploadée depuis l\'appareil');
      
      const image = new Image({
        user: req.user._id,
        title: finalTitle,
        description: description || 'Image uploadée depuis l\'appareil',
        hashtags: parsedHashtags,
        imageUrl: uploadResult.location,
        imageKey: uploadResult.key,
        fileSize: fileStats.size,
        metadata: {
          aiGenerated: false,
          originalFormat: path.extname(req.file.originalname).toLowerCase(),
          uploadMethod: 'device',
          fileSize: fileStats.size
        },
        // Définir le statut de modération initial
        moderationStatus: 'pending',
        contentModeration: {
          autoModerationStatus: 'analyzing',
          isAutoApproved: false,
          needsManualReview: false,
          lastModeratedAt: new Date()
        }
      });

      await image.save();
      console.log('🖼️ [BACKEND] Image saved to database:', image._id);

      // Effectuer la modération de contenu
      console.log(`🖼️ [BACKEND] Starting content moderation...`);
      const moderationResult = await performImageContentModeration(image, req.file.path, uploadResult.location);
      console.log('🖼️ [BACKEND] Moderation completed:', moderationResult);

      // Update user images count
      console.log('🖼️ [BACKEND] Updating user images count...');
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { imagesCount: 1 }
      });

      // Populate user data for response
      await image.populate('user', 'username displayName avatar verified');
      console.log('🖼️ [BACKEND] Image populated with user data');

      console.log(`🖼️ [BACKEND] Image uploaded successfully: ${image._id}`);

      // Réponse incluant les informations de modération
      const response = {
        status: 'success',
        message: 'Image uploaded and moderated successfully',
        data: {
          image: {
            ...image.toObject(),
            likesCount: 0
          }
        },
        moderation: {
          status: moderationResult.isAllowed ? 'approved' : 'rejected',
          confidence: moderationResult.confidence,
          detectedIssues: moderationResult.detectedContent,
          needsReview: !moderationResult.isAllowed && moderationResult.confidence < 0.9,
          message: moderationResult.isAllowed 
            ? 'Image approuvée automatiquement' 
            : moderationResult.confidence < 0.9 
              ? 'Image en attente de révision manuelle'
              : 'Image rejetée automatiquement'
        }
      };
      
      console.log('🖼️ [BACKEND] Sending response:', response);
      res.status(201).json(response);

    } catch (error) {
      console.error('🖼️ [BACKEND] Image upload error:', error);
      console.error('🖼️ [BACKEND] Error stack:', error.stack);
      res.status(500).json({
        status: 'error',
        message: 'Image upload failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      // Cleanup temporary files
      if (tempFiles.length > 0) {
        console.log(`🖼️ [BACKEND] Cleaning up ${tempFiles.length} temporary files...`);
        await videoConverter.cleanupFiles(tempFiles);
        console.log('🖼️ [BACKEND] Cleanup completed');
      }
    }
  });
});

module.exports = router;