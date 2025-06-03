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

// Test de génération avec différentes durées
async function testDurations() {
  try {
    log('🚀 Testing AI Generation with Different Durations', 'magenta');
    log('================================================', 'magenta');

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
        displayName: 'Test User Duration'
      };

      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      token = registerResponse.data.data.token;
      log('✅ Registration successful!', 'green');
    }

    // Test 5 seconds video
    log('\n🎬 Testing 5-second video generation...', 'blue');
    const generation5s = {
      promptText: 'A peaceful mountain landscape with flowing clouds',
      model: 'gen4_turbo',
      duration: 5,
      ratio: '1280:720'
    };

    const response5s = await axios.post(`${BASE_URL}/ai/generate-video`, generation5s, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response5s.data.status === 'success') {
      log('✅ 5-second video generation started!', 'green');
      log(`   Task ID: ${response5s.data.data.taskId}`, 'blue');
      log(`   Duration: ${generation5s.duration}s`, 'blue');
      log(`   Expected cost: $0.25`, 'blue');
    }

    // Wait a bit before next test
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 10 seconds video
    log('\n🎬 Testing 10-second video generation...', 'blue');
    const generation10s = {
      promptText: 'A serene ocean sunset with gentle waves',
      model: 'gen4_turbo',
      duration: 10,
      ratio: '1280:720'
    };

    const response10s = await axios.post(`${BASE_URL}/ai/generate-video`, generation10s, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response10s.data.status === 'success') {
      log('✅ 10-second video generation started!', 'green');
      log(`   Task ID: ${response10s.data.data.taskId}`, 'blue');
      log(`   Duration: ${generation10s.duration}s`, 'blue');
      log(`   Expected cost: $0.50`, 'blue');
    }

    // Check status of both tasks
    log('\n📊 Checking task statuses...', 'yellow');
    
    const checkTask = async (taskId, duration) => {
      try {
        const statusResponse = await axios.get(`${BASE_URL}/ai/task/${taskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const task = statusResponse.data.data.task;
        log(`\n${duration}s video task:`, 'cyan');
        log(`   Status: ${task.status}`, 'blue');
        log(`   ID: ${task.id}`, 'blue');
        if (task.cost) {
          log(`   Actual cost: $${task.cost}`, 'blue');
        }
        
        return task;
      } catch (error) {
        log(`❌ Error checking ${duration}s task: ${error.message}`, 'red');
        return null;
      }
    };

    await checkTask(response5s.data.data.taskId, 5);
    await checkTask(response10s.data.data.taskId, 10);

    log('\n================================================', 'magenta');
    log('🏁 Duration test completed', 'magenta');
    log('💡 Check the tasks in a few minutes to see the final results', 'yellow');

  } catch (error) {
    log('❌ Test failed:', 'red');
    console.error(error.response?.data || error.message);
  }
}

// Lancer le test
testDurations(); 
 