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
    
    // Drop all problematic indexes
    const indexesToDrop = ['video_1', 'image_1', 'video_1_image_1_user_1_createdAt_1'];
    
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`Dropped ${indexName} index`);
      } catch (e) {
        console.log(`${indexName} index does not exist or already dropped`);
      }
    }
    
    // Clean up any invalid documents (with both video and image null)
    const result = await collection.deleteMany({ 
      $or: [
        { video: null, image: null },
        { video: { $exists: false }, image: { $exists: false }}
      ]
    });
    console.log('Cleaned up', result.deletedCount, 'invalid documents');
    
    // Create new sparse indexes with explicit names
    await collection.createIndex({ video: 1 }, { 
      sparse: true, 
      background: true,
      name: 'video_sparse_1'
    });
    console.log('Created sparse index on video');
    
    await collection.createIndex({ image: 1 }, { 
      sparse: true, 
      background: true,
      name: 'image_sparse_1'
    });
    console.log('Created sparse index on image');
    
    await collection.createIndex({ 
      video: 1, 
      image: 1, 
      user: 1, 
      createdAt: 1 
    }, { 
      sparse: true, 
      background: true,
      name: 'composite_sparse_1'
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