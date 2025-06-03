#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// Test data - replace with valid user token if you have one
const TEST_DATA = {
  videoId: '507f1f77bcf86cd799439011', // Valid ObjectId format
  section: 'home',
  duration: 15
};

async function testTrackingSystem() {
  console.log('🔧 [DEBUG] Testing video tracking system...');
  console.log('🔧 [DEBUG] API Base URL:', API_BASE_URL);
  console.log('🔧 [DEBUG] Test Data:', TEST_DATA);

  try {
    // Test 1: Check if backend is running
    console.log('\n1️⃣ Testing backend health...');
    const healthResponse = await axios.get(`${API_BASE_URL}/../health`, { timeout: 5000 });
    console.log('✅ Backend is running:', healthResponse.data.status);

    // Test 2: Try to call track-watch without authentication (should fail with 401)
    console.log('\n2️⃣ Testing track-watch without authentication (should fail)...');
    try {
      await axios.post(`${API_BASE_URL}/videos/track-watch`, TEST_DATA);
      console.log('❌ Unexpected: Call succeeded without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Expected: 401 Unauthorized (auth required)');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    // Test 3: Get some basic info
    console.log('\n3️⃣ Testing public endpoints...');
    try {
      const videosResponse = await axios.get(`${API_BASE_URL}/videos?page=1&limit=1`);
      console.log('✅ Videos endpoint works:', videosResponse.data.data?.videos?.length || 0, 'videos found');
      
      if (videosResponse.data.data?.videos?.length > 0) {
        const sampleVideo = videosResponse.data.data.videos[0];
        console.log('📹 Sample video ID:', sampleVideo._id);
        console.log('📹 Sample video title:', sampleVideo.title || sampleVideo.description?.substring(0, 50));
        
        // Update test data with real video ID
        TEST_DATA.videoId = sampleVideo._id;
        console.log('🔄 Updated test data with real video ID:', TEST_DATA.videoId);
      }
    } catch (error) {
      console.log('❌ Videos endpoint error:', error.response?.status, error.response?.data);
    }

    console.log('\n🎯 [DEBUG] Test completed. To test with real authentication:');
    console.log('1. Open the frontend at http://localhost:5174');
    console.log('2. Login with wallet');
    console.log('3. Watch a video and check console logs');
    console.log('4. Or use the DEBUG button in RewardsHub page');

  } catch (error) {
    console.error('❌ [DEBUG] Test failed:', error.message);
  }
}

// Run the test
testTrackingSystem(); 