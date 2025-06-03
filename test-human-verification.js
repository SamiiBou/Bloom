const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3001/api';

// Test de vérification humaine
async function testHumanVerification() {
  console.log('🤖 Test du système de vérification humaine\n');

  try {
    // 1. Test de l'endpoint de vérification World ID
    console.log('1. Test de la vérification World ID...');
    const verifyResponse = await axios.post(`${API_BASE_URL}/auth/worldcoin-verify`, {
      proof: 'test_proof',
      merkle_root: 'test_merkle_root',
      nullifier_hash: 'test_nullifier_' + Date.now(),
      action: 'verifyhuman',
      app_id: 'app_f957956822118ea9a349f25a28f41176'
    });

    console.log('✅ Vérification World ID réussie:', verifyResponse.data);

    // 2. Afficher les détails du token bonus
    if (verifyResponse.data.status === 'success') {
      console.log('🎁 Bonus tokens disponible:', verifyResponse.data.data.tokensBonus);
      console.log('🔑 Nullifier hash:', verifyResponse.data.data.nullifier_hash);
    }

    console.log('\n✅ Test terminé avec succès!');
    console.log('\n📖 Comment tester dans l\'application:');
    console.log('1. Connectez-vous avec votre wallet dans l\'app');
    console.log('2. Une modal de vérification humaine devrait apparaître après 2 secondes');
    console.log('3. Cliquez sur "Verify with World ID"');
    console.log('4. Vous devriez recevoir 1000 tokens bonus');
    console.log('5. Regardez des vidéos pour obtenir 2x plus de tokens!');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.response?.data || error.message);
  }
}

// Exécuter le test
testHumanVerification(); 