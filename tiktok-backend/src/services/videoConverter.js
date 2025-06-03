const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');

// Configuration des chemins ffmpeg 
try {
  // En développement, utiliser les packages npm pour les binaires FFmpeg
  if (process.env.NODE_ENV !== 'production') {
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffprobePath = require('@ffprobe-installer/ffprobe').path;
    
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    
    console.log('✅ FFmpeg paths configured for video conversion');
    console.log(`   FFmpeg: ${ffmpegPath}`);
    console.log(`   FFprobe: ${ffprobePath}`);
  } else {
    // En production, utiliser les chemins système ou variables d'environnement
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    }
    if (process.env.FFPROBE_PATH) {
      ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
    }
  }
} catch (error) {
  console.error('⚠️  Warning: Could not configure FFmpeg paths:', error.message);
  console.log('   Make sure FFmpeg is installed on your system or install the dev packages:');
  console.log('   npm install --save-dev @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe');
}

class VideoConverter {
  constructor() {
    this.tempDir = process.env.TEMP_UPLOAD_DIR || './temp';
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.access(this.tempDir);
    } catch (error) {
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`📁 Dossier temporaire créé: ${this.tempDir}`);
    }
  }

  /**
   * Convert a video to high-quality MP4 for TikTok-like platforms.
   * - Auto-detects orientation and preserves original aspect ratio
   * - Uses H.264 High profile with optimized quality settings
   * - Supports up to 4K resolution with smart downscaling
   */
  async convertToMP4(inputPath, outputPath, options = {}) {
    // Extract orientation and dimensions first
    const metadata = await this.getVideoMetadata(inputPath);
    const originalWidth = metadata.video.width;
    const originalHeight = metadata.video.height;
    const isPortrait = originalHeight > originalWidth;
    
    console.log(`📊 Original video: ${originalWidth}x${originalHeight} (${isPortrait ? 'Portrait' : 'Landscape'})`);
    
    // Smart resolution targeting based on original size and orientation
    let targetWidth, targetHeight;
    
    if (isPortrait) {
      // Portrait: prioritize height, common TikTok/Instagram formats
      if (originalHeight <= 720) {
        targetHeight = 720;
        targetWidth = Math.round((targetHeight * originalWidth) / originalHeight);
      } else if (originalHeight <= 1080) {
        targetHeight = 1080;
        targetWidth = Math.round((targetHeight * originalWidth) / originalHeight);
      } else {
        // For very high resolution, scale down to 1080p max
        targetHeight = 1080;
        targetWidth = Math.round((targetHeight * originalWidth) / originalHeight);
      }
    } else {
      // Landscape: prioritize width, common YouTube/TikTok landscape formats
      if (originalWidth <= 1280) {
        targetWidth = 1280;
        targetHeight = Math.round((targetWidth * originalHeight) / originalWidth);
      } else if (originalWidth <= 1920) {
        targetWidth = 1920;
        targetHeight = Math.round((targetWidth * originalHeight) / originalWidth);
      } else {
        // For 4K+, scale down to 1920p max
        targetWidth = 1920;
        targetHeight = Math.round((targetWidth * originalHeight) / originalWidth);
      }
    }
    
    // Ensure dimensions are even (required for some codecs)
    targetWidth = Math.round(targetWidth / 2) * 2;
    targetHeight = Math.round(targetHeight / 2) * 2;
    
    console.log(`🎯 Target resolution: ${targetWidth}x${targetHeight}`);
    
    // High-quality encoding options
    const opts = {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 16,                // Much higher quality (lower CRF = better quality)
      preset: 'slower',       // Better compression efficiency
      fps: Math.min(metadata.video.fps || 30, 60), // Preserve original FPS up to 60
      audioBitrate: '192k',   // Higher audio quality
      format: 'mp4',
      // Dynamic bitrate based on resolution
      maxRate: targetWidth >= 1920 ? '15M' : targetWidth >= 1280 ? '10M' : '6M',
      ...options,
    };
    
    // Scale filter that preserves aspect ratio without padding
    const scaleFilter = `scale=${targetWidth}:${targetHeight}`;
    
    console.log(`🎬 Encoding with CRF ${opts.crf}, max bitrate ${opts.maxRate}, preset ${opts.preset}`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec(opts.videoCodec)
        .audioCodec(opts.audioCodec)
        .outputOptions([
          `-profile:v high`,
          `-level 4.2`,          // Higher level for better quality/features
          `-pix_fmt yuv420p`,
          `-crf ${opts.crf}`,
          `-maxrate ${opts.maxRate}`,
          `-bufsize ${parseInt(opts.maxRate) * 2}M`,
          `-vf ${scaleFilter}`,  // No padding, just scale
          `-movflags +faststart`,
          `-preset ${opts.preset}`,
          `-tune film`,          // Optimize for high quality video content
        ])
        .audioBitrate(opts.audioBitrate)
        .fps(opts.fps)
        .format(opts.format)
        .on('start', cmd => console.log(`🚀 ${cmd}`))
        .on('progress', p => p.percent && console.log(`⏳ ${Math.round(p.percent)} %`))
        .on('end', () => {
          console.log(`✅ Converted: ${path.basename(outputPath)} (${targetWidth}x${targetHeight})`);
          resolve(outputPath);
        })
        .on('error', err => reject(new Error(`Conversion failed: ${err.message}`)))
        .save(outputPath);
    });
  }

  /**
   * Génère une miniature de la vidéo avec une qualité optimisée pour le web
   */
  async generateThumbnail(videoPath, thumbnailPath, timemarkSec = 1) {
    return new Promise((resolve, reject) => {
      console.log(`🖼️  Generating thumbnail: ${path.basename(videoPath)}`);
      
      // Assurer que le chemin de sortie a l'extension .jpg
      const outputPath = thumbnailPath.replace(/\.(png|jpeg|webp)$/i, '.jpg');
      
      ffmpeg(videoPath)
        .seekInput(timemarkSec)
        .frames(1)
        .outputOptions([
          '-vf scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2', // Maintient l'aspect ratio avec padding
          '-q:v 5',             // Meilleure qualité JPEG
          '-y'                  // Forcer l'overwrite
        ])
        .format('mjpeg')        // Format MJPEG pour JPEG
        .on('end', () => {
          console.log(`✅ Thumbnail generated: ${path.basename(outputPath)}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`❌ Thumbnail generation error:`, err.message);
          reject(new Error(`Thumbnail generation failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  /**
   * Obtient les métadonnées de la vidéo
   */
  async getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Metadata extraction failed: ${err.message}`));
        } else {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
          
          resolve({
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitrate: metadata.format.bit_rate,
            format: metadata.format.format_name,
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              fps: eval(videoStream.r_frame_rate) // Conversion de "30/1" en 30
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              bitrate: audioStream.bit_rate
            } : null
          });
        }
      });
    });
  }

  /**
   * Nettoie un fichier temporaire
   */
  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`🗑️  Fichier temporaire supprimé: ${path.basename(filePath)}`);
    } catch (error) {
      console.warn(`⚠️  Impossible de supprimer ${filePath}:`, error.message);
    }
  }

  /**
   * Nettoie plusieurs fichiers temporaires
   */
  async cleanupFiles(filePaths) {
    const cleanupPromises = filePaths.map(filePath => this.cleanupFile(filePath));
    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Génère un nom de fichier unique
   */
  generateTempFilename(originalName, suffix = '') {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    
    return `${baseName}_${timestamp}_${random}${suffix}${ext}`;
  }

  /**
   * Vérifie si le fichier est déjà en MP4 optimisé
   */
  async needsConversion(videoPath) {
    try {
      const metadata = await this.getVideoMetadata(videoPath);

      const isMP4 = metadata.format.includes('mp4');
      const isH264 = metadata.video && metadata.video.codec === 'h264';
      const hasAAC = metadata.audio && metadata.audio.codec === 'aac';
      
      // Support de résolutions plus élevées (jusqu'à 4K)
      const reasonableSize = metadata.video &&
        metadata.video.width <= 4096 &&
        metadata.video.height <= 4096;

      // Vérification de l'extension fichier
      const ext = path.extname(videoPath).toLowerCase();
      const isFileMP4 = ext === '.mp4';

      // Plus souple : on convertit seulement si vraiment nécessaire
      if (isMP4 && isH264 && reasonableSize && isFileMP4) {
        console.log(`✅ Video already optimized: ${path.basename(videoPath)} (${metadata.video.width}x${metadata.video.height})`);
        return false;
      }

      console.log(`🔄 Conversion nécessaire pour: ${path.basename(videoPath)}`);
      console.log(`   - Format: ${metadata.format} (MP4: ${isMP4})`);
      console.log(`   - Codec: ${metadata.video?.codec} (H264: ${isH264})`);
      console.log(`   - Audio: ${metadata.audio?.codec} (AAC: ${hasAAC})`);
      console.log(`   - Resolution: ${metadata.video?.width}x${metadata.video?.height}`);
      return true;
    } catch (error) {
      console.log(`🔄 Conversion nécessaire (métadonnées non lisibles): ${path.basename(videoPath)}`);
      return true; // En cas de doute, on convertit
    }
  }

}

module.exports = new VideoConverter();