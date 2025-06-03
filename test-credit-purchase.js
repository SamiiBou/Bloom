const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3001/api';
const TEST_TOKEN = 'your_test_jwt_token_here'; // Remplacez par un vrai token JWT

async function testCreditPurchase() {
  console.log('🧪 Test des routes d\'achat de crédits...\n');

  try {
    // Test 1: Initier un achat de crédits
    console.log('1. Test d\'initiation d\'achat de crédits...');
    const initResponse = await axios.post(
      `${API_BASE_URL}/users/initiate-credit-purchase`,
      { creditAmount: 35 },
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Initiation réussie:', initResponse.data);
    const { reference } = initResponse.data;

    // Test 2: Obtenir l'historique des crédits
    console.log('\n2. Test de récupération de l\'historique...');
    const historyResponse = await axios.get(
      `${API_BASE_URL}/users/credit-purchase-history`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      }
    );

    console.log('✅ Historique récupéré:', historyResponse.data);

    // Test 3: Test de génération d'image avec vérification des crédits
    console.log('\n3. Test de génération d\'image avec crédits...');
    const generateResponse = await axios.post(
      `${API_BASE_URL}/ai/flux/generate-image`,
      {
        promptText: 'Test image generation with credits',
        model: 'flux-pro-1.1',
        aspectRatio: '1:1',
        steps: 25,
        guidance: 3.5
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Génération d\'image réussie:', generateResponse.data);

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.response?.data || error.message);
  }
}

// Lancer le test si le fichier est exécuté directement
if (require.main === module) {
  testCreditPurchase();
}

module.exports = testCreditPurchase;