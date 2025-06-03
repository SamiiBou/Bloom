require('dotenv').config();
const mongoose = require('mongoose');

// Import all models to register them
const User = require('./src/models/User');
const Video = require('./src/models/Video');
const AITask = require('./src/models/AITask');

async function checkVideos() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tiktok-clone');
    console.log('✅ Connected to MongoDB');

    // Check AI tasks
    console.log('\n📊 Recent AI Tasks:');
    const aiTasks = await AITask.find()
      .sort({ createdAt: -1 })
      .limit(5);

    aiTasks.forEach((task, index) => {
      console.log(`${index + 1}. Task ID: ${task.runwayTaskId}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Prompt: ${task.promptText.substring(0, 50)}...`);
      console.log(`   Created: ${task.createdAt}`);
      if (task.resultVideoUrl) {
        console.log(`   Runway Video URL: ${task.resultVideoUrl}`);
      }
      if (task.video) {
        console.log(`   Video DB ID: ${task.video}`);
      }
      console.log('   ---');
    });

    // Check videos
    console.log('\n🎬 Recent Videos:');
    const videos = await Video.find()
      .populate('user', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(5);

    videos.forEach((video, index) => {
      console.log(`${index + 1}. Video ID: ${video._id}`);
      console.log(`   User: ${video.user?.username || 'Unknown'}`);
      console.log(`   Description: ${video.description}`);
      console.log(`   Video URL: ${video.videoUrl}`);
      console.log(`   Likes: ${video.likes?.length || 0}`);
      console.log(`   Created: ${video.createdAt}`);
      console.log('   ---');
    });

    // Check if AI videos are linked correctly
    console.log('\n🔗 Checking AI Task -> Video Links:');
    const aiTasksWithVideos = await AITask.find({ video: { $exists: true } })
      .populate('video')
      .sort({ createdAt: -1 })
      .limit(3);

    aiTasksWithVideos.forEach((task, index) => {
      console.log(`${index + 1}. AI Task: ${task.runwayTaskId}`);
      console.log(`   Status: ${task.status}`);
      if (task.video) {
        console.log(`   ✅ Linked Video: ${task.video._id}`);
        console.log(`   Video URL: ${task.video.videoUrl}`);
        console.log(`   Video Description: ${task.video.description}`);
      } else {
        console.log(`   ❌ No linked video`);
      }
      console.log('   ---');
    });

    await mongoose.connection.close();
    console.log('\n✅ Database check completed');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkVideos(); 
 