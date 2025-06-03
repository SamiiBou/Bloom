#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('./src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tiktok-clone';

async function connectDB() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');
}

async function disconnectDB() {
  await mongoose.disconnect();
  console.log('📡 Disconnected from MongoDB');
}

// Reset specific user
async function resetUser(username) {
  console.log(`🔄 Resetting user: ${username}`);
  
  const user = await User.findOne({ username });
  if (!user) {
    console.log(`❌ User "${username}" not found`);
    return;
  }

  console.log(`📊 Before reset:`);
  console.log(`   - grabBalance: ${user.grabBalance || 0}`);
  console.log(`   - watchedVideos: ${user.watchedVideos?.length || 0}`);
  console.log(`   - claimsHistory: ${user.claimsHistory?.length || 0}`);

  const result = await User.findByIdAndUpdate(
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

  console.log(`✅ Reset completed!`);
  console.log(`📊 After reset:`);
  console.log(`   - grabBalance: ${result.grabBalance}`);
  console.log(`   - watchedVideos: ${result.watchedVideos.length}`);
  console.log(`   - claimsHistory: ${result.claimsHistory.length}`);
}

// Show user info
async function showUser(username) {
  console.log(`🔍 User info for: ${username}`);
  
  const user = await User.findOne({ username })
    .select('username displayName grabBalance watchedVideos claimsHistory lastClaimTime claimPending walletAddress');
  
  if (!user) {
    console.log(`❌ User "${username}" not found`);
    return;
  }

  console.log(`👤 User: ${user.username} (${user.displayName})`);
  console.log(`💰 grabBalance: ${user.grabBalance || 0}`);
  console.log(`📹 watchedVideos: ${user.watchedVideos?.length || 0}`);
  console.log(`🎁 claimsHistory: ${user.claimsHistory?.length || 0}`);
  console.log(`🕐 lastClaimTime: ${user.lastClaimTime || 'Never'}`);
  console.log(`⏳ claimPending: ${user.claimPending ? 'Yes' : 'No'}`);
  console.log(`💳 walletAddress: ${user.walletAddress || 'Not set'}`);

  if (user.watchedVideos?.length > 0) {
    console.log(`\n📹 Recently watched videos:`);
    user.watchedVideos.slice(-5).forEach((video, index) => {
      console.log(`   ${index + 1}. ${video.videoId} (${video.section}) - ${video.tokensEarned} tokens - ${video.watchedAt}`);
    });
  }

  if (user.claimsHistory?.length > 0) {
    console.log(`\n🎁 Recent claims:`);
    user.claimsHistory.slice(-3).forEach((claim, index) => {
      console.log(`   ${index + 1}. ${claim.amount} tokens - ${claim.at} - TX: ${claim.txHash?.substring(0, 10)}...`);
    });
  }
}

// Add tokens to user
async function addTokens(username, amount) {
  console.log(`💰 Adding ${amount} tokens to user: ${username}`);
  
  const user = await User.findOneAndUpdate(
    { username },
    { $inc: { grabBalance: parseFloat(amount) } },
    { new: true }
  );

  if (!user) {
    console.log(`❌ User "${username}" not found`);
    return;
  }

  console.log(`✅ Added ${amount} tokens`);
  console.log(`📊 New grabBalance: ${user.grabBalance}`);
}

// List all users
async function listUsers() {
  console.log(`👥 All users:`);
  
  const users = await User.find({})
    .select('username displayName grabBalance watchedVideos claimsHistory')
    .sort({ createdAt: -1 });

  if (users.length === 0) {
    console.log(`   No users found`);
    return;
  }

  users.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.username} - ${user.grabBalance || 0} tokens - ${user.watchedVideos?.length || 0} videos watched`);
  });
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`🛠️  User Management Script`);
    console.log(`Usage:`);
    console.log(`  node manage-users.js reset <username>     # Reset user data`);
    console.log(`  node manage-users.js show <username>      # Show user info`);
    console.log(`  node manage-users.js add <username> <amount> # Add tokens`);
    console.log(`  node manage-users.js list                 # List all users`);
    console.log(``);
    console.log(`Examples:`);
    console.log(`  node manage-users.js reset samiii`);
    console.log(`  node manage-users.js show samiii`);
    console.log(`  node manage-users.js add samiii 1.5`);
    console.log(`  node manage-users.js list`);
    process.exit(0);
  }

  const command = args[0];
  const username = args[1];
  const amount = args[2];

  try {
    await connectDB();

    switch (command) {
      case 'reset':
        if (!username) {
          console.log(`❌ Username required for reset`);
          process.exit(1);
        }
        await resetUser(username);
        break;

      case 'show':
        if (!username) {
          console.log(`❌ Username required for show`);
          process.exit(1);
        }
        await showUser(username);
        break;

      case 'add':
        if (!username || !amount) {
          console.log(`❌ Username and amount required for add`);
          process.exit(1);
        }
        await addTokens(username, amount);
        break;

      case 'list':
        await listUsers();
        break;

      default:
        console.log(`❌ Unknown command: ${command}`);
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

main(); 