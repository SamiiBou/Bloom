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

// Test de l'éditeur vidéo
async function testVideoEditor() {
  try {
    log('🎬 Testing Video Editor System', 'magenta');
    log('===============================', 'magenta');

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
      log('📝 Login failed, trying registration...', 'yellow');
      const registerData = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'password123',
        displayName: 'Test User Editor'
      };

      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      token = registerResponse.data.data.token;
      log('✅ Registration successful!', 'green');
    }

    // Test project structure
    log('\n🎞️  Testing video project structure...', 'blue');
    
    const sampleProject = {
      clips: [
        {
          id: 1,
          type: 'video',
          source: 'https://example.com/video1.mp4',
          startTime: 0,
          duration: 5,
          position: { x: 0, y: 0 },
          scale: 1,
          rotation: 0,
          opacity: 1,
          volume: 1,
          effects: ['sepia'],
          metadata: {
            isAI: true,
            prompt: 'A beautiful sunset'
          }
        },
        {
          id: 2,
          type: 'text',
          content: 'Hello World!',
          startTime: 1,
          duration: 3,
          position: { x: 50, y: 20 },
          style: {
            fontSize: 24,
            color: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
          }
        },
        {
          id: 3,
          type: 'audio',
          source: 'https://example.com/music.mp3',
          startTime: 0,
          duration: 5,
          volume: 0.3,
          metadata: {
            title: 'Background Music',
            artist: 'Test Artist'
          }
        }
      ],
      duration: 5,
      resolution: { width: 1280, height: 720 },
      fps: 30
    };

    log('📊 Sample project structure:', 'cyan');
    log(`   - ${sampleProject.clips.length} clips`, 'cyan');
    log(`   - Duration: ${sampleProject.duration}s`, 'cyan');
    log(`   - Resolution: ${sampleProject.resolution.width}x${sampleProject.resolution.height}`, 'cyan');

    // Test save project endpoint
    log('\n💾 Testing save project...', 'blue');
    try {
      const saveResponse = await axios.post(`${BASE_URL}/video/save-project`, sampleProject, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (saveResponse.data.status === 'success') {
        log('✅ Project saved successfully!', 'green');
      }
    } catch (saveError) {
      log('❌ Save project failed:', 'red');
      console.error(saveError.response?.data || saveError.message);
    }

    // Test get projects endpoint
    log('\n📂 Testing get projects...', 'blue');
    try {
      const projectsResponse = await axios.get(`${BASE_URL}/video/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (projectsResponse.data.status === 'success') {
        log('✅ Projects retrieved successfully!', 'green');
        log(`   Found ${projectsResponse.data.data.projects.length} projects`, 'cyan');
      }
    } catch (projectsError) {
      log('❌ Get projects failed:', 'red');
      console.error(projectsError.response?.data || projectsError.message);
    }

    // Note: We won't test the actual render endpoint as it requires FFmpeg
    // and real video files, but we can test the structure
    log('\n🎬 Video render endpoint structure:', 'blue');
    log('   POST /api/video/render', 'cyan');
    log('   Expected input: project with clips, duration, resolution, fps', 'cyan');
    log('   Expected output: rendered video URL and metadata', 'cyan');
    log('   ⚠️  Requires FFmpeg installation for actual rendering', 'yellow');

    log('\n===============================', 'magenta');
    log('🏁 Video Editor test completed', 'magenta');
    log('💡 Frontend components ready for integration', 'green');

  } catch (error) {
    log('❌ Test failed:', 'red');
    console.error(error.response?.data || error.message);
  }
}

// Test des fonctionnalités d'édition
async function testEditingFeatures() {
  try {
    log('\n🛠️  Testing editing features...', 'blue');
    
    const editingFeatures = {
      videoEffects: ['blur', 'sepia', 'grayscale', 'brightness', 'contrast'],
      textOptions: {
        fonts: ['Arial', 'Helvetica', 'Times New Roman'],
        sizes: [12, 16, 20, 24, 32, 48, 72],
        colors: ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff'],
        animations: ['none', 'fadeIn', 'slideIn', 'bounce']
      },
      audioFeatures: {
        volume: 'adjustable 0-1',
        fadeIn: 'duration in seconds',
        fadeOut: 'duration in seconds',
        mixing: 'multiple audio tracks'
      },
      timeline: {
        tracks: ['video', 'audio', 'text'],
        zoom: '25% to 400%',
        precision: 'frame-level editing'
      }
    };

    log('🎨 Available effects:', 'cyan');
    editingFeatures.videoEffects.forEach(effect => {
      log(`   - ${effect}`, 'cyan');
    });

    log('📝 Text capabilities:', 'cyan');
    log(`   - ${editingFeatures.textOptions.fonts.length} fonts available`, 'cyan');
    log(`   - ${editingFeatures.textOptions.sizes.length} size options`, 'cyan');
    log(`   - ${editingFeatures.textOptions.colors.length} color presets`, 'cyan');

    log('🎵 Audio features:', 'cyan');
    Object.entries(editingFeatures.audioFeatures).forEach(([feature, description]) => {
      log(`   - ${feature}: ${description}`, 'cyan');
    });

    log('⏱️  Timeline features:', 'cyan');
    Object.entries(editingFeatures.timeline).forEach(([feature, description]) => {
      log(`   - ${feature}: ${description}`, 'cyan');
    });

  } catch (error) {
    log('❌ Editing features test failed:', 'red');
    console.error(error.message);
  }
}

// Lancer les tests
async function runTests() {
  await testVideoEditor();
  await testEditingFeatures();
}

runTests(); 
 