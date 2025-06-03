const axios = require('axios');
const FormData = require('form-data');

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

// Test de connexion à l'API
async function testConnection() {
  try {
    log('🔍 Testing API connection...', 'blue');
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
    log('✅ API connection successful!', 'green');
    log(`   Status: ${response.data.status}`, 'blue');
    log(`   Environment: ${response.data.environment}`, 'blue');
    return true;
  } catch (error) {
    log('❌ API connection failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

// Test de login
async function testLogin() {
  try {
    log('🔐 Testing login...', 'blue');
    
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const response = await axios.post(`${BASE_URL}/auth/login`, loginData);
    
    if (response.data.status === 'success' && response.data.data.token) {
      log('✅ Login successful!', 'green');
      log(`   Token: ${response.data.data.token.substring(0, 20)}...`, 'blue');
      return response.data.data.token;
    } else {
      throw new Error('Invalid login response');
    }
  } catch (error) {
    log('❌ Login failed', 'red');
    log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
    
    // Try to register if login fails
    return await testRegister();
  }
}

// Test de registration
async function testRegister() {
  try {
    log('📝 Testing registration...', 'blue');
    
    const registerData = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'password123',
      displayName: 'Test User AI'
    };

    const response = await axios.post(`${BASE_URL}/auth/register`, registerData);
    
    if (response.data.status === 'success' && response.data.data.token) {
      log('✅ Registration successful!', 'green');
      log(`   Username: ${registerData.username}`, 'blue');
      log(`   Token: ${response.data.data.token.substring(0, 20)}...`, 'blue');
      return response.data.data.token;
    } else {
      throw new Error('Invalid registration response');
    }
  } catch (error) {
    log('❌ Registration failed', 'red');
    log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
    return null;
  }
}

// Test de configuration AI
async function testAIConfig() {
  try {
    log('⚙️ Testing AI configuration...', 'blue');
    
    const response = await axios.get(`${BASE_URL}/ai/config`);
    
    if (response.data.status === 'success') {
      log('✅ AI configuration retrieved!', 'green');
      log(`   Models: ${response.data.data.models.length}`, 'blue');
      log(`   Ratios: ${response.data.data.ratios.length}`, 'blue');
      log(`   Max prompt length: ${response.data.data.limits.promptMaxLength}`, 'blue');
      return response.data.data;
    } else {
      throw new Error('Invalid AI config response');
    }
  } catch (error) {
    log('❌ AI configuration failed', 'red');
    log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
    return null;
  }
}

// Test de génération AI
async function testAIGeneration(token) {
  try {
    log('🤖 Testing AI video generation...', 'blue');
    
    const generationData = {
      promptText: 'A beautiful sunset over a calm ocean with gentle waves',
      model: 'gen4_turbo',
      duration: 5,
      ratio: '1280:720'
    };

    const response = await axios.post(`${BASE_URL}/ai/generate-video`, generationData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.status === 'success') {
      log('✅ AI generation started!', 'green');
      log(`   Task ID: ${response.data.data.taskId}`, 'blue');
      log(`   Type: ${response.data.data.type}`, 'blue');
      log(`   Estimated time: ${response.data.data.estimatedTime}`, 'blue');
      return response.data.data.taskId;
    } else {
      throw new Error('Invalid AI generation response');
    }
  } catch (error) {
    log('❌ AI generation failed', 'red');
    log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
    
    // Check if it's a Runway API key issue
    if (error.response?.data?.message?.includes('Runway')) {
      log('💡 Tip: Make sure RUNWAYML_API_SECRET is set in your .env file', 'yellow');
      log('💡 Get your API key from: https://app.runwayml.com/', 'yellow');
    }
    
    return null;
  }
}

// Test de vérification du statut
async function testTaskStatus(token, taskId) {
  try {
    log(`📊 Testing task status for ${taskId}...`, 'blue');
    
    const response = await axios.get(`${BASE_URL}/ai/task/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.status === 'success') {
      const task = response.data.data.task;
      log('✅ Task status retrieved!', 'green');
      log(`   Status: ${task.status}`, 'blue');
      log(`   ID: ${task.id}`, 'blue');
      
      if (task.video) {
        log(`   Video created: ${task.video._id}`, 'green');
        log(`   Video URL: ${task.video.videoUrl}`, 'blue');
      }
      
      if (task.error) {
        log(`   Error: ${task.error.message}`, 'red');
      }
      
      if (task.cost) {
        log(`   Cost: $${task.cost}`, 'blue');
      }
      
      return task;
    } else {
      throw new Error('Invalid task status response');
    }
  } catch (error) {
    log('❌ Task status check failed', 'red');
    log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
    return null;
  }
}

// Test de polling du statut
async function pollTaskStatus(token, taskId, maxAttempts = 20) {
  log(`⏳ Polling task status (max ${maxAttempts} attempts)...`, 'yellow');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`   Attempt ${attempt}/${maxAttempts}...`, 'cyan');
    
    const task = await testTaskStatus(token, taskId);
    
    if (!task) {
      log('❌ Failed to get task status', 'red');
      return null;
    }
    
    if (['SUCCEEDED', 'FAILED'].includes(task.status)) {
      log(`✅ Task completed with status: ${task.status}`, 'green');
      return task;
    }
    
    if (attempt < maxAttempts) {
      log(`   Status: ${task.status}, waiting 10 seconds...`, 'yellow');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  log('⏰ Polling timeout reached', 'yellow');
  return null;
}

// Test du remboursement automatique des crédits
async function testCreditRefundOnFailure(token) {
  log('🧪 Test: Automatic credit refund on AI generation failure', 'magenta');

  // 1. Récupérer le solde initial
  let initialCredits = 0;
  try {
    const res = await axios.get(`${BASE_URL}/users/credits`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    initialCredits = res.data.data.credits;
    log(`   Initial credits: ${initialCredits}`, 'blue');
  } catch (e) {
    log('❌ Failed to fetch initial credits', 'red');
    return;
  }

  // 2. Lancer une génération AI avec un prompt qui va échouer (simulateur d'échec)
  const generationData = {
    promptText: 'FAIL_TEST_PROMPT_SHOULD_FAIL', // Ce prompt doit provoquer une erreur côté Runway (à adapter si besoin)
    model: 'gen4_turbo',
    duration: 5,
    ratio: '1280:720'
  };

  let taskId = null;
  try {
    const response = await axios.post(`${BASE_URL}/ai/generate-video`, generationData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.data.status === 'success') {
      taskId = response.data.data.taskId;
      log(`   Task ID: ${taskId}`, 'blue');
    } else {
      throw new Error('Invalid AI generation response');
    }
  } catch (error) {
    log('❌ AI generation request failed (expected if prompt triggers error)', 'yellow');
    // Si l'API refuse la génération, vérifier le solde tout de suite
    const res = await axios.get(`${BASE_URL}/users/credits`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const creditsAfter = res.data.data.credits;
    if (creditsAfter === initialCredits) {
      log('✅ Credits were not deducted on immediate failure', 'green');
    } else {
      log('❌ Credits were deducted on immediate failure', 'red');
    }
    return;
  }

  // 3. Poller le statut jusqu'à FAILED
  let finalTask = null;
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    finalTask = await testTaskStatus(token, taskId);
    if (finalTask && finalTask.status === 'FAILED') break;
  }
  if (!finalTask || finalTask.status !== 'FAILED') {
    log('❌ Task did not fail as expected', 'red');
    return;
  }
  log('   Task failed as expected', 'green');

  // 4. Vérifier le remboursement des crédits
  const res = await axios.get(`${BASE_URL}/users/credits`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const creditsAfter = res.data.data.credits;
  if (creditsAfter === initialCredits) {
    log('✅ Credits were refunded after failure', 'green');
  } else {
    log(`❌ Credits after failure: ${creditsAfter} (expected: ${initialCredits})`, 'red');
  }

  // 5. Vérifier le champ refunded sur la tâche (optionnel, nécessite endpoint admin ou accès DB)
  // (À implémenter si un endpoint existe)
}

// Fonction utilitaire pour créditer l'utilisateur de test (mode test uniquement)
async function addTestCredits(token, amount = 50) {
  log(`💳 Ajout de ${amount} crédits à l'utilisateur de test...`, 'cyan');
  try {
    // Utilisation du nouvel endpoint de test
    const res = await axios.post(`${BASE_URL}/users/add-test-credits`, {
      amount
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.data.success) {
      log(`✅ Crédit ajouté, nouveau solde: ${res.data.credits}`, 'green');
      return true;
    } else {
      log("❌ Échec de l'ajout de crédits via endpoint test", 'red');
      return false;
    }
  } catch (e) {
    log("❌ Erreur lors de l'ajout de crédits (endpoint test)", 'red');
    log(e.message, 'red');
    return false;
  }
}

// Test principal
async function runTests() {
  log('🚀 Starting AI Generation Tests', 'magenta');
  log('================================', 'magenta');
  
  // Test connection
  const connected = await testConnection();
  if (!connected) {
    log('❌ Cannot proceed without API connection', 'red');
    return;
  }
  
  // Test login/register
  const token = await testLogin();
  if (!token) {
    log('❌ Cannot proceed without authentication', 'red');
    return;
  }
  
  // Test AI config
  const config = await testAIConfig();
  if (!config) {
    log('⚠️ AI config test failed, but continuing...', 'yellow');
  }
  
  // Test AI generation
  const taskId = await testAIGeneration(token);
  if (!taskId) {
    log('❌ AI generation test failed', 'red');
    return;
  }
  
  // Poll for completion
  const finalTask = await pollTaskStatus(token, taskId);
  
  if (finalTask) {
    if (finalTask.status === 'SUCCEEDED') {
      log('🎉 AI video generation completed successfully!', 'green');
      if (finalTask.video) {
        log(`🎬 Video available at: ${finalTask.video.videoUrl}`, 'green');
      }
    } else {
      log('❌ AI video generation failed', 'red');
    }
  }
  
  log('================================', 'magenta');
  log('🏁 Tests completed', 'magenta');
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  log('❌ Unhandled Rejection at:', 'red');
  console.log(promise);
  log('Reason:', 'red');
  console.log(reason);
});

// Lancer les tests
if (require.main === module) {
  runTests().then(async () => {
    // Test de robustesse du remboursement
    const token = await testLogin();
    if (token) {
      // Ajout de crédits avant le test de remboursement
      await addTestCredits(token, 50);
      await testCreditRefundOnFailure(token);
    }
  }).catch(error => {
    log('❌ Test suite failed:', 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  testConnection,
  testLogin,
  testRegister,
  testAIConfig,
  testAIGeneration,
  testTaskStatus,
  pollTaskStatus,
  runTests
}; 
 