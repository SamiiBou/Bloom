require('dotenv').config();
const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { uploadToBunny, deleteFromBunny } = require('./src/config/bunny');

async function regenerateThumbnails() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Video = require('./src/models/Video');
    const User = require('./src/models/User');

    console.log('\n📹 Finding long videos with thumbnails...');
    const videos = await Video.find({ 
      type: 'long',
      thumbnailUrl: { $exists: true, $ne: '' }
    })
      .populate('user', 'username')
      .select('title thumbnailUrl thumbnailKey videoUrl type user createdAt')
      .limit(5); // Limiter à 5 pour le test

    console.log(`Found ${videos.length} videos with thumbnails:`);

    if (videos.length === 0) {
      console.log('✅ No videos found!');
      process.exit(0);
    }

    // Créer un dossier temporaire
    const tempDir = './temp';
    try {
      await fs.access(tempDir);
    } catch (error) {
      await fs.mkdir(tempDir, { recursive: true });
    }

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      console.log(`\n${i + 1}. Processing video: ${video._id}`);
      console.log(`   Title: ${video.title}`);
      console.log(`   Video URL: ${video.videoUrl}`);

      try {
        // Télécharger la vidéo temporairement
        const videoResponse = await fetch(video.videoUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        const tempVideoPath = path.join(tempDir, `temp_video_${video._id}.mp4`);
        await fs.writeFile(tempVideoPath, Buffer.from(videoBuffer));

        // Générer une nouvelle thumbnail optimisée
        const tempThumbnailPath = path.join(tempDir, `temp_thumb_${video._id}.jpg`);
        
        console.log(`   🖼️  Generating optimized thumbnail...`);
        await generateOptimizedThumbnail(tempVideoPath, tempThumbnailPath);

        // Upload vers Bunny CDN
        const newThumbnailFileName = `optimized_${Date.now()}_${video._id}.jpg`;
        console.log(`   🐰  Uploading to Bunny CDN...`);
        
        const fileContent = await fs.readFile(tempThumbnailPath);
        const uploadResult = await uploadToBunny(fileContent, newThumbnailFileName, 'thumbnails', 'image/jpeg');

        // Supprimer l'ancienne thumbnail de Bunny CDN
        if (video.thumbnailKey) {
          console.log(`   🗑️  Deleting old thumbnail...`);
          await deleteFromBunny(video.thumbnailKey);
        }

        // Mettre à jour la base de données
        await Video.findByIdAndUpdate(video._id, {
          thumbnailUrl: uploadResult.url,
          thumbnailKey: uploadResult.key
        });

        console.log(`   ✅ Updated with optimized thumbnail: ${uploadResult.url}`);

        // Nettoyer les fichiers temporaires
        await fs.unlink(tempVideoPath);
        await fs.unlink(tempThumbnailPath);

      } catch (error) {
        console.error(`   ❌ Error processing video ${video._id}:`, error.message);
      }
    }

    console.log('\n🎉 Thumbnail regeneration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function generateOptimizedThumbnail(videoPath, thumbnailPath, timemarkSec = 1) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timemarkSec)
      .frames(1)
      .outputOptions([
        '-vf scale=320:180', // Taille fixe 320x180 (16:9) pour les thumbnails
        '-q:v 8'             // Qualité JPEG optimisée (8 = bonne qualité, taille réduite)
      ])
      .format('image2')
      .output(thumbnailPath)
      .on('end', () => {
        console.log(`     ✅ Thumbnail generated: ${path.basename(thumbnailPath)}`);
        resolve(thumbnailPath);
      })
      .on('error', (err) => {
        console.error(`     ❌ Thumbnail generation error:`, err.message);
        reject(new Error(`Thumbnail generation failed: ${err.message}`));
      })
      .save(thumbnailPath);
  });
}

regenerateThumbnails(); 