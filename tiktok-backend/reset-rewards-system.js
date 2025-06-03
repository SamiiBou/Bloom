const mongoose = require('mongoose');
const User = require('./src/models/User');

async function resetRewardsSystem() {
  try {
    await mongoose.connect('mongodb://localhost:27017/tiktok-clone');
    console.log('🔗 Connected to MongoDB');
    
    console.log('\n🧹 RESETTING REWARDS SYSTEM...\n');
    
    // 1. Show current status for the main user
    const userBefore = await User.findOne({ username: 'samiii' })
      .select('username grabBalance watchedVideos claimsHistory lastClaimTime claimPending');
    
    if (userBefore) {
      console.log('📊 STATUS BEFORE RESET:');
      console.log('- Username:', userBefore.username);
      console.log('- grabBalance:', userBefore.grabBalance);
      console.log('- Videos watched:', userBefore.watchedVideos?.length || 0);
      console.log('- Total tokens from videos:', userBefore.watchedVideos?.reduce((t, w) => t + w.tokensEarned, 0) || 0);
      console.log('- Claims made:', userBefore.claimsHistory?.length || 0);
      console.log('- Total tokens claimed:', userBefore.claimsHistory?.reduce((t, c) => t + c.amount, 0) || 0);
      console.log('- Has claimPending:', !!userBefore.claimPending);
      console.log('- Last claim time:', userBefore.lastClaimTime);
    } else {
      console.log('❌ User "samiii" not found');
      return;
    }
    
    console.log('\n🔄 RESETTING...\n');
    
    // 2. Reset EVERYTHING for the main user
    const resetResult = await User.updateOne(
      { username: 'samiii' },
      {
        $set: {
          grabBalance: 0,
          watchedVideos: [],
          claimsHistory: [],
          lastClaimTime: null
        },
        $unset: {
          claimPending: 1
        }
      }
    );
    
    console.log('✅ Main user reset result:', resetResult);
    
    // 3. Optional: Reset ALL users (uncomment if needed)
    /*
    console.log('\n🌍 RESETTING ALL USERS...');
    const globalResetResult = await User.updateMany(
      {},
      {
        $set: {
          grabBalance: 0,
          watchedVideos: [],
          claimsHistory: [],
          lastClaimTime: null
        },
        $unset: {
          claimPending: 1
        }
      }
    );
    console.log('✅ Global reset result:', globalResetResult);
    */
    
    // 4. Show status after reset
    const userAfter = await User.findOne({ username: 'samiii' })
      .select('username grabBalance watchedVideos claimsHistory lastClaimTime claimPending');
    
    console.log('\n📊 STATUS AFTER RESET:');
    console.log('- Username:', userAfter.username);
    console.log('- grabBalance:', userAfter.grabBalance);
    console.log('- Videos watched:', userAfter.watchedVideos?.length || 0);
    console.log('- Total tokens from videos:', userAfter.watchedVideos?.reduce((t, w) => t + w.tokensEarned, 0) || 0);
    console.log('- Claims made:', userAfter.claimsHistory?.length || 0);
    console.log('- Total tokens claimed:', userAfter.claimsHistory?.reduce((t, c) => t + c.amount, 0) || 0);
    console.log('- Has claimPending:', !!userAfter.claimPending);
    console.log('- Last claim time:', userAfter.lastClaimTime);
    
    console.log('\n🎉 REWARDS SYSTEM COMPLETELY RESET!');
    console.log('\n🔄 Now you can:');
    console.log('1. Go to the app');
    console.log('2. Watch videos to earn tokens');
    console.log('3. Test the grab functionality');
    console.log('4. Everything starts fresh from 0!');
    
  } catch (error) {
    console.error('❌ Error during reset:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the reset
resetRewardsSystem(); 