const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('moderationresults');
    
    // List existing indexes
    console.log('Current indexes:');
    const indexes = await collection.listIndexes().toArray();
    indexes.forEach(index => console.log('  -', index.name, ':', JSON.stringify(index.key)));
    
    // Drop the problematic unique index on video if it exists
    try {
      await collection.dropIndex('video_1');
      console.log('Dropped video_1 index');
    } catch (e) {
      console.log('video_1 index does not exist or already dropped');
    }
    
    // Clean up any invalid documents (with both video and image null)
    const result = await collection.deleteMany({ 
      $or: [
        { video: null, image: null },
        { video: { $exists: false }, image: { $exists: false }}
      ]
    });
    console.log('Cleaned up', result.deletedCount, 'invalid documents');
    
    // Create new sparse indexes
    await collection.createIndex({ video: 1 }, { sparse: true, background: true });
    console.log('Created sparse index on video');
    
    await collection.createIndex({ image: 1 }, { sparse: true, background: true });
    console.log('Created sparse index on image');
    
    await collection.createIndex({ 
      video: 1, 
      image: 1, 
      user: 1, 
      createdAt: 1 
    }, { 
      sparse: true, 
      background: true 
    });
    console.log('Created composite sparse index');
    
    console.log('Database indexes fixed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    process.exit(1);
  }
}

fixIndexes(); 