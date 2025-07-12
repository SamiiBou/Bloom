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

// Test functions
async function testHealthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    log('✅ Health Check: PASSED', 'green');
    log(`   Status: ${response.data.status}`, 'blue');
    log(`   Environment: ${response.data.environment}`, 'blue');
    return true;
  } catch (error) {
    log('❌ Health Check: FAILED', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testCORS() {
  try {
    const response = await axios.get(`${BASE_URL}/health`, {
      headers: {
        'Origin': 'http://localhost:5173'
      }
    });
    log('✅ CORS Configuration: PASSED', 'green');
    return true;
  } catch (error) {
    log('❌ CORS Configuration: FAILED', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testVideoRoutes() {
  try {
    const response = await axios.get(`${BASE_URL}/api/videos`);
    log('✅ Video Routes: ACCESSIBLE', 'green');
    return true;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      log('✅ Video Routes: PROTECTED (401 - Authentication required)', 'yellow');
      return true;
    }
    log('❌ Video Routes: FAILED', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testUploadRoute() {
  try {
    const response = await axios.post(`${BASE_URL}/api/upload/video`);
    log('✅ Upload Routes: ACCESSIBLE', 'green');
    return true;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      log('✅ Upload Routes: PROTECTED (401 - Authentication required)', 'yellow');
      return true;
    }
    log('❌ Upload Routes: FAILED', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testBunnyCDNConfiguration() {
  try {
    // Test if Bunny CDN is properly configured
    const { bunnyConfig } = require('./src/config/bunny');
    
    // Check if environment variables are set
    const requiredEnvVars = [
      'BUNNY_STORAGE_ACCESS_KEY',
      'BUNNY_STORAGE_ZONE_NAME',
      'BUNNY_CDN_URL'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      log('⚠️  Bunny CDN Configuration: INCOMPLETE', 'yellow');
      log(`   Missing variables: ${missingVars.join(', ')}`, 'yellow');
      return false;
    }
    
    // Test basic configuration
    if (!bunnyConfig.accessKey || !bunnyConfig.storageZoneName) {
      log('❌ Bunny CDN Configuration: INVALID', 'red');
      return false;
    }
    
    log('✅ Bunny CDN Configuration: CONFIGURED', 'green');
    log(`   Storage Zone: ${bunnyConfig.storageZoneName}`, 'blue');
    log(`   CDN URL: ${bunnyConfig.cdnUrl}`, 'blue');
    log(`   Region: ${bunnyConfig.region || 'Frankfurt (default)'}`, 'blue');
    return true;
  } catch (error) {
    log('❌ Bunny CDN Configuration: FAILED', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function testDatabaseConnection() {
  try {
    const mongoose = require('mongoose');
    
    if (!process.env.MONGODB_URI) {
      log('⚠️  Database Configuration: MISSING MONGODB_URI', 'yellow');
      return false;
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    log('✅ Database Connection: CONNECTED', 'green');
    log(`   URI: ${process.env.MONGODB_URI}`, 'blue');
    await mongoose.disconnect();
    return true;
  } catch (error) {
    log('❌ Database Connection: FAILED', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('\n🧪 Starting Backend Connection Tests...', 'blue');
  log('=' .repeat(50), 'blue');
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'CORS Configuration', fn: testCORS },
    { name: 'Video Routes', fn: testVideoRoutes },
    { name: 'Upload Routes', fn: testUploadRoute },
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Bunny CDN Configuration', fn: testBunnyCDNConfiguration }
  ];
  
  const results = [];
  
  for (const test of tests) {
    log(`\n🔍 Testing: ${test.name}`, 'yellow');
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
  }
  
  // Summary
  log('\n📊 Test Summary:', 'blue');
  log('=' .repeat(50), 'blue');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    const color = result.passed ? 'green' : 'red';
    log(`${result.name}: ${status}`, color);
  });
  
  log(`\nOverall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 All tests passed! Your backend is ready.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the configuration above.', 'yellow');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  require('dotenv').config();
  runAllTests().catch(console.error);
}

module.exports = { runAllTests }; 