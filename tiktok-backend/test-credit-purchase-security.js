// Test de sécurité : impossible de détourner l'adresse de paiement
const axios = require('axios');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';
const MALICIOUS_ADDRESS = '0x1111111111111111111111111111111111111111';

async function testPaymentAddressSecurity() {
  console.log('🧪 Test sécurité : falsification adresse de paiement');
  try {
    // 1. On tente d'initier un achat en envoyant une adresse malicieuse
    const res = await axios.post(
      `${BASE_URL}/users/initiate-credit-purchase`,
      {
        creditAmount: 35,
        to: MALICIOUS_ADDRESS // tentative d'injection
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (res.data.paymentAddress && res.data.paymentAddress === MALICIOUS_ADDRESS) {
      console.error('❌ FAIL: Le backend a accepté une adresse de paiement falsifiée !');
      process.exit(1);
    } else {
      console.log('✅ PASS: Le backend ignore toute adresse de paiement envoyée par le client.');
    }
  } catch (e) {
    if (e.response && e.response.status === 400) {
      console.log('✅ PASS: Le backend a rejeté la requête malicieuse (400)');
    } else {
      console.error('❌ FAIL: Erreur inattendue', e.message);
      process.exit(1);
    }
  }
}

testPaymentAddressSecurity(); 