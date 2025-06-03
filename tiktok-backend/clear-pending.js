#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('./src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tiktok-clone';

async function clearPending(username = 'samiii') {
  try {
    console.log(`🧹 Clearing pending claims for user: ${username}`);
    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const result = await User.findOneAndUpdate(
      { username: username },
      { $unset: { claimPending: '' } },
      { new: true }
    );

    if (result) {
      console.log(`✅ Cleared claimPending for ${username}`);
      console.log(`📊 Current state:`);
      console.log(`   - grabBalance: ${result.grabBalance}`);
      console.log(`   - claimPending: ${result.claimPending ? 'Still present' : 'Cleared'}`);
    } else {
      console.log(`❌ User ${username} not found`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

const username = process.argv[2] || 'samiii';
clearPending(username); 