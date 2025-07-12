const express = require('express');
const { protect } = require('../middleware/auth');
const runwayService = require('../services/runwayService');
const veoService = require('../services/veoService');
const AITask = require('../models/AITask');
const Video = require('../models/Video');
const User = require('../models/User');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const dns = require('dns');
const imageModerationService = require('../services/imageModerationService');
const { uploadToBunny } = require('../config/bunny');

const fluxService = require('../services/fluxService');
const AIImage = require('../models/AIImages');
const Image = require('../models/Image'); 

const router = express.Router();

// Configure DNS to use Google's public DNS as fallback
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

// Configure axios defaults for better reliability
axios.defaults.timeout = 30000;
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (compatible; AIImageDownloader/1.0)';

// Configuration is now handled by Bunny CDN service

/**
 * Schedule a background retry for failed downloads
 */
async function scheduleDownloadRetry(taskId, imageUrl, retryCount = 0) {
  const maxRetries = 5;
  const retryDelay = Math.min(Math.pow(2, retryCount) * 1000, 30000); // Exponential backoff, max 30s
  
  if (retryCount >= maxRetries) {
    console.log(`❌ Max retries reached for task ${taskId}, giving up`);
    return;
  }
  
  console.log(`🔄 Scheduling retry ${retryCount + 1}/${maxRetries} for task ${taskId} in ${retryDelay}ms`);
  
  setTimeout(async () => {
    try {
      const aiImage = await AIImage.findOne({ taskId: taskId });
      if (!aiImage || aiImage.imageKey) {
        console.log(`⏭️ Skipping retry for task ${taskId} - already processed or not found`);
        return;
      }
      
      const imageFileName = generateBunnyFileName('flux-generated-image.jpg');
      const uploadResult = await downloadAndUploadToBunny(imageUrl, imageFileName, 'ai-images', 'image/jpeg', 2); // Less retries for background tasks
      
      aiImage.imageUrl = uploadResult.location;
      aiImage.imageKey = uploadResult.key;
      await aiImage.save();
      
      console.log(`✅ Background retry successful for task ${taskId}`);
      
    } catch (error) {
      console.log(`❌ Background retry failed for task ${taskId}:`, error.message);
      // Schedule another retry
      await scheduleDownloadRetry(taskId, imageUrl, retryCount + 1);
    }
  }, retryDelay);
}

/**
 * Test network connectivity to a domain
 */
async function testConnectivity(url) {
  try {
    const { hostname } = new URL(url);
    console.log(`🔍 Testing connectivity to ${hostname}...`);
    
    // Simple head request to test connectivity
    await axios.head(url, { timeout: 5000 });
    console.log(`✅ Connectivity test passed for ${hostname}`);
    return true;
  } catch (error) {
    console.log(`❌ Connectivity test failed for ${hostname}:`, error.message);
    return false;
  }
}

/**
 * Download file from URL and upload to Bunny CDN
 */
async function downloadAndUploadToBunny(fileUrl, fileName, folder = 'ai-generated', contentType = 'application/octet-stream', maxRetries = 3) {
  let lastError;
  
  // Test connectivity first
  console.log(`🔍 Testing connectivity to ${fileUrl}...`);
  const isConnected = await testConnectivity(fileUrl);
  if (!isConnected) {
    console.log('⚠️ Initial connectivity test failed, but will still attempt download...');
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📥 Attempting to download file (attempt ${attempt}/${maxRetries}): ${fileUrl}`);
      
      // Download file with timeout and retry configuration
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIImageDownloader/1.0)'
        }
      });

      console.log(`✅ File downloaded successfully, uploading to Bunny CDN...`);

      // Upload to Bunny CDN
      const fileBuffer = Buffer.from(response.data);
      const result = await uploadToBunny(fileBuffer, fileName, folder, contentType);
      console.log(`✅ File uploaded to Bunny CDN: ${result.url}`);
      
      return {
        location: result.url,
        key: result.key,
        cdnUrl: result.cdnUrl
      };
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // If it's a DNS resolution error, wait a bit longer before retry
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.log(`🔄 DNS/Connection issue detected, waiting ${attempt * 2} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        console.log(`🔄 Network issue detected, waiting ${attempt} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      } else {
        // For other errors, don't retry
        console.error('❌ Non-retryable error, stopping attempts');
        break;
      }
    }
  }
  
  console.error('❌ All download attempts failed for:', fileUrl);
  throw lastError;
}

/**
 * Generate file name for Bunny CDN AI generated content
 */
function generateBunnyFileName(originalName, extension = null) {
  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1E9);
  const fileExtension = extension || path.extname(originalName) || '.mp4';
  const baseName = path.basename(originalName, path.extname(originalName)) || 'ai-generated';
  return `${timestamp}-${randomSuffix}-${baseName}${fileExtension}`;
}

/**
 * POST /api/ai/generate-video
 * Start AI video generation
 */
router.post('/generate-video', protect, async (req, res) => {
  try {
    const { promptText, model, duration, ratio, seed, sourceImageUrl } = req.body;

    // Validation
    if (!promptText || promptText.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt text is required'
      });
    }

    if (promptText.length > 1000) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt text cannot exceed 1000 characters'
      });
    }

    // NOUVEAU: Calculer le coût en crédits en fonction de la durée
    const videoDuration = duration || 5;
    const creditsRequired = videoDuration === 10 ? 42 : 21;

    // NOUVEAU: Vérifier et déduire les crédits
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (user.credits < creditsRequired) {
      return res.status(402).json({
        status: 'error',
        message: 'Insufficient credits',
        data: {
          required: creditsRequired,
          available: user.credits,
          duration: videoDuration
        }
      });
    }

    // Déduire les crédits AVANT de commencer la génération
    user.credits -= creditsRequired;
    await user.save();

    console.log(`🤖 Starting AI video generation for user ${req.user._id}`);
    console.log(`📝 Prompt: "${promptText}"`);
    console.log(`💰 Credits deducted: ${creditsRequired} (${videoDuration}s video)`);
    console.log(`💳 Remaining credits: ${user.credits}`);

    // Determine generation type
    const generationType = sourceImageUrl ? 'image-to-video' : 'text-to-video';
    
    try {
      // Start Runway generation
      let runwayResult;
      if (generationType === 'image-to-video') {
        runwayResult = await runwayService.generateVideoFromImage(
          sourceImageUrl,
          promptText,
          { model, duration, ratio, seed }
        );
      } else {
        runwayResult = await runwayService.generateVideoFromText(
          promptText,
          { model, duration, ratio, seed }
        );
      }

      // Create AI task record
      const aiTask = new AITask({
        user: req.user._id,
        runwayTaskId: runwayResult.taskId,
        promptText: promptText.trim(),
        type: generationType,
        status: 'PENDING',
        options: {
          model: model || 'gen4_turbo',
          duration: videoDuration,
          ratio: ratio || '1280:720',
          seed: seed
        },
        sourceImageUrl: sourceImageUrl,
        generatedImageUrl: runwayResult.imageUrl, // For text-to-video
        // NOUVEAU: Enregistrer les informations de crédits
        creditsUsed: creditsRequired,
        userCreditsAfter: user.credits
      });

      await aiTask.save();

      console.log(`✅ AI task created: ${aiTask._id} (Runway: ${runwayResult.taskId})`);

      res.status(201).json({
        status: 'success',
        message: 'AI video generation started',
        data: {
          taskId: runwayResult.taskId,
          aiTaskId: aiTask._id,
          type: generationType,
          estimatedTime: '30-120 seconds',
          // NOUVEAU: Retourner les informations de crédits
          creditsUsed: creditsRequired,
          remainingCredits: user.credits
        }
      });

    } catch (runwayError) {
      // Si la génération Runway échoue, rembourser les crédits
      console.error('❌ Runway generation failed, refunding credits:', runwayError);
      
      user.credits += creditsRequired;
      await user.save();
      
      console.log(`💰 Credits refunded: ${creditsRequired}`);
      console.log(`💳 Credits after refund: ${user.credits}`);
      
      throw runwayError;
    }

  } catch (error) {
    console.error('❌ AI generation error:', error);
    
    // Distinguer les erreurs de crédits des autres erreurs
    if (error.status === 402 || (error.response && error.response.status === 402)) {
      return res.status(402).json({
        status: 'error',
        message: 'Insufficient credits for video generation',
        data: error.data || (error.response && error.response.data)
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to start AI video generation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/task/:taskId
 * Check AI task status
 */
router.get('/task/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find AI task in our database
    const aiTask = await AITask.findOne({
      runwayTaskId: taskId,
      user: req.user._id
    }).populate('video', 'videoUrl thumbnailUrl description');

    if (!aiTask) {
      return res.status(404).json({
        status: 'error',
        message: 'AI task not found'
      });
    }

    // If task is already completed, return cached result
    if (['SUCCEEDED', 'FAILED'].includes(aiTask.status)) {
      // Ajout remboursement automatique si FAILED et pas encore refunded
      if (aiTask.status === 'FAILED' && !aiTask.refunded) {
        const user = await User.findById(aiTask.user);
        if (user && aiTask.creditsUsed) {
          user.credits += aiTask.creditsUsed;
          await user.save();
          aiTask.refunded = true;
          await aiTask.save();
          console.log(`💰 Credits refunded for failed task: ${aiTask._id}`);
        }
      }
      return res.json({
        status: 'success',
        data: {
          task: {
            id: aiTask.runwayTaskId,
            status: aiTask.status,
            video: aiTask.video,
            error: aiTask.error,
            cost: aiTask.cost,
            processingTime: aiTask.metadata.processingTime
          }
        }
      });
    }

    // Check status with Runway
    const runwayTask = await runwayService.checkTaskStatus(taskId);
    
    // Update our task status
    await aiTask.updateFromRunwayTask(runwayTask);

    // If task succeeded, create Video record and upload to S3
    if (runwayTask.status === 'SUCCEEDED' && runwayTask.output && !aiTask.video) {
      try {
        const videoUrl = runwayTask.output[0];
        
        // Download video and upload to our Bunny CDN
        const videoFileName = generateBunnyFileName('ai-generated-video.mp4');
        const uploadResult = await downloadAndUploadToBunny(videoUrl, videoFileName, 'ai-videos', 'video/mp4');

        // Store video URL in AI task for preview (don't create Video record yet)
        aiTask.videoUrl = uploadResult.location;
        aiTask.videoKey = uploadResult.key;
        await aiTask.save();

        console.log(`✅ AI video downloaded and ready for preview: ${aiTask.runwayTaskId}`);

        // ============ NOUVEAU: MODÉRATION AUTOMATIQUE IMMÉDIATE ============
        console.log(`🛡️ Démarrage de la modération automatique pour la vidéo AI: ${aiTask.runwayTaskId}`);
        
        try {
          // Créer un enregistrement vidéo temporaire pour la modération
          const tempVideo = new Video({
            user: req.user._id,
            description: `Vidéo AI temporaire pour modération: ${aiTask.promptText}`,
            videoUrl: uploadResult.location,
            videoKey: uploadResult.key,
            duration: aiTask.options.duration,
            resolution: {
              width: aiTask.options.ratio === '1280:720' ? 1280 : 720,
              height: aiTask.options.ratio === '1280:720' ? 720 : 1280,
            },
            metadata: {
              aiGenerated: true,
              promptText: aiTask.promptText,
              model: aiTask.options.model,
              temporaryForModeration: true // Flag pour indiquer que c'est temporaire
            },
            type: 'short',
            // Définir le statut de modération initial
            moderationStatus: 'pending',
            contentModeration: {
              autoModerationStatus: 'analyzing',
              isAutoApproved: false,
              needsManualReview: false,
              lastModeratedAt: new Date()
            }
          });

          await tempVideo.save();

          // Effectuer la modération de contenu
          const contentModerationService = require('../services/contentModerationService');
          const moderationResult = await contentModerationService.moderateVideoFromUrl(uploadResult.location, {
            failSafe: 'allow' // En cas d'erreur, autoriser la vidéo par défaut
          });

          // Mettre à jour le statut de modération
          const updateData = {
            'contentModeration.autoModerationStatus': moderationResult.isAllowed ? 'approved' : 'rejected',
            'contentModeration.isAutoApproved': moderationResult.isAllowed,
            'contentModeration.moderationConfidence': moderationResult.confidence,
            'contentModeration.lastModeratedAt': new Date()
          };
          
          if (!moderationResult.isAllowed) {
            updateData['contentModeration.rejectionReasons'] = moderationResult.detectedContent;
            updateData.moderationStatus = 'rejected';
          } else {
            updateData.moderationStatus = 'approved';
          }

          await Video.findByIdAndUpdate(tempVideo._id, updateData);

          // Stocker les résultats de modération dans la tâche AI
          aiTask.moderationResult = {
            isAllowed: moderationResult.isAllowed,
            confidence: moderationResult.confidence,
            detectedContent: moderationResult.detectedContent,
            moderatedAt: new Date(),
            videoId: tempVideo._id // Pour référence
          };
          await aiTask.save();

          console.log(`🛡️ Modération automatique terminée: ${moderationResult.isAllowed ? 'APPROUVÉ' : 'REJETÉ'} (confiance: ${(moderationResult.confidence * 100).toFixed(1)}%)`);
          if (moderationResult.detectedContent.length > 0) {
            console.log(`🚨 Problèmes détectés: ${moderationResult.detectedContent.join(', ')}`);
          }

          // Supprimer l'enregistrement vidéo temporaire après modération
          await Video.findByIdAndDelete(tempVideo._id);
          console.log(`🗑️ Enregistrement vidéo temporaire supprimé après modération`);

        } catch (moderationError) {
          console.error('❌ Erreur lors de la modération automatique AI:', moderationError);
          
          // En cas d'erreur, stocker l'erreur dans la tâche
          aiTask.moderationResult = {
            isAllowed: true, // Par défaut, autoriser en cas d'erreur
            confidence: 0,
            detectedContent: ['moderation_error'],
            error: moderationError.message,
            moderatedAt: new Date()
          };
          await aiTask.save();
        }

        return res.json({
          status: 'success',
          data: {
            task: {
              id: aiTask.runwayTaskId,
              status: aiTask.status,
              videoUrl: aiTask.videoUrl,
              publishStatus: aiTask.publishStatus,
              cost: aiTask.cost,
              processingTime: aiTask.metadata.processingTime,
              // ============ NOUVEAU: INCLURE LES RÉSULTATS DE MODÉRATION ============
              moderation: aiTask.moderationResult || {
                isAllowed: true,
                confidence: 0.95,
                detectedContent: [],
                moderatedAt: new Date(),
                fallback: true
              }
            }
          }
        });

      } catch (uploadError) {
        console.error('❌ Error processing completed AI video:', uploadError);
        // Don't fail the request, just return the task status
      }
    }

    res.json({
      status: 'success',
      data: {
        task: {
          id: aiTask.runwayTaskId,
          status: aiTask.status,
          video: aiTask.video,
          error: aiTask.error,
          cost: aiTask.cost,
          processingTime: aiTask.metadata.processingTime
        }
      }
    });

  } catch (error) {
    console.error('❌ Error checking AI task status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check task status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/ai/task/:taskId
 * Cancel AI task
 */
router.delete('/task/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find AI task
    const aiTask = await AITask.findOne({
      runwayTaskId: taskId,
      user: req.user._id
    });

    if (!aiTask) {
      return res.status(404).json({
        status: 'error',
        message: 'AI task not found'
      });
    }

    // Can only cancel pending/running tasks
    if (!['PENDING', 'RUNNING'].includes(aiTask.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Task cannot be cancelled in current status'
      });
    }

    // Cancel with Runway
    await runwayService.cancelTask(taskId);

    // Update our task
    aiTask.status = 'CANCELLED';
    await aiTask.save();

    console.log(`🚫 AI task cancelled: ${taskId}`);

    res.json({
      status: 'success',
      message: 'AI task cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error cancelling AI task:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/tasks
 * Get user's AI tasks history
 */
router.get('/tasks', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const tasks = await AITask.find({ user: req.user._id })
      .populate('video', 'videoUrl thumbnailUrl description likes')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AITask.countDocuments({ user: req.user._id });

    res.json({
      status: 'success',
      data: {
        tasks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching AI tasks:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch AI tasks',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/config
 * Get AI configuration and pricing
 */
router.get('/config', async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        models: [
          {
            id: 'gen4_turbo',
            name: 'Gen-4 Turbo',
            description: 'Latest and fastest model',
            maxDuration: 10,
            pricing: {
              '5s': 0.25,
              '10s': 0.50
            }
          }
        ],
        ratios: [
          { id: '1280:720', name: '16:9 Landscape', width: 1280, height: 720 },
          { id: '720:1280', name: '9:16 Portrait', width: 720, height: 1280 },
          { id: '1104:832', name: '4:3 Landscape', width: 1104, height: 832 },
          { id: '832:1104', name: '3:4 Portrait', width: 832, height: 1104 },
          { id: '960:960', name: '1:1 Square', width: 960, height: 960 }
        ],
        durations: [5, 10],
        limits: {
          promptMaxLength: 1000,
          maxConcurrentTasks: 3
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching AI config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch AI configuration'
    });
  }
});

/**
 * POST /api/ai/task/:taskId/publish
 * Publish AI generated video after preview
 */
router.post('/task/:taskId/publish', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { description, hashtags, music } = req.body;

    console.log(`🎬 Publication de la vidéo AI avec taskId: ${taskId}`);
    if (music) {
      console.log(`🎵 Métadonnées musique reçues:`, music);
    }

    // Find AI task
    const aiTask = await AITask.findOne({
      runwayTaskId: taskId,
      user: req.user._id
    });

    if (!aiTask) {
      return res.status(404).json({
        status: 'error',
        message: 'AI task not found'
      });
    }

    // Check if task is completed and has video
    if (aiTask.status !== 'SUCCEEDED' || !aiTask.videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Video is not ready for publishing'
      });
    }

    // Check if already published
    if (aiTask.publishStatus === 'PUBLISHED') {
      return res.status(400).json({
        status: 'error',
        message: 'Video is already published'
      });
    }

    // Préparer les métadonnées de musique
    const musicData = music ? {
      title: music.title || 'Musique ajoutée',
      artist: music.artist || 'Utilisateur',
      url: music.url || '',
      volume: music.volume || 0.3,
      videoVolume: music.videoVolume || 1
    } : {
      title: 'AI Generated',
      artist: 'Runway AI',
      url: ''
    };

    // Create Video record
    const video = new Video({
      user: req.user._id,
      description: description || `Vidéo générée par IA: ${aiTask.promptText}`,
      videoUrl: aiTask.videoUrl,
      videoKey: aiTask.videoKey,
      duration: aiTask.options.duration,
      resolution: {
        width: aiTask.options.ratio === '1280:720' ? 1280 : 720,
        height: aiTask.options.ratio === '1280:720' ? 720 : 1280,
      },
      music: musicData,
      hashtags: hashtags || ['ai', 'generated', 'runway'],
      metadata: {
        aiGenerated: true,
        promptText: aiTask.promptText,
        model: aiTask.options.model,
        hasCustomMusic: !!music,
        musicMetadata: music || null
      },
      type: 'short',
      // ============ NOUVEAU: DÉFINIR LE STATUT DE MODÉRATION INITIAL ============
      moderationStatus: 'pending',
      contentModeration: {
        autoModerationStatus: 'analyzing',
        isAutoApproved: false,
        needsManualReview: false,
        lastModeratedAt: new Date()
      }
    });

    await video.save();

    // ============ EFFECTUER LA MODÉRATION AUTOMATIQUE LORS DE LA PUBLICATION ============
    console.log(`🛡️ Démarrage de la modération automatique lors de la publication: ${video._id}`);
    
    try {
      const contentModerationService = require('../services/contentModerationService');
      let moderationResult;
      
      // Si nous avons déjà des résultats de modération de la prévisualisation, les utiliser
      if (aiTask.moderationResult && aiTask.moderationResult.isAllowed !== undefined) {
        console.log(`🛡️ Utilisation des résultats de modération existants`);
        moderationResult = aiTask.moderationResult;
        
      } else {
        // Sinon, effectuer une nouvelle modération
        console.log(`🛡️ Effectuer une nouvelle modération lors de la publication`);
        moderationResult = await contentModerationService.moderateVideoFromUrl(aiTask.videoUrl, {
          failSafe: 'allow'
        });
        
        // Stocker les résultats dans la tâche AI pour référence future
        aiTask.moderationResult = {
          isAllowed: moderationResult.isAllowed,
          confidence: moderationResult.confidence,
          detectedContent: moderationResult.detectedContent,
          moderatedAt: new Date()
        };
        await aiTask.save();
      }
      
      // Mettre à jour la vidéo avec les résultats de modération
      const updateData = {
        'contentModeration.autoModerationStatus': moderationResult.isAllowed ? 'approved' : 'rejected',
        'contentModeration.isAutoApproved': moderationResult.isAllowed,
        'contentModeration.moderationConfidence': moderationResult.confidence,
        'contentModeration.lastModeratedAt': new Date()
      };
      
      if (!moderationResult.isAllowed) {
        updateData['contentModeration.rejectionReasons'] = moderationResult.detectedContent;
        updateData.moderationStatus = 'rejected';
      } else {
        updateData.moderationStatus = 'approved';
      }
      
      await Video.findByIdAndUpdate(video._id, updateData);
      console.log(`🛡️ Modération de publication terminée: ${moderationResult.isAllowed ? 'APPROUVÉ' : 'REJETÉ'} (confiance: ${(moderationResult.confidence * 100).toFixed(1)}%)`);
      
      if (moderationResult.detectedContent && moderationResult.detectedContent.length > 0) {
        console.log(`🚨 Problèmes détectés: ${moderationResult.detectedContent.join(', ')}`);
      }
      
    } catch (moderationError) {
      console.error('❌ Erreur lors de la modération de publication:', moderationError);
      
      // En cas d'erreur, approuver par défaut (fallback)
      await Video.findByIdAndUpdate(video._id, {
        'contentModeration.autoModerationStatus': 'approved',
        'contentModeration.isAutoApproved': true,
        'contentModeration.moderationConfidence': 0.95,
        'contentModeration.lastModeratedAt': new Date(),
        moderationStatus: 'approved'
      });
      console.log(`🛡️ Modération échouée, approbation par défaut appliquée`);
    }

    // Update AI task
    aiTask.video = video._id;
    aiTask.publishStatus = 'PUBLISHED';
    await aiTask.save();

    // Update user video count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { videosCount: 1 }
    });

    // Populate video data for response
    await video.populate('user', 'username displayName avatar verified');

    console.log(`✅ AI video published: ${video._id}`);
    if (music) {
      console.log(`🎵 Avec musique: ${musicData.title} par ${musicData.artist}`);
    }

    res.json({
      status: 'success',
      data: {
        video,
        task: {
          id: aiTask.runwayTaskId,
          publishStatus: aiTask.publishStatus
        }
      }
    });

  } catch (error) {
    console.error('❌ Error publishing AI video:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to publish video',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/ai/task/:taskId/reject
 * Reject AI generated video (mark as rejected)
 */
router.post('/task/:taskId/reject', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find AI task
    const aiTask = await AITask.findOne({
      runwayTaskId: taskId,
      user: req.user._id
    });

    if (!aiTask) {
      return res.status(404).json({
        status: 'error',
        message: 'AI task not found'
      });
    }

    // Update publish status
    aiTask.publishStatus = 'REJECTED';
    await aiTask.save();

    console.log(`🚫 AI video rejected: ${taskId}`);

    res.json({
      status: 'success',
      message: 'Video rejected successfully'
    });

  } catch (error) {
    console.error('❌ Error rejecting AI video:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reject video',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/ai/veo/generate-video
 * Start Veo AI video generation
 */
router.post('/veo/generate-video', protect, async (req, res) => {
  try {
    const { promptText, model, aspectRatio, negativePrompt, enhancePrompt, seed, generateAudio } = req.body;

    // Validation
    if (!promptText || promptText.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt text is required'
      });
    }

    if (promptText.length > 1000) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt text cannot exceed 1000 characters'
      });
    }

    console.log(`🤖 Starting Veo video generation for user ${req.user._id}`);
    console.log(`📝 Prompt: "${promptText}"`);

    // Start Veo generation
    const veoResult = await veoService.generateVideoFromText(promptText, {
      model: model || 'veo-3.0-generate-preview',
      aspectRatio: aspectRatio || '16:9',
      negativePrompt,
      enhancePrompt: enhancePrompt !== undefined ? enhancePrompt : true,
      seed,
      generateAudio: generateAudio !== undefined ? generateAudio : true
    });

    // Create AI task record
    const aiTask = new AITask({
      user: req.user._id,
      runwayTaskId: veoResult.operationId, // Using operationId for compatibility
      promptText: promptText.trim(),
      type: 'veo-text-to-video',
      status: 'PENDING',
      options: {
        model: model || 'veo-3.0-generate-preview',
        durationSeconds: 8,
        aspectRatio: aspectRatio || '16:9',
        negativePrompt,
        enhancePrompt: enhancePrompt !== undefined ? enhancePrompt : true,
        seed,
        generateAudio: generateAudio !== undefined ? generateAudio : true
      },
      metadata: {
        provider: 'veo',
        operationName: veoResult.operationName
      }
    });

    await aiTask.save();

    console.log(`✅ Veo AI task created: ${aiTask._id} (Operation: ${veoResult.operationId})`);

    res.status(201).json({
      status: 'success',
      message: 'Veo video generation started',
      data: {
        taskId: veoResult.operationId,
        aiTaskId: aiTask._id,
        type: 'veo-text-to-video',
        estimatedTime: '60-180 seconds',
        provider: 'veo'
      }
    });

  } catch (error) {
    console.error('❌ Veo generation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start Veo video generation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/ai/veo/generate-video-from-image
 * Start Veo AI image-to-video generation
 */
router.post('/veo/generate-video-from-image', protect, async (req, res) => {
  try {
    const { promptText, imageBase64, mimeType, model, aspectRatio, negativePrompt, enhancePrompt, seed, generateAudio } = req.body;

    // Validation
    if (!promptText || promptText.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt text is required'
      });
    }

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({
        status: 'error',
        message: 'Image data and MIME type are required'
      });
    }

    // Validate MIME type
    if (!['image/jpeg', 'image/png'].includes(mimeType)) {
      return res.status(400).json({
        status: 'error',
        message: 'Only JPEG and PNG images are supported'
      });
    }

    console.log(`🤖 Starting Veo image-to-video generation for user ${req.user._id}`);
    console.log(`📝 Prompt: "${promptText}"`);

    // Start Veo image-to-video generation
    const veoResult = await veoService.generateVideoFromImage(imageBase64, mimeType, promptText, {
      model: model || 'veo-3.0-generate-preview',
      aspectRatio: aspectRatio || '16:9',
      negativePrompt,
      enhancePrompt: enhancePrompt !== undefined ? enhancePrompt : true,
      seed,
      generateAudio: generateAudio !== undefined ? generateAudio : true
    });

    // Create AI task record
    const aiTask = new AITask({
      user: req.user._id,
      runwayTaskId: veoResult.operationId, // Using operationId for compatibility
      promptText: promptText.trim(),
      type: 'veo-image-to-video',
      status: 'PENDING',
      options: {
        model: model || 'veo-3.0-generate-preview',
        durationSeconds: 8,
        aspectRatio: aspectRatio || '16:9',
        negativePrompt,
        enhancePrompt: enhancePrompt !== undefined ? enhancePrompt : true,
        seed,
        generateAudio: generateAudio !== undefined ? generateAudio : true
      },
      metadata: {
        provider: 'veo',
        operationName: veoResult.operationName,
        sourceImageMimeType: mimeType
      }
    });

    await aiTask.save();

    console.log(`✅ Veo image-to-video task created: ${aiTask._id} (Operation: ${veoResult.operationId})`);

    res.status(201).json({
      status: 'success',
      message: 'Veo image-to-video generation started',
      data: {
        taskId: veoResult.operationId,
        aiTaskId: aiTask._id,
        type: 'veo-image-to-video',
        estimatedTime: '60-180 seconds',
        provider: 'veo'
      }
    });

  } catch (error) {
    console.error('❌ Veo image-to-video generation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start Veo image-to-video generation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/veo/task/:taskId
 * Check Veo task status
 */
router.get('/veo/task/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find AI task in our database
    const aiTask = await AITask.findOne({
      runwayTaskId: taskId, // Using runwayTaskId field for compatibility
      user: req.user._id,
      'metadata.provider': 'veo'
    }).populate('video', 'videoUrl thumbnailUrl description');

    if (!aiTask) {
      return res.status(404).json({
        status: 'error',
        message: 'Veo task not found'
      });
    }

    // If task is already completed, return cached result
    if (['SUCCEEDED', 'FAILED'].includes(aiTask.status)) {
      return res.json({
        status: 'success',
        data: {
          task: {
            id: aiTask.runwayTaskId,
            status: aiTask.status,
            video: aiTask.video,
            error: aiTask.error,
            provider: 'veo',
            processingTime: aiTask.metadata.processingTime
          }
        }
      });
    }

    // Check status with Veo
    const operationName = aiTask.metadata.operationName;
    const veoOperation = await veoService.checkOperationStatus(operationName);
    
    // Update task status
    aiTask.status = veoOperation.status;
    
    if (veoOperation.status === 'FAILED') {
      aiTask.error = veoOperation.error;
      await aiTask.save();
      
      return res.json({
        status: 'success',
        data: {
          task: {
            id: taskId,
            status: 'FAILED',
            error: veoOperation.error,
            provider: 'veo'
          }
        }
      });
    }

    // If task succeeded, create Video record and upload to S3
    if (veoOperation.status === 'SUCCEEDED' && veoOperation.output && !aiTask.video) {
      try {
        const generatedSamples = veoOperation.output;
        
        if (generatedSamples && generatedSamples.length > 0) {
          const firstSample = generatedSamples[0];
          const videoUri = firstSample.video.uri;
          
          // Download video and upload to our Bunny CDN
          const videoFileName = generateBunnyFileName('veo-generated-video.mp4');
          const uploadResult = await downloadAndUploadToBunny(videoUri, videoFileName, 'veo-videos', 'video/mp4');

          // Create video record
          const video = new Video({
            user: req.user._id,
            description: `Vidéo générée par Veo: ${aiTask.promptText}`,
            videoUrl: uploadResult.location,
            videoKey: uploadResult.key,
            duration: aiTask.options.durationSeconds || 8,
            resolution: {
              width: aiTask.options.aspectRatio === '16:9' ? 1280 : 720,
              height: aiTask.options.aspectRatio === '16:9' ? 720 : 1280,
            },
            metadata: {
              aiGenerated: true,
              provider: 'veo',
              model: aiTask.options.model,
              promptText: aiTask.promptText,
              operationId: taskId
            },
            type: 'long' // Veo videos are long-form
          });

          await video.save();

          // Update AI task with video reference
          aiTask.video = video._id;
          aiTask.videoUrl = uploadResult.location;
          aiTask.videoKey = uploadResult.key;
          aiTask.status = 'SUCCEEDED';
          aiTask.metadata.processingTime = Date.now() - new Date(aiTask.createdAt).getTime();
          
          await aiTask.save();

          console.log(`✅ Veo video processed and saved: ${video._id}`);
        }
      } catch (error) {
        console.error('❌ Error processing Veo video:', error);
        aiTask.status = 'FAILED';
        aiTask.error = 'Failed to process generated video';
        await aiTask.save();
      }
    } else {
      await aiTask.save();
    }

    // Refresh task data
    await aiTask.populate('video', 'videoUrl thumbnailUrl description');

    res.json({
      status: 'success',
      data: {
        task: {
          id: taskId,
          status: aiTask.status,
          video: aiTask.video,
          error: aiTask.error,
          provider: 'veo',
          processingTime: aiTask.metadata.processingTime
        }
      }
    });

  } catch (error) {
    console.error('❌ Error checking Veo task status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check task status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/veo/config
 * Get Veo configuration and supported models
 */
router.get('/veo/config', protect, async (req, res) => {
  try {
    const models = veoService.getSupportedModels();
    
    res.json({
      status: 'success',
      data: {
        models,
        aspectRatios: [
          { id: '16:9', name: '16:9 Landscape', width: 1280, height: 720 },
          { id: '9:16', name: '9:16 Portrait', width: 720, height: 1280, supported: false } // Note: 9:16 not supported by veo-3.0
        ],
        limits: {
          promptMaxLength: 1000,
          maxConcurrentTasks: 3,
          supportedImageTypes: ['image/jpeg', 'image/png'],
          maxImageSize: '10MB'
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching Veo config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Veo configuration'
    });
  }
});


router.post('/flux/generate-image', protect, async (req, res) => {
  try {
    const { 
      promptText, 
      model = 'flux-pro-1.1',
      width = 1024,
      height = 1024,
      aspectRatio = '1:1',
      steps = 30,
      guidance = 3.5,
      seed = null,
      promptUpsampling = false,
      safetyTolerance = 2
    } = req.body;

    // Validation
    const validation = fluxService.validateParameters(promptText, { width, height, steps });
    if (!validation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // NOUVEAU: Vérification des crédits (5 crédits par génération)
    const requiredCredits = 5;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (user.credits < requiredCredits) {
      return res.status(402).json({
        status: 'error',
        message: 'Insufficient credits',
        data: {
          required: requiredCredits,
          available: user.credits,
          creditCost: requiredCredits
        }
      });
    }

    console.log(`🎨 Starting FLUX image generation for user ${req.user._id}`);
    console.log(`📝 Prompt: "${promptText}"`);
    console.log(`💳 Credits check: ${user.credits} available, ${requiredCredits} required`);

    // Calculate dimensions from aspect ratio if provided
    let finalWidth = width;
    let finalHeight = height;
    
    if (aspectRatio && aspectRatio !== 'custom') {
      const dimensions = fluxService.calculateDimensions(aspectRatio, 1024);
      finalWidth = dimensions.width;
      finalHeight = dimensions.height;
    }

    // Start FLUX generation
    const fluxResult = await fluxService.generateImageFromText(promptText, {
      model,
      width: finalWidth,
      height: finalHeight,
      steps,
      guidance,
      seed,
      prompt_upsampling: promptUpsampling,
      safety_tolerance: safetyTolerance
    });

    // NOUVEAU: Déduire les crédits APRÈS que la génération ait commencé avec succès
    user.credits -= requiredCredits;
    await user.save();

    console.log(`💳 Credits deducted: ${requiredCredits} (Remaining: ${user.credits})`);

    // Create AI image record
    const aiImage = new AIImage({
      user: req.user._id,
      taskId: fluxResult.taskId,
      promptText: promptText.trim(),
      type: 'text-to-image',
      model: model,
      status: 'PENDING',
      options: {
        width: finalWidth,
        height: finalHeight,
        steps,
        guidance,
        aspectRatio,
        seed,
        promptUpsampling,
        safetyTolerance
      },
      metadata: {
        provider: 'flux',
        originalTaskId: fluxResult.taskId,
        creditsUsed: requiredCredits // NOUVEAU: Stocker le coût en crédits
      }
    });

    await aiImage.save();

    console.log(`✅ FLUX image task created: ${aiImage._id} (Task: ${fluxResult.taskId})`);

    res.status(201).json({
      status: 'success',
      message: 'FLUX image generation started',
      data: {
        taskId: fluxResult.taskId,
        aiImageId: aiImage._id,
        type: 'text-to-image',
        provider: 'flux',
        model: model,
        estimatedTime: '10-30 seconds',
        dimensions: {
          width: finalWidth,
          height: finalHeight,
          aspectRatio
        },
        creditsUsed: requiredCredits,
        remainingCredits: user.credits
      }
    });

  } catch (error) {
    console.error('❌ FLUX image generation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start FLUX image generation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/ai/flux/edit-image
 * Edit image using FLUX Kontext (image-to-image)
 */
router.post('/flux/edit-image', protect, async (req, res) => {
  try {
    const { 
      promptText, 
      imageBase64,
      sourceImageUrl,
      model = 'flux-pro-1.1-kontext',
      aspectRatio = '1:1',
      seed = null,
      promptUpsampling = false,
      safetyTolerance = 2
    } = req.body;

    // Validation
    if (!promptText || promptText.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt text is required'
      });
    }

    if (!imageBase64 && !sourceImageUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Either imageBase64 or sourceImageUrl is required'
      });
    }

    // NOUVEAU: Vérification des crédits (5 crédits par édition)
    const requiredCredits = 5;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (user.credits < requiredCredits) {
      return res.status(402).json({
        status: 'error',
        message: 'Insufficient credits',
        data: {
          required: requiredCredits,
          available: user.credits,
          creditCost: requiredCredits
        }
      });
    }

    console.log(`🎨 Starting FLUX Kontext image editing for user ${req.user._id}`);
    console.log(`📝 Prompt: "${promptText}"`);
    console.log(`💳 Credits check: ${user.credits} available, ${requiredCredits} required`);

    let finalImageBase64 = imageBase64;

    // If sourceImageUrl is provided, download and convert to base64
    if (sourceImageUrl && !imageBase64) {
      try {
        const imageResponse = await axios.get(sourceImageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);
        finalImageBase64 = imageBuffer.toString('base64');
      } catch (downloadError) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to download source image'
        });
      }
    }

    // Start FLUX Kontext generation
    const fluxResult = await fluxService.generateImageFromImage(finalImageBase64, promptText, {
      model,
      aspect_ratio: aspectRatio,
      seed,
      prompt_upsampling: promptUpsampling,
      safety_tolerance: safetyTolerance
    });

    // NOUVEAU: Déduire les crédits APRÈS que la génération ait commencé avec succès
    user.credits -= requiredCredits;
    await user.save();

    console.log(`💳 Credits deducted: ${requiredCredits} (Remaining: ${user.credits})`);

    // Create AI image record
    const aiImage = new AIImage({
      user: req.user._id,
      taskId: fluxResult.taskId,
      promptText: promptText.trim(),
      type: 'image-to-image',
      model: model,
      status: 'PENDING',
      sourceImageUrl: sourceImageUrl || null,
      options: {
        aspectRatio,
        seed,
        promptUpsampling,
        safetyTolerance
      },
      metadata: {
        provider: 'flux',
        originalTaskId: fluxResult.taskId,
        creditsUsed: requiredCredits // NOUVEAU: Stocker le coût en crédits
      }
    });

    await aiImage.save();

    console.log(`✅ FLUX Kontext task created: ${aiImage._id} (Task: ${fluxResult.taskId})`);

    res.status(201).json({
      status: 'success',
      message: 'FLUX image editing started',
      data: {
        taskId: fluxResult.taskId,
        aiImageId: aiImage._id,
        type: 'image-to-image',
        provider: 'flux',
        model: model,
        estimatedTime: '10-30 seconds',
        aspectRatio,
        creditsUsed: requiredCredits,
        remainingCredits: user.credits
      }
    });

  } catch (error) {
    console.error('❌ FLUX image editing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start FLUX image editing',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/flux/task/:taskId
 * Check FLUX task status and get result
 */
router.get('/flux/task/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find AI image in our database
    const aiImage = await AIImage.findOne({
      taskId: taskId,
      user: req.user._id
    }).populate('publishedImage', 'imageUrl thumbnailUrl description likes');

    if (!aiImage) {
      return res.status(404).json({
        status: 'error',
        message: 'FLUX task not found'
      });
    }

    // If task is already completed, return cached result
    if (['SUCCEEDED', 'FAILED'].includes(aiImage.status)) {
      return res.json({
        status: 'success',
        data: {
          task: {
            id: aiImage.taskId,
            status: aiImage.status,
            imageUrl: aiImage.imageUrl,
            publishStatus: aiImage.publishStatus,
            publishedImage: aiImage.publishedImage,
            error: aiImage.error,
            cost: aiImage.cost,
            costInDollars: aiImage.costInDollars,
            processingTime: aiImage.processingTimeSeconds,
            provider: 'flux',
            model: aiImage.model,
            dimensions: aiImage.dimensions
          }
        }
      });
    }

    // Check status with FLUX
    const fluxTask = await fluxService.checkTaskStatus(taskId);
    
    // Update our task status
    await aiImage.updateFromFluxTask(fluxTask);

    // If task succeeded, download and upload to S3
    if (fluxTask.status === 'SUCCEEDED' && fluxTask.output && !aiImage.imageKey) {
      try {
        const imageUrl = fluxTask.output[0];
        
        // Download image and upload to our Bunny CDN
        const imageFileName = generateBunnyFileName('flux-generated-image.jpg');
        const uploadResult = await downloadAndUploadToBunny(imageUrl, imageFileName, 'ai-images', 'image/jpeg');

        // Update AI image with Bunny CDN info
        aiImage.imageUrl = uploadResult.location;
        aiImage.imageKey = uploadResult.key;
        await aiImage.save();

        console.log(`✅ FLUX image downloaded and ready for preview: ${aiImage.taskId}`);

      } catch (uploadError) {
        console.error('❌ Error processing completed FLUX image:', uploadError);
        
        // Mark the task as failed if download fails after all retries
        if (uploadError.code === 'ENOTFOUND' || uploadError.hostname) {
          console.log(`🔄 DNS/Network issue detected, scheduling background retry for task: ${aiImage.taskId}`);
          // Schedule background retry
          await scheduleDownloadRetry(aiImage.taskId, imageUrl);
          // Keep the task as SUCCEEDED so it can be retried
        } else {
          // For other errors, mark as failed
          aiImage.status = 'FAILED';
          aiImage.error = `Download failed: ${uploadError.message}`;
          await aiImage.save();
          console.log(`❌ FLUX task marked as failed due to download error: ${aiImage.taskId}`);
        }
      }
    }

    // Refresh data
    await aiImage.populate('publishedImage', 'imageUrl thumbnailUrl description likes');

    res.json({
      status: 'success',
      data: {
        task: {
          id: aiImage.taskId,
          status: aiImage.status,
          imageUrl: aiImage.imageUrl,
          publishStatus: aiImage.publishStatus,
          publishedImage: aiImage.publishedImage,
          error: aiImage.error,
          cost: aiImage.cost,
          costInDollars: aiImage.costInDollars,
          processingTime: aiImage.processingTimeSeconds,
          provider: 'flux',
          model: aiImage.model,
          dimensions: aiImage.dimensions
        }
      }
    });

  } catch (error) {
    console.error('❌ Error checking FLUX task status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check task status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/ai/flux/task/:taskId/publish
 * Publish FLUX generated image
 */
router.post('/flux/task/:taskId/publish', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { description, hashtags, title } = req.body;

    console.log(`🖼️ Publishing FLUX image with taskId: ${taskId}`);

    // Find AI image
    const aiImage = await AIImage.findOne({
      taskId: taskId,
      user: req.user._id
    });

    if (!aiImage) {
      return res.status(404).json({
        status: 'error',
        message: 'FLUX task not found'
      });
    }

    // Check if image is ready for publishing
    if (aiImage.status !== 'SUCCEEDED' || !aiImage.imageUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Image is not ready for publishing'
      });
    }

    // Check if already published
    if (aiImage.publishStatus === 'PUBLISHED') {
      return res.status(400).json({
        status: 'error',
        message: 'Image is already published'
      });
    }

    // Create Image record (assuming you have an Image model)
    const publishedImage = new Image({
      user: req.user._id,
      title: title || `AI Generated: ${aiImage.promptText.substring(0, 50)}...`,
      description: description || `Image generated by ${aiImage.model}: ${aiImage.promptText}`,
      imageUrl: aiImage.imageUrl,
      imageKey: aiImage.imageKey,
      width: aiImage.options.width,
      height: aiImage.options.height,
      hashtags: hashtags || ['ai', 'flux', 'generated'],
      metadata: {
        aiGenerated: true,
        provider: 'flux',
        model: aiImage.model,
        promptText: aiImage.promptText,
        taskId: taskId,
        generationCost: aiImage.cost,
        aspectRatio: aiImage.options.aspectRatio
      },
      type: 'ai-generated',
      // Définir le statut de modération initial
      moderationStatus: 'pending',
      contentModeration: {
        autoModerationStatus: 'analyzing',
        isAutoApproved: false,
        needsManualReview: false,
        lastModeratedAt: new Date()
      }
    });

    await publishedImage.save();

    // Effectuer la modération de contenu sur l'image IA
    console.log(`🛡️ Démarrage de la modération de contenu pour l'image IA...`);
    
    try {
      const moderationResult = await imageModerationService.moderateImageFromUrl(aiImage.imageUrl, {
        failSafe: 'allow' // En cas d'erreur, autoriser l'image par défaut
      });
      
      // Mettre à jour l'image avec les résultats de modération
      const updateData = {
        'contentModeration.autoModerationStatus': moderationResult.isAllowed ? 'approved' : 'rejected',
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
      
      await Image.findByIdAndUpdate(publishedImage._id, updateData);
      
      console.log(`🛡️ Modération d'image IA terminée: ${moderationResult.isAllowed ? 'APPROUVÉ' : 'REJETÉ'} (confiance: ${(moderationResult.confidence * 100).toFixed(1)}%)`);
      
    } catch (moderationError) {
      console.error('❌ Erreur lors de la modération d\'image IA:', moderationError);
      
      // En cas d'erreur, marquer pour révision manuelle
      await Image.findByIdAndUpdate(publishedImage._id, {
        'contentModeration.autoModerationStatus': 'error',
        'contentModeration.needsManualReview': true,
        moderationStatus: 'under_review'
      });
    }

    // Update AI image
    aiImage.publishedImage = publishedImage._id;
    aiImage.publishStatus = 'PUBLISHED';
    await aiImage.save();

    // Update user image count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { imagesCount: 1 }
    });

    // Populate image data for response
    await publishedImage.populate('user', 'username displayName avatar verified');

    console.log(`✅ FLUX image published: ${publishedImage._id}`);

    res.json({
      status: 'success',
      data: {
        image: publishedImage,
        task: {
          id: aiImage.taskId,
          publishStatus: aiImage.publishStatus
        }
      }
    });

  } catch (error) {
    console.error('❌ Error publishing FLUX image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to publish image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/ai/flux/task/:taskId/reject
 * Reject FLUX generated image
 */
router.post('/flux/task/:taskId/reject', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find AI image
    const aiImage = await AIImage.findOne({
      taskId: taskId,
      user: req.user._id
    });

    if (!aiImage) {
      return res.status(404).json({
        status: 'error',
        message: 'FLUX task not found'
      });
    }

    // Update publish status
    aiImage.publishStatus = 'REJECTED';
    await aiImage.save();

    console.log(`🚫 FLUX image rejected: ${taskId}`);

    res.json({
      status: 'success',
      message: 'Image rejected successfully'
    });

  } catch (error) {
    console.error('❌ Error rejecting FLUX image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reject image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/flux/tasks
 * Get user's FLUX image generation history
 */
router.get('/flux/tasks', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const model = req.query.model;

    const images = await AIImage.getUserHistory(req.user._id, {
      page,
      limit,
      status,
      model
    });

    const total = await AIImage.countDocuments({ 
      user: req.user._id,
      ...(status && { status }),
      ...(model && { model })
    });

    res.json({
      status: 'success',
      data: {
        images,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching FLUX tasks:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch FLUX tasks',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/flux/config
 * Get FLUX configuration and available models
 */
router.get('/flux/config', async (req, res) => {
  try {
    const models = fluxService.getSupportedModels();
    
    res.json({
      status: 'success',
      data: {
        models,
        aspectRatios: [
          { id: '1:1', name: '1:1 Square', width: 1024, height: 1024 },
          { id: '16:9', name: '16:9 Landscape', width: 1344, height: 768 },
          { id: '9:16', name: '9:16 Portrait', width: 768, height: 1344 },
          { id: '4:3', name: '4:3 Landscape', width: 1152, height: 896 },
          { id: '3:4', name: '3:4 Portrait', width: 896, height: 1152 },
          { id: '3:2', name: '3:2 Landscape', width: 1216, height: 832 },
          { id: '2:3', name: '2:3 Portrait', width: 832, height: 1216 }
        ],
        stepRanges: {
          'flux-pro-1.1': { min: 1, max: 50, recommended: 25 },
          'flux-pro': { min: 10, max: 50, recommended: 30 },
          'flux-dev': { min: 1, max: 50, recommended: 20 },
          'flux-schnell': { min: 1, max: 8, recommended: 4 }
        },
        guidanceRanges: {
          'flux-pro-1.1': { min: 1.0, max: 10.0, recommended: 3.5 },
          'flux-pro': { min: 1.0, max: 10.0, recommended: 3.5 },
          'flux-dev': { min: 1.0, max: 10.0, recommended: 3.5 },
          'flux-schnell': { min: 0.0, max: 5.0, recommended: 0.0 }
        },
        limits: {
          promptMaxLength: 1000,
          maxConcurrentTasks: 5,
          maxWidth: 2048,
          maxHeight: 2048,
          minWidth: 256,
          minHeight: 256
        },
        features: {
          textToImage: ['flux-pro-1.1', 'flux-pro', 'flux-dev', 'flux-schnell'],
          imageToImage: ['flux-pro-1.1-kontext', 'flux-kontext-max'],
          inpainting: ['flux-pro-1.1-kontext'],
          promptUpsampling: ['flux-pro-1.1', 'flux-pro-1.1-kontext', 'flux-kontext-max']
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching FLUX config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch FLUX configuration'
    });
  }
});

/**
 * GET /api/ai/flux/stats
 * Get user's FLUX generation statistics
 */
router.get('/flux/stats', protect, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'month'; // day, week, month
    
    const stats = await AIImage.getGenerationStats(req.user._id, timeframe);
    
    res.json({
      status: 'success',
      data: {
        timeframe,
        stats: stats[0] || {
          totalGenerations: 0,
          successfulGenerations: 0,
          failedGenerations: 0,
          totalCost: 0,
          avgProcessingTime: 0,
          modelUsage: []
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching FLUX stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/ai/flux/task/:taskId
 * Cancel FLUX task (if possible) or delete from history
 */
router.delete('/flux/task/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find AI image
    const aiImage = await AIImage.findOne({
      taskId: taskId,
      user: req.user._id
    });

    if (!aiImage) {
      return res.status(404).json({
        status: 'error',
        message: 'FLUX task not found'
      });
    }

    // If task is still pending, try to cancel it
    if (aiImage.status === 'PENDING') {
      await fluxService.cancelTask(taskId);
      aiImage.status = 'CANCELLED';
      await aiImage.save();
      
      console.log(`🚫 FLUX task cancelled: ${taskId}`);
      
      return res.json({
        status: 'success',
        message: 'FLUX task cancelled successfully'
      });
    }

    // Otherwise, just remove from our database
    await aiImage.remove();
    
    console.log(`🗑️ FLUX task deleted from history: ${taskId}`);

    res.json({
      status: 'success',
      message: 'FLUX task deleted from history'
    });

  } catch (error) {
    console.error('❌ Error deleting FLUX task:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/ai/flux/task/:taskId/download
 * Download FLUX generated image
 */
router.post('/flux/task/:taskId/download', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    console.log(`📥 Download request for FLUX image with taskId: ${taskId}`);

    // Find AI image
    const aiImage = await AIImage.findOne({
      taskId: taskId,
      user: req.user._id
    });

    if (!aiImage) {
      return res.status(404).json({
        status: 'error',
        message: 'FLUX task not found'
      });
    }

    // Check if image is ready for download
    if (aiImage.status !== 'SUCCEEDED' || !aiImage.imageUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Image is not ready for download'
      });
    }

    try {
      // Get image from Bunny CDN - files are publicly accessible
      const downloadUrl = aiImage.imageUrl;

      console.log(`✅ Download URL generated for task: ${taskId}`);

      // Record the download request
      await aiImage.recordDownload(
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent')
      );

      res.json({
        status: 'success',
        message: 'Download URL generated successfully',
        data: {
          downloadUrl: downloadUrl,
          filename: `flux-generated-${taskId}.jpg`,
          expiresIn: null, // Bunny CDN files don't expire
          taskId: taskId
        }
      });

    } catch (error) {
      console.error('❌ Error generating download URL:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate download URL'
      });
    }

  } catch (error) {
    console.error('❌ Error processing download request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process download request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/flux/task/:taskId/info
 * Get detailed information about FLUX generated image
 */
router.get('/flux/task/:taskId/info', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find AI image
    const aiImage = await AIImage.findOne({
      taskId: taskId,
      user: req.user._id
    }).populate('publishedImage', 'imageUrl thumbnailUrl description likes')
      .populate('user', 'username displayName avatar');

    if (!aiImage) {
      return res.status(404).json({
        status: 'error',
        message: 'FLUX task not found'
      });
    }

    // Get additional file info if image is ready
    let fileInfo = null;
    if (aiImage.status === 'SUCCEEDED' && aiImage.imageKey) {
      try {
        // For Bunny CDN, we can provide basic file info
        fileInfo = {
          size: null, // File size not easily available from Bunny CDN without additional request
          sizeFormatted: 'Unknown',
          contentType: 'image/jpeg',
          lastModified: aiImage.updatedAt,
          etag: null
        };
      } catch (error) {
        console.log('⚠️ Could not get Bunny CDN file info:', error.message);
      }
    }

    res.json({
      status: 'success',
      data: {
        task: {
          id: aiImage.taskId,
          status: aiImage.status,
          promptText: aiImage.promptText,
          model: aiImage.model,
          type: aiImage.type,
          imageUrl: aiImage.imageUrl,
          publishStatus: aiImage.publishStatus,
          publishedImage: aiImage.publishedImage,
          error: aiImage.error,
          cost: aiImage.cost,
          costInDollars: aiImage.costInDollars,
          processingTime: aiImage.processingTimeSeconds,
          provider: 'flux',
          dimensions: aiImage.dimensions,
          options: aiImage.options,
          createdAt: aiImage.createdAt,
          updatedAt: aiImage.updatedAt
        },
        fileInfo: fileInfo,
        downloadable: aiImage.status === 'SUCCEEDED' && !!aiImage.imageKey,
        user: aiImage.user
      }
    });

  } catch (error) {
    console.error('❌ Error fetching FLUX task info:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch task information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * GET /api/ai/flux/task/:taskId/download-direct
 * Direct download of FLUX generated image (streams the file)
 */
router.get('/flux/task/:taskId/download-direct', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    console.log(`📥 Direct download request for FLUX image with taskId: ${taskId}`);

    // Find AI image
    const aiImage = await AIImage.findOne({
      taskId: taskId,
      user: req.user._id
    });

    if (!aiImage) {
      return res.status(404).json({
        status: 'error',
        message: 'FLUX task not found'
      });
    }

    // Check if image is ready for download
    if (aiImage.status !== 'SUCCEEDED' || !aiImage.imageUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Image is not ready for download'
      });
    }

    try {
      // For Bunny CDN, redirect to the public CDN URL for direct download
      const downloadUrl = aiImage.imageUrl;
      
      // Set response headers for download and redirect
      res.setHeader('Content-Disposition', `attachment; filename="flux-generated-${taskId}.jpg"`);
      
      // Record the download
      try {
        await aiImage.recordDownload(
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent')
        );
      } catch (recordError) {
        console.log('⚠️ Could not record download:', recordError.message);
      }

      console.log(`✅ Direct download redirect for task: ${taskId}`);
      
      // Redirect to the Bunny CDN URL
      res.redirect(downloadUrl);

    } catch (error) {
      console.error('❌ Error processing direct download:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to download image'
      });
    }

  } catch (error) {
    console.error('❌ Error processing direct download:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process download request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/ai/flux/download-multiple
 * Download multiple FLUX generated images
 */
router.post('/flux/download-multiple', protect, async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'taskIds array is required'
      });
    }

    if (taskIds.length > 10) {
      return res.status(400).json({
        status: 'error',
        message: 'Maximum 10 images can be downloaded at once'
      });
    }

    console.log(`📥 Bulk download request for ${taskIds.length} FLUX images`);

    // Find all AI images
    const aiImages = await AIImage.find({
      taskId: { $in: taskIds },
      user: req.user._id,
      status: 'SUCCEEDED',
      imageUrl: { $ne: null }
    });

    if (aiImages.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No downloadable images found'
      });
    }

    // Generate download URLs for all images
    const downloadData = [];
    const errors = [];

    for (const aiImage of aiImages) {
      try {
        // For Bunny CDN, use the direct image URL
        const downloadUrl = aiImage.imageUrl;

        downloadData.push({
          taskId: aiImage.taskId,
          downloadUrl: downloadUrl,
          filename: `flux-generated-${aiImage.taskId}.jpg`,
          promptText: aiImage.promptText.substring(0, 50) + '...',
          model: aiImage.model,
          createdAt: aiImage.createdAt
        });

      } catch (error) {
        errors.push({
          taskId: aiImage.taskId,
          error: error.message
        });
      }
    }

    console.log(`✅ Generated ${downloadData.length} download URLs for bulk download`);

    res.json({
      status: 'success',
      message: `Generated download URLs for ${downloadData.length} images`,
      data: {
        downloads: downloadData,
        errors: errors,
        expiresIn: null, // Bunny CDN files don't expire
        totalCount: downloadData.length
      }
    });

  } catch (error) {
    console.error('❌ Error processing bulk download:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process bulk download',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 
 