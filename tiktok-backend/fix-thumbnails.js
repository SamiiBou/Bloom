require('dotenv').config();
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const path = require('path');

// Configuration AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

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
        // Générer une nouvelle clé S3 avec l'extension .jpg
        const oldKey = video.thumbnailKey;
        const newKey = oldKey.replace(/\.mp4$/, '.jpg');
        
        console.log(`   New key: ${newKey}`);

        // Copier l'objet S3 avec la nouvelle clé
        const copyParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          CopySource: `${process.env.AWS_S3_BUCKET_NAME}/${oldKey}`,
          Key: newKey,
          ContentType: 'image/jpeg',
          MetadataDirective: 'REPLACE'
        };

        console.log(`   📋 Copying S3 object...`);
        await s3.copyObject(copyParams).promise();

        // Supprimer l'ancien objet
        console.log(`   🗑️  Deleting old S3 object...`);
        await s3.deleteObject({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: oldKey
        }).promise();

        // Mettre à jour la base de données
        const newThumbnailUrl = video.thumbnailUrl.replace(/\.mp4$/, '.jpg');
        
        await Video.findByIdAndUpdate(video._id, {
          thumbnailUrl: newThumbnailUrl,
          thumbnailKey: newKey
        });

        console.log(`   ✅ Updated: ${newThumbnailUrl}`);

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