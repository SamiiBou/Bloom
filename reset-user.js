#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('./tiktok-backend/src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tiktok-clone';

async function resetUserData() {
  console.log('🔄 [RESET] Starting user reset script...');
  
  try {
    // Connect to MongoDB
    console.log('📡 [RESET] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ [RESET] Connected to MongoDB');

    // Get username from command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.log('❌ [RESET] Usage: node reset-user.js <username>');
      console.log('   Example: node reset-user.js samiii');
      process.exit(1);
    }

    const username = args[0];
    console.log(`🔍 [RESET] Looking for user: ${username}`);

    // Find the user
    const user = await User.findOne({ username: username });
    if (!user) {
      console.log(`❌ [RESET] User "${username}" not found`);
      process.exit(1);
    }

    console.log(`✅ [RESET] User found: ${user.username}`);
    console.log(`📊 [RESET] Current data:`);
    console.log(`   - grabBalance: ${user.grabBalance || 0}`);
    console.log(`   - watchedVideos: ${user.watchedVideos?.length || 0}`);
    console.log(`   - claimsHistory: ${user.claimsHistory?.length || 0}`);

    // Reset the user data
    console.log('🧹 [RESET] Resetting user data...');
    
    const updateResult = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          grabBalance: 0,
          watchedVideos: [],
          claimsHistory: [],
          lastClaimTime: null
        },
        $unset: {
          claimPending: ''
        }
      },
      { new: true }
    );

    console.log('✅ [RESET] User data reset successfully!');
    console.log(`📊 [RESET] New data:`);
    console.log(`   - grabBalance: ${updateResult.grabBalance}`);
    console.log(`   - watchedVideos: ${updateResult.watchedVideos.length}`);
    console.log(`   - claimsHistory: ${updateResult.claimsHistory.length}`);
    console.log(`   - lastClaimTime: ${updateResult.lastClaimTime}`);
    console.log(`   - claimPending: ${updateResult.claimPending ? 'present' : 'cleared'}`);

  } catch (error) {
    console.error('❌ [RESET] Error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('📡 [RESET] Disconnected from MongoDB');
    process.exit(0);
  }
}

// Additional function to reset ALL users (dangerous!)
async function resetAllUsers() {
  console.log('🔄 [RESET-ALL] Starting GLOBAL reset script...');
  console.log('⚠️  [RESET-ALL] WARNING: This will reset ALL users!');
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ [RESET-ALL] Connected to MongoDB');

    const result = await User.updateMany(
      {},
      {
        $set: {
          grabBalance: 0,
          watchedVideos: [],
          claimsHistory: [],
          lastClaimTime: null
        },
        $unset: {
          claimPending: ''
        }
      }
    );

    console.log(`✅ [RESET-ALL] Reset completed for ${result.modifiedCount} users`);

  } catch (error) {
    console.error('❌ [RESET-ALL] Error:', error);
  } finally {
    await mongoose.disconnect();
    console.exit(0);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--all')) {
  console.log('⚠️  WARNING: You are about to reset ALL users!');
  console.log('   Type "yes" to confirm or anything else to cancel:');
  
  process.stdin.setEncoding('utf8');
  process.stdin.on('readable', () => {
    const chunk = process.stdin.read();
    if (chunk !== null) {
      const input = chunk.trim().toLowerCase();
      if (input === 'yes') {
        resetAllUsers();
      } else {
        console.log('❌ [RESET-ALL] Cancelled');
        process.exit(0);
      }
    }
  });
} else {
  resetUserData();
} 