// Script pour vérifier les variables d'environnement
require('dotenv').config();

console.log('🔍 Vérification des variables d\'environnement');
console.log('='.repeat(50));

// Variables Google Cloud
console.log('\n📊 Variables Google Cloud:');
console.log('GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID || '❌ Non défini');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || '❌ Non défini');
console.log('GOOGLE_APPLICATION_CREDENTIALS_JSON:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? '✅ Défini (JSON)' : '❌ Non défini');

// Variables de seuils
console.log('\n⚙️ Variables de configuration (optionnelles):');
console.log('MODERATION_ADULT_THRESHOLD:', process.env.MODERATION_ADULT_THRESHOLD || '❌ Non défini (défaut: 0.7)');
console.log('MODERATION_VIOLENCE_THRESHOLD:', process.env.MODERATION_VIOLENCE_THRESHOLD || '❌ Non défini (défaut: 0.8)');
console.log('MODERATION_RACY_THRESHOLD:', process.env.MODERATION_RACY_THRESHOLD || '❌ Non défini (défaut: 0.6)');

// Autres variables importantes
console.log('\n🗄️ Autres variables importantes:');
console.log('NODE_ENV:', process.env.NODE_ENV || '❌ Non défini');
console.log('PORT:', process.env.PORT || '❌ Non défini');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Défini' : '❌ Non défini');
console.log('AWS_REGION:', process.env.AWS_REGION || '❌ Non défini');
console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || '❌ Non défini');

// Vérifier si le fichier .env existe
const fs = require('fs');
const path = require('path');

console.log('\n📁 Vérification des fichiers:');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ Fichier .env trouvé:', envPath);
  
  // Lire et afficher le contenu (sans les valeurs sensibles)
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  console.log('\n📝 Variables trouvées dans .env:');
  lines.forEach(line => {
    const [key] = line.split('=');
    if (key) {
      console.log(`- ${key.trim()}`);
    }
  });
} else {
  console.log('❌ Fichier .env non trouvé:', envPath);
}

console.log('\n' + '='.repeat(50)); 