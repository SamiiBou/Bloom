const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // URI MongoDB par défaut pour le développement local
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tiktok-clone';
    
    const conn = await mongoose.connect(mongoURI);

    console.log(`📊 MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB; 