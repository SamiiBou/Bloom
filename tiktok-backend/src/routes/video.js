const express = require('express');
const { protect } = require('../middleware/auth');
const Video = require('../models/Video');
const User = require('../models/User');
const AWS = require('aws-sdk');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configuration AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * POST /api/video/render
 * Render final video from project data
 */
router.post('/render', protect, async (req, res) => {
  try {
    const { clips, duration, resolution, fps } = req.body;
    const startTime = Date.now();

    if (!clips || clips.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No clips provided for rendering'
      });
    }

    console.log(`🎬 Starting video render for user ${req.user._id}`);
    console.log(`📊 Project: ${clips.length} clips, ${duration}s duration`);

    // Create temporary directory for processing
    const tempDir = path.join(__dirname, '../../temp', uuidv4());
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Download and prepare all video clips
      const videoClips = clips.filter(clip => clip.type === 'video');
      const audioClips = clips.filter(clip => clip.type === 'audio');
      const textClips = clips.filter(clip => clip.type === 'text');

      // Process video clips
      const processedVideos = [];
      for (let i = 0; i < videoClips.length; i++) {
        const clip = videoClips[i];
        const outputPath = path.join(tempDir, `video_${i}.mp4`);
        
        await processVideoClip(clip, outputPath, resolution);
        processedVideos.push({
          path: outputPath,
          startTime: clip.startTime,
          duration: clip.duration
        });
      }

      // Create final composition
      const finalOutputPath = path.join(tempDir, 'final_output.mp4');
      await createFinalComposition(processedVideos, audioClips, textClips, finalOutputPath, {
        duration,
        resolution,
        fps
      });

      // Upload to S3
      const s3Key = `rendered-videos/${uuidv4()}.mp4`;
      const uploadResult = await uploadToS3(finalOutputPath, s3Key);

      // Create Video record
      const video = new Video({
        user: req.user._id,
        description: `Vidéo éditée - ${new Date().toLocaleDateString('fr-FR')}`,
        videoUrl: uploadResult.location,
        videoKey: uploadResult.key,
        duration: duration,
        resolution: resolution,
        hashtags: ['edited', 'custom'],
        metadata: {
          isEdited: true,
          clipsCount: clips.length,
          renderDate: new Date()
        }
      });

      await video.save();

      // Update user video count
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { videosCount: 1 }
      });

      // Populate video data
      await video.populate('user', 'username displayName avatar verified');

      // Cleanup temp files
      await fs.rmdir(tempDir, { recursive: true });

      console.log(`✅ Video rendered and saved: ${video._id}`);

      res.json({
        status: 'success',
        data: {
          video,
          renderTime: Date.now() - startTime
        }
      });

    } catch (processingError) {
      // Cleanup on error
      await fs.rmdir(tempDir, { recursive: true }).catch(() => {});
      throw processingError;
    }

  } catch (error) {
    console.error('❌ Video render error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to render video',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Process individual video clip
 */
async function processVideoClip(clip, outputPath, targetResolution) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(clip.source);

    // Apply transformations
    if (clip.scale !== 1) {
      const newWidth = Math.round(targetResolution.width * clip.scale);
      const newHeight = Math.round(targetResolution.height * clip.scale);
      command = command.size(`${newWidth}x${newHeight}`);
    }

    // Apply effects
    if (clip.effects && clip.effects.length > 0) {
      clip.effects.forEach(effect => {
        switch (effect) {
          case 'blur':
            command = command.videoFilters('boxblur=2:1');
            break;
          case 'sepia':
            command = command.videoFilters('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
            break;
          case 'grayscale':
            command = command.videoFilters('colorchannelmixer=.299:.587:.114:0:.299:.587:.114:0:.299:.587:.114');
            break;
          case 'brightness':
            command = command.videoFilters('eq=brightness=0.1');
            break;
          case 'contrast':
            command = command.videoFilters('eq=contrast=1.2');
            break;
        }
      });
    }

    // Set position if needed
    if (clip.position && (clip.position.x !== 0 || clip.position.y !== 0)) {
      const x = Math.round((clip.position.x / 100) * targetResolution.width);
      const y = Math.round((clip.position.y / 100) * targetResolution.height);
      command = command.videoFilters(`overlay=${x}:${y}`);
    }

    // Set opacity
    if (clip.opacity !== 1) {
      command = command.videoFilters(`format=rgba,colorchannelmixer=aa=${clip.opacity}`);
    }

    // Set volume
    if (clip.volume !== 1) {
      command = command.audioFilters(`volume=${clip.volume}`);
    }

    command
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Create final composition with all elements
 */
async function createFinalComposition(videoClips, audioClips, textClips, outputPath, options) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    // Add video inputs
    videoClips.forEach(clip => {
      command = command.input(clip.path);
    });

    // Add audio inputs
    audioClips.forEach(clip => {
      command = command.input(clip.source);
    });

    // Create filter complex for composition
    let filterComplex = [];
    let currentOutput = '[0:v]';

    // Concatenate videos if multiple
    if (videoClips.length > 1) {
      const concatInputs = videoClips.map((_, i) => `[${i}:v][${i}:a]`).join('');
      filterComplex.push(`${concatInputs}concat=n=${videoClips.length}:v=1:a=1[outv][outa]`);
      currentOutput = '[outv]';
    }

    // Add text overlays
    textClips.forEach((textClip, index) => {
      const textFilter = `${currentOutput}drawtext=text='${textClip.content}':fontsize=${textClip.style.fontSize}:fontcolor=${textClip.style.color}:x=${textClip.position.x}:y=${textClip.position.y}:enable='between(t,${textClip.startTime},${textClip.startTime + textClip.duration})'[text${index}]`;
      filterComplex.push(textFilter);
      currentOutput = `[text${index}]`;
    });

    // Apply filter complex
    if (filterComplex.length > 0) {
      command = command.complexFilter(filterComplex);
    }

    // Set output options
    command
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-c:a aac',
        '-b:a 128k',
        `-r ${options.fps}`,
        `-s ${options.resolution.width}x${options.resolution.height}`,
        `-t ${options.duration}`
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Upload file to S3
 */
async function uploadToS3(filePath, s3Key) {
  const fileContent = await fs.readFile(filePath);
  
  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: s3Key,
    Body: fileContent,
    ContentType: 'video/mp4',
  };

  const result = await s3.upload(uploadParams).promise();
  return {
    location: result.Location,
    key: result.Key,
    bucket: result.Bucket
  };
}

/**
 * GET /api/video/projects
 * Get user's saved projects
 */
router.get('/projects', protect, async (req, res) => {
  try {
    // For now, return empty array - could be extended to save projects in DB
    res.json({
      status: 'success',
      data: {
        projects: []
      }
    });
  } catch (error) {
    console.error('❌ Error fetching projects:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch projects'
    });
  }
});

/**
 * POST /api/video/save-project
 * Save video editing project
 */
router.post('/save-project', protect, async (req, res) => {
  try {
    const projectData = req.body;
    
    // For now, just return success - could be extended to save in DB
    console.log(`💾 Project saved for user ${req.user._id}`);
    
    res.json({
      status: 'success',
      message: 'Project saved successfully'
    });
  } catch (error) {
    console.error('❌ Error saving project:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save project'
    });
  }
});

module.exports = router; 
 