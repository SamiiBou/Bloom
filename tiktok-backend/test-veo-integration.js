const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3001/api';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'password123';

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class VeoIntegrationTest {
  constructor() {
    this.authToken = null;
    this.testTaskId = null;
  }

  async run() {
    try {
      log('🧪 Test d\'intégration Veo - Début', 'cyan');
      log('=' .repeat(50), 'cyan');

      // 1. Test de connexion API
      await this.testAPIConnection();

      // 2. Test d'authentification
      await this.testAuthentication();

      // 3. Test de configuration Veo
      await this.testVeoConfiguration();

      // 4. Test de génération text-to-video
      await this.testTextToVideoGeneration();

      // 5. Test de vérification du statut
      if (this.testTaskId) {
        await this.testTaskStatusCheck();
      }

      // 6. Test de génération image-to-video (optionnel)
      await this.testImageToVideoGeneration();

      log('=' .repeat(50), 'green');
      log('✅ Tous les tests d\'intégration Veo sont passés !', 'green');

    } catch (error) {
      log('=' .repeat(50), 'red');
      log(`❌ Erreur dans les tests: ${error.message}`, 'red');
      if (error.response?.data) {
        log(`Détails: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
      }
      process.exit(1);
    }
  }

  async testAPIConnection() {
    log('🔌 Test de connexion à l\'API...', 'blue');
    
    try {
      const response = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
      log(`   Status: ${response.status}`, 'green');
      log(`   Environment: ${response.data.environment}`, 'blue');
      log(`   Database: ${response.data.database}`, 'blue');
      log('✅ Connexion API réussie', 'green');
    } catch (error) {
      throw new Error(`Connexion API échouée: ${error.message}`);
    }
  }

  async testAuthentication() {
    log('🔐 Test d\'authentification...', 'blue');
    
    try {
      // Essayer de se connecter avec un utilisateur existant
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      });

      this.authToken = loginResponse.data.data.token;
      log('✅ Authentification réussie', 'green');
      
    } catch (error) {
      if (error.response?.status === 401) {
        log('⚠️  Utilisateur de test non trouvé, création...', 'yellow');
        
        // Créer un utilisateur de test
        const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
          username: 'testuser',
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD
        });

        this.authToken = registerResponse.data.data.token;
        log('✅ Utilisateur créé et authentifié', 'green');
      } else {
        throw new Error(`Authentification échouée: ${error.message}`);
      }
    }
  }

  async testVeoConfiguration() {
    log('⚙️  Test de configuration Veo...', 'blue');
    
    try {
      const response = await axios.get(`${BASE_URL}/ai/veo/config`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      log(`   Modèles disponibles: ${response.data.data.models.length}`, 'blue');
      response.data.data.models.forEach(model => {
        log(`   - ${model.name} (${model.id})`, 'blue');
      });
      
      log(`   Formats supportés: ${response.data.data.aspectRatios.length}`, 'blue');
      log('✅ Configuration Veo valide', 'green');
      
    } catch (error) {
      if (error.response?.status === 500) {
        log('❌ Configuration Google Cloud manquante', 'red');
        log('💡 Consultez SETUP_VEO.md pour la configuration', 'yellow');
      }
      throw new Error(`Configuration Veo échouée: ${error.message}`);
    }
  }

  async testTextToVideoGeneration() {
    log('🎬 Test de génération text-to-video...', 'blue');
    
    const testPrompt = "A beautiful sunset over a calm ocean with gentle waves";
    
    try {
      const response = await axios.post(`${BASE_URL}/ai/veo/generate-video`, {
        promptText: testPrompt,
        model: 'veo-3.0-generate-preview',
        aspectRatio: '16:9',
        enhancePrompt: true,
        generateAudio: true
      }, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      this.testTaskId = response.data.data.taskId;
      log(`   Task ID: ${this.testTaskId}`, 'blue');
      log(`   Type: ${response.data.data.type}`, 'blue');
      log(`   Provider: ${response.data.data.provider}`, 'blue');
      log('✅ Génération text-to-video démarrée', 'green');
      
    } catch (error) {
      if (error.response?.status === 403) {
        log('❌ Accès Veo refusé - Demandez l\'accès via Google Cloud Console', 'red');
      } else if (error.response?.status === 401) {
        log('❌ Authentification Google Cloud échouée', 'red');
      }
      throw new Error(`Génération text-to-video échouée: ${error.message}`);
    }
  }

  async testTaskStatusCheck() {
    log('📊 Test de vérification du statut...', 'blue');
    
    try {
      const response = await axios.get(`${BASE_URL}/ai/veo/task/${this.testTaskId}`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      const task = response.data.data.task;
      log(`   Status: ${task.status}`, 'blue');
      log(`   Provider: ${task.provider}`, 'blue');
      
      if (task.status === 'PENDING') {
        log('   ⏳ Génération en cours...', 'yellow');
      } else if (task.status === 'SUCCEEDED') {
        log('   🎉 Génération terminée avec succès !', 'green');
        if (task.video) {
          log(`   📹 Vidéo créée: ${task.video._id}`, 'green');
        }
      } else if (task.status === 'FAILED') {
        log(`   ❌ Génération échouée: ${task.error}`, 'red');
      }
      
      log('✅ Vérification du statut réussie', 'green');
      
    } catch (error) {
      throw new Error(`Vérification du statut échouée: ${error.message}`);
    }
  }

  async testImageToVideoGeneration() {
    log('🖼️  Test de génération image-to-video (optionnel)...', 'blue');
    
    try {
      // Créer une image de test simple (1x1 pixel PNG en base64)
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const response = await axios.post(`${BASE_URL}/ai/veo/generate-video-from-image`, {
        promptText: "Make this image come alive with gentle movement",
        imageBase64: testImageBase64,
        mimeType: 'image/png',
        model: 'veo-3.0-generate-preview',
        aspectRatio: '16:9',
        enhancePrompt: true,
        generateAudio: true
      }, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      log(`   Task ID: ${response.data.data.taskId}`, 'blue');
      log(`   Type: ${response.data.data.type}`, 'blue');
      log('✅ Génération image-to-video démarrée', 'green');
      
    } catch (error) {
      log(`⚠️  Test image-to-video échoué: ${error.message}`, 'yellow');
      log('   (Ce test est optionnel)', 'yellow');
    }
  }
}

// Exécuter les tests
if (require.main === module) {
  const test = new VeoIntegrationTest();
  test.run().catch(error => {
    log(`❌ Erreur fatale: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = VeoIntegrationTest; 