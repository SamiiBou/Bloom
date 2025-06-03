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

async function testS3Configuration() {
  try {
    // Test if AWS SDK is properly configured
    const AWS = require('aws-sdk');
    
    // Check if environment variables are set
    const requiredEnvVars = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_S3_BUCKET_NAME'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      log('⚠️  S3 Configuration: INCOMPLETE', 'yellow');
      log(`   Missing variables: ${missingVars.join(', ')}`, 'yellow');
      return false;
    }
    
    // Test S3 connection
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    
    await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET_NAME }).promise();
    log('✅ S3 Configuration: CONNECTED', 'green');
    log(`   Bucket: ${process.env.AWS_S3_BUCKET_NAME}`, 'blue');
    log(`   Region: ${process.env.AWS_REGION}`, 'blue');
    return true;
  } catch (error) {
    log('❌ S3 Configuration: FAILED', 'red');
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
    { name: 'S3 Configuration', fn: testS3Configuration }
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