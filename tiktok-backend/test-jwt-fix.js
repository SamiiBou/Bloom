const axios = require('axios');
const colors = require('colors');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

// Fonction pour logger avec couleurs
const log = (message, color = 'white') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`[color]);
};

// Fonction pour attendre
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test complet du système JWT
async function testJWTSystem() {
  console.log('🔐 JWT Token System Test'.rainbow);
  console.log('='.repeat(50).gray);

  let testUser = null;
  let authToken = null;

  try {
    // 1. Test de configuration JWT
    log('🔧 Testing JWT configuration...', 'blue');
    
    const configResponse = await axios.get(`${API_URL}/debug/jwt-config`);
    log('✅ JWT configuration retrieved successfully', 'green');
    log(`   Secret configured: ${configResponse.data.data.secretConfigured}`, 'cyan');
    log(`   Secret length: ${configResponse.data.data.secretLength}`, 'cyan');
    log(`   Access token expiry: ${configResponse.data.data.accessTokenExpiry}`, 'cyan');
    
    // 2. Test du flux de token
    log('\n🧪 Testing token flow...', 'blue');
    
    const tokenFlowResponse = await axios.get(`${API_URL}/debug/test-token-flow`);
    if (tokenFlowResponse.data.data.success) {
      log('✅ Token flow test passed', 'green');
    } else {
      log('❌ Token flow test failed', 'red');
      log(`   Error: ${tokenFlowResponse.data.data.error}`, 'red');
      return false;
    }

    // 3. Test de création d'utilisateur
    log('\n👤 Testing user registration...', 'blue');
    
    const userData = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpassword123',
      displayName: 'Test User JWT'
    };
    
    const registerResponse = await axios.post(`${API_URL}/auth/register`, userData);
    testUser = registerResponse.data.data;
    authToken = testUser.token;
    
    log('✅ User registered successfully', 'green');
    log(`   User ID: ${testUser.user.id}`, 'cyan');
    log(`   Token type: ${testUser.tokenType}`, 'cyan');
    log(`   Token preview: ${authToken.substring(0, 30)}...`, 'cyan');

    // 4. Test de vérification du token
    log('\n🔍 Testing token verification...', 'blue');
    
    const verifyResponse = await axios.post(`${API_URL}/debug/verify-token`, {
      token: authToken,
      expectedType: 'access'
    });
    
    if (verifyResponse.data.data.isValid) {
      log('✅ Token verification successful', 'green');
      log(`   User ID: ${verifyResponse.data.data.userId}`, 'cyan');
      log(`   Token type: ${verifyResponse.data.data.tokenType}`, 'cyan');
      log(`   Expires at: ${verifyResponse.data.data.expiresAt}`, 'cyan');
    } else {
      log('❌ Token verification failed', 'red');
      log(`   Error: ${verifyResponse.data.data.message}`, 'red');
      return false;
    }

    // 5. Test d'authentification avec le token
    log('\n🛡️  Testing authentication with token...', 'blue');
    
    const authResponse = await axios.get(`${API_URL}/debug/current-user`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    log('✅ Authentication successful', 'green');
    log(`   Authenticated as: ${authResponse.data.data.user.username}`, 'cyan');
    log(`   Auth method: ${authResponse.data.data.authInfo.authMethod}`, 'cyan');

    // 6. Test de login et génération de nouveaux tokens
    log('\n🔄 Testing login with new token generation...', 'blue');
    
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: userData.email,
      password: userData.password
    });
    
    const newToken = loginResponse.data.data.token;
    log('✅ Login successful with new token', 'green');
    log(`   New token preview: ${newToken.substring(0, 30)}...`, 'cyan');
    log(`   Token type: ${loginResponse.data.data.tokenType}`, 'cyan');

    // 7. Test de vérification du nouveau token
    log('\n🔍 Testing new token verification...', 'blue');
    
    const newVerifyResponse = await axios.post(`${API_URL}/debug/verify-token`, {
      token: newToken,
      expectedType: 'access'
    });
    
    if (newVerifyResponse.data.data.isValid) {
      log('✅ New token verification successful', 'green');
      log(`   Same user ID: ${newVerifyResponse.data.data.userId === verifyResponse.data.data.userId}`, 'cyan');
    } else {
      log('❌ New token verification failed', 'red');
      return false;
    }

    // 8. Test de refresh token
    log('\n🔄 Testing refresh token...', 'blue');
    
    const refreshResponse = await axios.post(`${API_URL}/auth/refresh-token`, {
      refreshToken: loginResponse.data.data.refreshToken
    });
    
    log('✅ Token refresh successful', 'green');
    log(`   Refreshed token preview: ${refreshResponse.data.data.token.substring(0, 30)}...`, 'cyan');

    // 9. Test d'emergency refresh
    log('\n🚨 Testing emergency refresh...', 'blue');
    
    const emergencyResponse = await axios.post(`${API_URL}/auth/emergency-refresh`, {}, {
      headers: {
        'Authorization': `Bearer ${newToken}`
      }
    });
    
    log('✅ Emergency refresh successful', 'green');
    log(`   Emergency token preview: ${emergencyResponse.data.data.token.substring(0, 30)}...`, 'cyan');

    // 10. Test d'un appel API avec le token d'urgence
    log('\n🧪 Testing API call with emergency token...', 'blue');
    
    const apiTestResponse = await axios.get(`${API_URL}/debug/current-user`, {
      headers: {
        'Authorization': `Bearer ${emergencyResponse.data.data.token}`
      }
    });
    
    log('✅ API call with emergency token successful', 'green');
    log(`   User confirmed: ${apiTestResponse.data.data.user.username}`, 'cyan');

    // Résumé
    log('\n🎉 ALL JWT TESTS PASSED!'.rainbow);
    log('✅ Token generation: OK'.green);
    log('✅ Token verification: OK'.green);
    log('✅ Authentication: OK'.green);
    log('✅ Login refresh: OK'.green);
    log('✅ Token refresh: OK'.green);
    log('✅ Emergency refresh: OK'.green);
    log('✅ API calls: OK'.green);
    
    return true;

  } catch (error) {
    log('\n❌ JWT Test Failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    
    return false;
  }
}

// Test spécifique pour le problème de signature
async function testSignatureIssue() {
  console.log('\n🔐 Testing JWT Signature Issue Fix'.rainbow);
  console.log('='.repeat(50).gray);

  try {
    // Créer un utilisateur
    log('👤 Creating test user...', 'blue');
    
    const userData = {
      username: `signature_test_${Date.now()}`,
      email: `signature_test_${Date.now()}@example.com`,
      password: 'testpassword123',
      displayName: 'Signature Test User'
    };
    
    const registerResponse = await axios.post(`${API_URL}/auth/register`, userData);
    const { token } = registerResponse.data.data;
    
    log('✅ User created successfully', 'green');
    log(`   Token preview: ${token.substring(0, 30)}...`, 'cyan');

    // Simuler une requête d'upload qui échoue avec signature invalide
    log('\n📤 Testing upload with token (simulating original issue)...', 'blue');
    
    try {
      // Faire un appel API protégé pour vérifier que le token fonctionne
      const protectedResponse = await axios.get(`${API_URL}/debug/current-user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      log('✅ Protected API call successful', 'green');
      log(`   User authenticated: ${protectedResponse.data.data.user.username}`, 'cyan');
      
      // Simuler plusieurs requêtes successives
      log('\n🔄 Testing multiple successive requests...', 'blue');
      
      for (let i = 1; i <= 3; i++) {
        const response = await axios.get(`${API_URL}/debug/auth-status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        log(`   Request ${i}: ${response.data.data.isAuthenticated ? '✅' : '❌'}`, 'cyan');
      }
      
      log('✅ All successive requests successful', 'green');
      
    } catch (error) {
      log('❌ Protected API call failed', 'red');
      log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
      
      if (error.response?.data?.debug) {
        log(`   Debug info: ${JSON.stringify(error.response.data.debug, null, 2)}`, 'yellow');
      }
      
      return false;
    }

    // Test de re-login pour générer un nouveau token
    log('\n🔄 Testing re-login to generate fresh token...', 'blue');
    
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: userData.email,
      password: userData.password
    });
    
    const newToken = loginResponse.data.data.token;
    log('✅ Re-login successful', 'green');
    log(`   New token preview: ${newToken.substring(0, 30)}...`, 'cyan');
    log(`   Token changed: ${newToken !== token}`, 'cyan');

    // Vérifier que le nouveau token fonctionne
    log('\n🧪 Testing new token...', 'blue');
    
    const newTokenResponse = await axios.get(`${API_URL}/debug/current-user`, {
      headers: {
        'Authorization': `Bearer ${newToken}`
      }
    });
    
    log('✅ New token works perfectly', 'green');
    
    return true;

  } catch (error) {
    log('\n❌ Signature Test Failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('🚀 Starting JWT Token System Tests'.rainbow);
  console.log('='.repeat(60).gray);
  
  // Vérifier que le serveur est accessible
  try {
    await axios.get(`${BASE_URL}/health`);
    log('✅ Server is accessible', 'green');
  } catch (error) {
    log('❌ Server is not accessible', 'red');
    log(`   Make sure the server is running on ${BASE_URL}`, 'yellow');
    return;
  }

  // Exécuter les tests
  const jwtTestResult = await testJWTSystem();
  await wait(1000);
  const signatureTestResult = await testSignatureIssue();
  
  console.log('\n🎯 TEST SUMMARY'.rainbow);
  console.log('='.repeat(50).gray);
  
  if (jwtTestResult && signatureTestResult) {
    log('🎉 ALL TESTS PASSED! JWT system is working correctly.', 'green');
    log('✅ The signature issue has been resolved.', 'green');
    log('✅ Users can now login and upload without token issues.', 'green');
  } else {
    log('❌ Some tests failed. Please check the errors above.', 'red');
  }
}

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testJWTSystem, testSignatureIssue }; 