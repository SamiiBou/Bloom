const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://d8a0e486e7eb.ngrok.app/api';

// Couleurs pour les logs
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test du nouveau flux de prévisualisation
async function testPreviewFlow() {
  try {
    log('🎬 Testing AI Video Preview Flow', 'magenta');
    log('==================================', 'magenta');

    // Login first
    log('🔐 Logging in...', 'blue');
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    let token;
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
      token = loginResponse.data.data.token;
      log('✅ Login successful!', 'green');
    } catch (error) {
      // Try to register if login fails
      log('📝 Login failed, trying registration...', 'yellow');
      const registerData = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'password123',
        displayName: 'Test User Preview'
      };

      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      token = registerResponse.data.data.token;
      log('✅ Registration successful!', 'green');
    }

    // Generate a video
    log('\n🎬 Starting AI video generation...', 'blue');
    const generation = {
      promptText: 'A beautiful sunset over a calm lake with mountains in the background',
      model: 'gen4_turbo',
      duration: 5,
      ratio: '1280:720'
    };

    const response = await axios.post(`${BASE_URL}/ai/generate-video`, generation, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.status === 'success') {
      const taskId = response.data.data.taskId;
      log('✅ Video generation started!', 'green');
      log(`   Task ID: ${taskId}`, 'blue');

      // Poll for completion
      log('\n⏳ Waiting for video generation to complete...', 'yellow');
      let attempts = 0;
      const maxAttempts = 60; // 3 minutes max

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        attempts++;

        try {
          const statusResponse = await axios.get(`${BASE_URL}/ai/task/${taskId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const task = statusResponse.data.data.task;
          log(`   Status: ${task.status} (attempt ${attempts}/${maxAttempts})`, 'cyan');
          
          if (task.status === 'SUCCEEDED') {
            log('✅ Video generation completed!', 'green');
            log(`   Video URL: ${task.videoUrl}`, 'blue');
            log(`   Publish Status: ${task.publishStatus}`, 'blue');
            
            // Test preview state
            if (task.publishStatus === 'DRAFT') {
              log('✅ Video is in DRAFT state - ready for preview!', 'green');
              
              // Test publish endpoint
              log('\n📤 Testing publish endpoint...', 'blue');
              const publishResponse = await axios.post(`${BASE_URL}/ai/task/${taskId}/publish`, {
                description: 'Test video published after preview',
                hashtags: ['test', 'preview', 'ai', 'generated']
              }, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (publishResponse.data.status === 'success') {
                log('✅ Video published successfully!', 'green');
                log(`   Video ID: ${publishResponse.data.data.video._id}`, 'blue');
                log(`   Published Status: ${publishResponse.data.data.task.publishStatus}`, 'blue');
              } else {
                log('❌ Failed to publish video', 'red');
              }
            } else {
              log('⚠️  Video is not in DRAFT state', 'yellow');
            }
            
            break;
          } else if (task.status === 'FAILED') {
            log('❌ Video generation failed', 'red');
            if (task.error) {
              log(`   Error: ${task.error}`, 'red');
            }
            break;
          }
        } catch (statusError) {
          log(`❌ Error checking status: ${statusError.message}`, 'red');
          break;
        }
      }

      if (attempts >= maxAttempts) {
        log('⏰ Timeout waiting for video generation', 'yellow');
      }

    } else {
      log('❌ Failed to start video generation', 'red');
      console.log(response.data);
    }

    log('\n==================================', 'magenta');
    log('🏁 Preview flow test completed', 'magenta');

  } catch (error) {
    log('❌ Test failed:', 'red');
    console.error(error.response?.data || error.message);
  }
}

// Test rejection flow
async function testRejectFlow() {
  try {
    log('\n🗑️  Testing video rejection flow...', 'blue');
    
    // This would be called with a taskId from a previous generation
    // For now, just show the structure
    log('   Structure: POST /api/ai/task/:taskId/reject', 'cyan');
    log('   Expected: Video marked as REJECTED', 'cyan');
    
  } catch (error) {
    log('❌ Reject test failed:', 'red');
    console.error(error.message);
  }
}

// Run tests
async function runTests() {
  await testPreviewFlow();
  await testRejectFlow();
}

runTests(); 
 