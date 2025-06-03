require('dotenv').config();
const mongoose = require('mongoose');

async function checkThumbnails() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Video = require('./src/models/Video');
    const User = require('./src/models/User');

    console.log('\n📹 Checking long videos thumbnails...');
    const videos = await Video.find({ type: 'long' })
      .populate('user', 'username')
      .select('title description thumbnailUrl videoUrl type user createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`Found ${videos.length} long videos:`);

    videos.forEach((video, index) => {
      console.log(`\n${index + 1}. Video ID: ${video._id}`);
      console.log(`   Title: ${video.title || 'No title'}`);
      console.log(`   Type: ${video.type}`);
      console.log(`   User: ${video.user?.username || 'Unknown'}`);
      console.log(`   VideoUrl: ${video.videoUrl ? 'Present' : 'Missing'}`);
      console.log(`   ThumbnailUrl: ${video.thumbnailUrl || 'MISSING'}`);
      console.log(`   HasThumbnail: ${!!video.thumbnailUrl}`);
      console.log(`   Created: ${video.createdAt}`);
    });

    // Compter les vidéos sans thumbnail
    const videosWithoutThumbnail = videos.filter(v => !v.thumbnailUrl);
    console.log(`\n❌ Videos without thumbnail: ${videosWithoutThumbnail.length}/${videos.length}`);

    if (videosWithoutThumbnail.length > 0) {
      console.log('\n📝 Videos missing thumbnails:');
      videosWithoutThumbnail.forEach(video => {
        console.log(`   - ${video._id} (${video.title || 'No title'})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkThumbnails(); 