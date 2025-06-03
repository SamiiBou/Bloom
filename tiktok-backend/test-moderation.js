// Charger les variables d'environnement
require('dotenv').config();

const contentModerationService = require('./src/services/contentModerationService');
const path = require('path');

async function testModeration() {
  console.log('🧪 Test du service de modération de contenu');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Vérifier la configuration
    console.log('\n📋 Configuration actuelle:');
    console.log('- Seuil contenu adulte:', contentModerationService.moderationConfig.adultContentThreshold);
    console.log('- Seuil violence:', contentModerationService.moderationConfig.violentContentThreshold);
    console.log('- Seuil contenu suggestif:', contentModerationService.moderationConfig.racyContentThreshold);
    
    // Test 2: Tester la conversion de likelihood
    console.log('\n🔄 Test de conversion des niveaux de probabilité:');
    const testLikelihoods = ['VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
    testLikelihoods.forEach(likelihood => {
      const score = contentModerationService.convertLikelihoodToScore(likelihood);
      console.log(`- ${likelihood}: ${score}`);
    });
    
    // Test 3: Tester avec un fichier vidéo (si disponible)
    const testVideoPath = process.argv[2];
    if (testVideoPath) {
      console.log(`\n🎥 Test de modération avec: ${testVideoPath}`);
      
      if (!path.isAbsolute(testVideoPath)) {
        console.log('❌ Veuillez fournir un chemin absolu vers le fichier vidéo');
        return;
      }
      
      try {
        const result = await contentModerationService.moderateVideo(testVideoPath, {
          failSafe: 'allow'
        });
        
        console.log('\n📊 Résultats de la modération:');
        console.log('- Autorisé:', result.isAllowed ? '✅ OUI' : '❌ NON');
        console.log('- Confiance:', (result.confidence * 100).toFixed(1) + '%');
        console.log('- Contenu détecté:', result.detectedContent.length > 0 ? result.detectedContent.join(', ') : 'Aucun');
        
        if (result.details) {
          console.log('\n🔍 Détails de l\'analyse:');
          console.log('- Contenu adulte:', (result.details.adultContent * 100).toFixed(1) + '%');
          console.log('- Violence:', (result.details.violentContent * 100).toFixed(1) + '%');
          console.log('- Contenu suggestif:', (result.details.racyContent * 100).toFixed(1) + '%');
          console.log('- Frames analysées:', result.details.totalFramesAnalyzed);
        }
        
        if (result.warnings && result.warnings.length > 0) {
          console.log('\n⚠️ Avertissements:');
          result.warnings.forEach(warning => console.log('- ' + warning));
        }
        
        if (result.error) {
          console.log('\n❌ Erreur:', result.error);
        }
        
        // Afficher les statistiques formatées
        const stats = contentModerationService.getModerationStats(result);
        console.log('\n📈 Statistiques:', stats);
        
      } catch (error) {
        console.error('\n❌ Erreur lors du test de modération:', error.message);
        
        if (error.message.includes('ENOENT')) {
          console.log('💡 Le fichier vidéo n\'existe pas ou n\'est pas accessible');
        } else if (error.message.includes('credentials')) {
          console.log('💡 Problème de credentials Google Cloud - vérifiez votre configuration');
        } else if (error.message.includes('project')) {
          console.log('💡 Problème avec l\'ID du projet Google Cloud');
        }
      }
    } else {
      console.log('\n💡 Pour tester avec une vraie vidéo, utilisez:');
      console.log('node test-moderation.js /chemin/vers/votre/video.mp4');
    }
    
    // Test 4: Tester la mise à jour de configuration
    console.log('\n⚙️ Test de mise à jour de configuration:');
    const originalConfig = { ...contentModerationService.moderationConfig };
    
    contentModerationService.updateModerationConfig({
      adultContentThreshold: 0.5
    });
    
    console.log('- Nouveau seuil contenu adulte:', contentModerationService.moderationConfig.adultContentThreshold);
    
    // Restaurer la configuration originale
    contentModerationService.updateModerationConfig(originalConfig);
    console.log('- Configuration restaurée ✅');
    
    console.log('\n✅ Tests terminés avec succès!');
    
  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Conseils de dépannage:');
      console.log('1. Vérifiez votre connexion internet');
      console.log('2. Vérifiez que l\'API Google Cloud Video Intelligence est activée');
      console.log('3. Vérifiez vos credentials Google Cloud');
    }
  }
}

// Afficher les informations d'aide
console.log('🛡️ Test du Service de Modération de Contenu');
console.log('');
console.log('Usage:');
console.log('  node test-moderation.js                    # Tests de base');
console.log('  node test-moderation.js /path/to/video.mp4 # Test avec vidéo');
console.log('');
console.log('Variables d\'environnement requises:');
console.log('  GOOGLE_CLOUD_PROJECT_ID                    # ID du projet Google Cloud');
console.log('  GOOGLE_APPLICATION_CREDENTIALS             # Chemin vers le fichier de clés');
console.log('  ou GOOGLE_APPLICATION_CREDENTIALS_JSON     # Credentials JSON direct');
console.log('');

// Vérifier les variables d'environnement
const requiredEnvVars = ['GOOGLE_CLOUD_PROJECT_ID'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Variables d\'environnement manquantes:');
  missingVars.forEach(varName => console.log(`  - ${varName}`));
  console.log('');
  console.log('💡 Ajoutez ces variables à votre fichier .env');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.log('❌ Credentials Google Cloud manquants:');
  console.log('  Définissez GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_APPLICATION_CREDENTIALS_JSON');
  console.log('');
  process.exit(1);
}

// Lancer les tests
testModeration().catch(console.error); 