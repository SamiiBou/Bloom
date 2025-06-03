#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('./src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tiktok-clone';

async function fixAllClaims() {
  try {
    console.log('🔧 FIXING ALL CLAIM PENDING ISSUES...');
    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // 1. Find all users with claimPending
    const usersWithPending = await User.find({ 
      claimPending: { $exists: true } 
    }).select('username claimPending grabBalance');
    
    console.log(`🔍 Found ${usersWithPending.length} users with claimPending`);
    
    usersWithPending.forEach(user => {
      console.log(`   - ${user.username}: grabBalance=${user.grabBalance}, pending=${!!user.claimPending}`);
    });
    
    // 2. Remove ALL claimPending from ALL users
    const result = await User.updateMany(
      {},
      { $unset: { claimPending: '' } }
    );
    
    console.log(`✅ Removed claimPending from ${result.modifiedCount} users`);
    
    // 3. Verify the fix
    const stillPending = await User.countDocuments({ 
      claimPending: { $exists: true } 
    });
    
    if (stillPending === 0) {
      console.log('🎉 SUCCESS: All claimPending removed!');
    } else {
      console.log(`⚠️  WARNING: ${stillPending} users still have claimPending`);
    }
    
    // 4. Show current state of samiii
    const samiii = await User.findOne({ username: 'samiii' })
      .select('username grabBalance claimPending watchedVideos');
    
    if (samiii) {
      console.log('\n📊 Current state of samiii:');
      console.log(`   - grabBalance: ${samiii.grabBalance}`);
      console.log(`   - claimPending: ${samiii.claimPending ? 'STILL EXISTS' : 'CLEARED'}`);
      console.log(`   - watchedVideos: ${samiii.watchedVideos?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

fixAllClaims(); 