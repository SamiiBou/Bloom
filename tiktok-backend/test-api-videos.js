require('dotenv').config();
const mongoose = require('mongoose');

async function testAPI() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Video = require('./src/models/Video');
    const User = require('./src/models/User');

    console.log('\n📹 Simulating API call for long videos...');
    
    // Simuler l'appel API comme dans la route /videos?type=long
    const filter = { 
      isPublic: true, 
      isActive: true,
      type: 'long'
    };

    const videos = await Video.find(filter)
      .populate('user', 'username displayName avatar verified')
      .sort({ createdAt: -1 })
      .limit(20);

    console.log(`Found ${videos.length} long videos:`);

    videos.forEach((video, index) => {
      console.log(`\n${index + 1}. Video API Response:`);
      console.log(`   ID: ${video._id}`);
      console.log(`   Title: ${video.title}`);
      console.log(`   Description: ${video.description?.substring(0, 50)}...`);
      console.log(`   Type: ${video.type}`);
      console.log(`   User: ${video.user?.username}`);
      console.log(`   VideoUrl: ${video.videoUrl ? 'Present' : 'Missing'}`);
      console.log(`   ThumbnailUrl: ${video.thumbnailUrl || 'MISSING'}`);
      console.log(`   ViewsCount: ${video.viewsCount}`);
      console.log(`   LikesCount: ${video.likesCount}`);
      console.log(`   CommentsCount: ${video.commentsCount}`);
      console.log(`   SharesCount: ${video.sharesCount}`);
      console.log(`   Created: ${video.createdAt}`);
    });

    // Simuler la transformation côté front-end
    console.log('\n🔄 Simulating front-end transformation...');
    const transformedVideos = videos.map(video => ({
      id: video._id,
      title: video.title || video.description?.substring(0, 50) + '...' || 'Vidéo sans titre',
      description: video.description || '',
      category: video.category || 'other',
      videoUrl: video.videoUrl,
      thumbnail: video.thumbnailUrl, // Utiliser directement thumbnailUrl
      duration: video.duration || '0:30',
      views: video.viewsCount || 0,
      likes: video.likesCount || 0,
      comments: video.commentsCount || 0,
      shares: video.sharesCount || 0,
      user: {
        username: video.user.username,
        avatar: video.user.avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
        verified: video.user.verified || false
      },
      uploadDate: new Date(video.createdAt).toLocaleDateString('fr-FR'),
      createdAt: video.createdAt,
      music: video.music,
      isLiked: video.isLiked || false,
      isFollowing: video.user.isFollowing || false
    }));

    console.log('\n📊 Transformed videos for front-end:');
    transformedVideos.forEach((video, index) => {
      console.log(`\n${index + 1}. Transformed Video:`);
      console.log(`   ID: ${video.id}`);
      console.log(`   Title: ${video.title}`);
      console.log(`   Thumbnail: ${video.thumbnail}`);
      console.log(`   HasThumbnail: ${!!video.thumbnail}`);
      console.log(`   User: ${video.user.username}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAPI(); 