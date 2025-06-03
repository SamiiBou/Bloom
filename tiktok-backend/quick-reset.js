#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

// Simple User schema for this script
const userSchema = new mongoose.Schema({
  username: String,
  grabBalance: { type: Number, default: 0 },
  watchedVideos: Array,
  claimsHistory: Array,
  lastClaimTime: Date,
  claimPending: Object
});

const User = mongoose.model('User', userSchema);

async function quickReset(username = 'samiii') {
  try {
    console.log(`🔄 Quick reset for user: ${username}`);
    
    // Use the MONGO_URI from your .env file
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/tiktok-clone';
    await mongoose.connect(mongoUri);
    
    const result = await User.findOneAndUpdate(
      { username: username },
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

    if (result) {
      console.log(`✅ Reset completed for ${username}`);
      console.log(`📊 grabBalance: ${result.grabBalance}`);
      console.log(`📊 watchedVideos: ${result.watchedVideos.length}`);
    } else {
      console.log(`❌ User ${username} not found`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Get username from command line or use default
const username = process.argv[2] || 'samiii';
quickReset(username); 