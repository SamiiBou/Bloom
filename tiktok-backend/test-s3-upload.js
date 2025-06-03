const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://d8a0e486e7eb.ngrok.app';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Create a test video file
function createTestVideoFile() {
  const testVideoPath = path.join(__dirname, 'test-video.mp4');
  
  // Create a more complete MP4 file header that will be recognized as video/mp4
  const mp4Header = Buffer.from([
    // ftyp box
    0x00, 0x00, 0x00, 0x20, // box size
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6F, 0x6D, // major brand 'isom'
    0x00, 0x00, 0x02, 0x00, // minor version
    0x69, 0x73, 0x6F, 0x6D, // compatible brand 'isom'
    0x69, 0x73, 0x6F, 0x32, // compatible brand 'iso2'
    0x61, 0x76, 0x63, 0x31, // compatible brand 'avc1'
    0x6D, 0x70, 0x34, 0x31, // compatible brand 'mp41'
    
    // mdat box (minimal)
    0x00, 0x00, 0x00, 0x08, // box size
    0x6D, 0x64, 0x61, 0x74  // 'mdat'
  ]);
  
  fs.writeFileSync(testVideoPath, mp4Header);
  return testVideoPath;
}

// Create a test image file for thumbnail
function createTestImageFile() {
  const testImagePath = path.join(__dirname, 'test-thumbnail.jpg');
  
  // Create a minimal JPEG file header
  const jpegHeader = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
  ]);
  
  fs.writeFileSync(testImagePath, jpegHeader);
  return testImagePath;
}

// Test user registration and login
async function createTestUser() {
  try {
    const userData = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpassword123',
      displayName: 'Test User'
    };
    
    // Register user
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, userData);
    log('✅ Test user created successfully', 'green');
    
    // Login to get token
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: userData.email,
      password: userData.password
    });
    
    const token = loginResponse.data.data.token;
    log('✅ Test user logged in successfully', 'green');
    log(`   Token: ${token.substring(0, 20)}...`, 'blue');
    
    return { token, user: userData };
  } catch (error) {
    log('❌ Failed to create test user', 'red');
    log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
    return null;
  }
}

// Test video upload to S3
async function testVideoUpload(token) {
  try {
    const videoPath = path.join(__dirname, 'file.mp4'); 
    const thumbnailPath = createTestImageFile();
    
    const formData = new FormData();
    
    // Force the MIME type for testing
    formData.append('video', fs.createReadStream(videoPath), {
      filename: 'file.mp4', 
      contentType: 'video/mp4'
    });
    formData.append('thumbnail', fs.createReadStream(thumbnailPath), {
      filename: 'test-thumbnail.jpg',
      contentType: 'image/jpeg'
    });
    formData.append('description', 'Test video upload to S3');
    formData.append('music', JSON.stringify({ title: 'Test Music', artist: 'Test Artist' }));
    
    const response = await axios.post(`${BASE_URL}/api/upload/video`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    log('✅ Video uploaded to S3 successfully!', 'green');
    log(`   Video URL: ${response.data.data.video.videoUrl}`, 'blue');
    log(`   Thumbnail URL: ${response.data.data.video.thumbnailUrl}`, 'blue');
    log(`   Video ID: ${response.data.data.video._id}`, 'blue');
    
    // Clean up test files
    fs.unlinkSync(thumbnailPath); 
    
    return response.data.data.video;
  } catch (error) {
    log('❌ Video upload failed', 'red');
    log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
    
    // Clean up generated test files even on error
    try {
      fs.unlinkSync(path.join(__dirname, 'test-thumbnail.jpg')); 
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return null;
  }
}

// Test video retrieval
async function testVideoRetrieval() {
  try {
    const response = await axios.get(`${BASE_URL}/api/videos`);
    log('✅ Video retrieval successful', 'green');
    log(`   Found ${response.data.data.videos.length} videos`, 'blue');
    
    if (response.data.data.videos.length > 0) {
      const firstVideo = response.data.data.videos[0];
      log(`   Latest video: ${firstVideo.description}`, 'blue');
      log(`   Video URL: ${firstVideo.videoUrl}`, 'blue');
    }
    
    return response.data.data.videos;
  } catch (error) {
    log('❌ Video retrieval failed', 'red');
    log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
    return null;
  }
}

// Test S3 URL accessibility
async function testS3URLAccessibility(videoUrl) {
  try {
    const response = await axios.head(videoUrl);
    log('✅ S3 video URL is accessible', 'green');
    log(`   Content-Type: ${response.headers['content-type']}`, 'blue');
    log(`   Content-Length: ${response.headers['content-length']} bytes`, 'blue');
    return true;
  } catch (error) {
    log('❌ S3 video URL is not accessible', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

// Main test runner for S3 upload
async function runS3UploadTests() {
  log('\n🧪 Starting S3 Upload Tests...', 'blue');
  log('=' .repeat(50), 'blue');
  
  // Step 1: Create test user
  log('\n🔍 Step 1: Creating test user...', 'yellow');
  const userResult = await createTestUser();
  if (!userResult) {
    log('❌ Cannot proceed without test user', 'red');
    return;
  }
  
  // Step 2: Test video upload
  log('\n🔍 Step 2: Testing video upload to S3...', 'yellow');
  const uploadedVideo = await testVideoUpload(userResult.token);
  if (!uploadedVideo) {
    log('❌ Video upload failed', 'red');
    return;
  }
  
  // Step 3: Test video retrieval
  log('\n🔍 Step 3: Testing video retrieval...', 'yellow');
  const videos = await testVideoRetrieval();
  
  // Step 4: Test S3 URL accessibility
  if (uploadedVideo.videoUrl) {
    log('\n🔍 Step 4: Testing S3 URL accessibility...', 'yellow');
    await testS3URLAccessibility(uploadedVideo.videoUrl);
  }
  
  log('\n🎉 S3 Upload tests completed!', 'green');
}

// Run tests if this file is executed directly
if (require.main === module) {
  require('dotenv').config();
  runS3UploadTests().catch(console.error);
}

module.exports = { runS3UploadTests }; 