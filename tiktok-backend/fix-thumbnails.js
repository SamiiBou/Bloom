require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const { uploadToBunny, deleteFromBunny, bunnyConfig, downloadFromBunny } = require('./src/config/bunny');

async function fixThumbnails() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Video = require('./src/models/Video');
    const User = require('./src/models/User');

    console.log('\n📹 Finding videos with .mp4 thumbnails...');
    const videos = await Video.find({ 
      thumbnailUrl: { $regex: /\.mp4$/ },
      type: 'long'
    })
      .populate('user', 'username')
      .select('title thumbnailUrl thumbnailKey videoUrl type user createdAt');

    console.log(`Found ${videos.length} videos with .mp4 thumbnails:`);

    if (videos.length === 0) {
      console.log('✅ No videos with .mp4 thumbnails found!');
      process.exit(0);
    }

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      console.log(`\n${i + 1}. Processing video: ${video._id}`);
      console.log(`   Title: ${video.title}`);
      console.log(`   Current thumbnail: ${video.thumbnailUrl}`);
      console.log(`   Current key: ${video.thumbnailKey}`);

      try {
        // Générer une nouvelle clé Bunny CDN avec l'extension .jpg
        const oldKey = video.thumbnailKey;
        const newKey = oldKey.replace(/\.mp4$/, '.jpg');
        
        console.log(`   New key: ${newKey}`);

        // Télécharger l'ancien fichier depuis Bunny CDN
        console.log(`   📥 Downloading from Bunny CDN...`);
        const fileBuffer = await downloadFromBunny(oldKey);

        // Uploader avec la nouvelle clé
        console.log(`   📤 Uploading with new key...`);
        const newFileName = path.basename(newKey);
        const uploadResult = await uploadToBunny(fileBuffer, newFileName, 'thumbnails', 'image/jpeg');

        // Supprimer l'ancien fichier
        console.log(`   🗑️  Deleting old file...`);
        await deleteFromBunny(oldKey);

        // Mettre à jour la base de données
        await Video.findByIdAndUpdate(video._id, {
          thumbnailUrl: uploadResult.url,
          thumbnailKey: uploadResult.key
        });

        console.log(`   ✅ Updated: ${uploadResult.url}`);

      } catch (error) {
        console.error(`   ❌ Error processing video ${video._id}:`, error.message);
      }
    }

    console.log('\n🎉 Thumbnail fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixThumbnails(); 