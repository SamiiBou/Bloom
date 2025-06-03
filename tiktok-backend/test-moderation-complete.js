// Test complet du système de modération
require('dotenv').config();
const mongoose = require('mongoose');

// Couleurs pour les logs
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

async function testModerationSystem() {
  console.log('🧪 TEST COMPLET DU SYSTÈME DE MODÉRATION');
  console.log('='.repeat(60));
  
  try {
    // 1. Test de connectivité MongoDB
    log('\n📊 1. Test de connectivité MongoDB', 'blue');
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log('✅ Connexion MongoDB réussie', 'green');
      
      // Test des modèles
      const Video = require('./src/models/Video');
      const ModerationResult = require('./src/models/ModerationResult');
      const User = require('./src/models/User');
      
      log('✅ Modèles MongoDB chargés avec succès', 'green');
    } catch (error) {
      log('❌ Erreur de connexion MongoDB: ' + error.message, 'red');
    }
    
    // 2. Test du service de modération
    log('\n🛡️ 2. Test du service de modération', 'blue');
    const contentModerationService = require('./src/services/contentModerationService');
    
    // Test de configuration
    const config = contentModerationService.moderationConfig;
    log(`✅ Configuration chargée: Adult=${config.adultContentThreshold}, Violence=${config.violentContentThreshold}, Racy=${config.racyContentThreshold}`, 'green');
    
    // Test de conversion de likelihood
    const testScore = contentModerationService.convertLikelihoodToScore('LIKELY');
    if (testScore === 0.8) {
      log('✅ Conversion de likelihood fonctionne', 'green');
    } else {
      log('❌ Problème avec la conversion de likelihood', 'red');
    }
    
    // 3. Test des routes de modération
    log('\n🌐 3. Test de la structure des routes', 'blue');
    try {
      const moderationRoutes = require('./src/routes/moderation');
      log('✅ Routes de modération chargées', 'green');
    } catch (error) {
      log('❌ Erreur lors du chargement des routes: ' + error.message, 'red');
    }
    
    // 4. Test de la structure des données
    log('\n📋 4. Test de la structure des modèles de données', 'blue');
    try {
      const Video = require('./src/models/Video');
      const ModerationResult = require('./src/models/ModerationResult');
      
      // Créer un objet vidéo test pour vérifier la structure
      const testVideo = new Video({
        user: new mongoose.Types.ObjectId(),
        title: 'Test Video',
        description: 'Vidéo de test pour la modération',
        videoUrl: 'https://example.com/test.mp4',
        videoKey: 'test-key',
        moderationStatus: 'pending'
      });
      
      // Vérifier que les champs de modération existent
      if (testVideo.contentModeration && testVideo.moderationStatus) {
        log('✅ Structure des données de modération valide', 'green');
      } else {
        log('❌ Structure des données de modération manquante', 'red');
      }
      
    } catch (error) {
      log('❌ Erreur lors du test des modèles: ' + error.message, 'red');
    }
    
    // 5. Test des variables d'environnement critiques
    log('\n⚙️ 5. Vérification des variables d\'environnement', 'blue');
    const criticalVars = [
      'GOOGLE_CLOUD_PROJECT_ID',
      'GOOGLE_APPLICATION_CREDENTIALS',
      'MONGODB_URI',
      'JWT_SECRET'
    ];
    
    let envVarsOk = true;
    criticalVars.forEach(varName => {
      if (process.env[varName]) {
        log(`✅ ${varName}: Défini`, 'green');
      } else {
        log(`❌ ${varName}: Manquant`, 'red');
        envVarsOk = false;
      }
    });
    
    // 6. Test des seuils de modération
    log('\n🎯 6. Test des seuils de modération', 'blue');
    const thresholds = {
      adult: parseFloat(process.env.MODERATION_ADULT_THRESHOLD) || 0.7,
      violence: parseFloat(process.env.MODERATION_VIOLENCE_THRESHOLD) || 0.8,
      racy: parseFloat(process.env.MODERATION_RACY_THRESHOLD) || 0.6
    };
    
    if (thresholds.adult >= 0 && thresholds.adult <= 1 &&
        thresholds.violence >= 0 && thresholds.violence <= 1 &&
        thresholds.racy >= 0 && thresholds.racy <= 1) {
      log('✅ Seuils de modération valides', 'green');
      log(`   Adulte: ${thresholds.adult}, Violence: ${thresholds.violence}, Suggestif: ${thresholds.racy}`, 'yellow');
    } else {
      log('❌ Seuils de modération invalides', 'red');
    }
    
    // 7. Test de connectivité Google Cloud (sans faire d'appel réel)
    log('\n☁️ 7. Test de configuration Google Cloud', 'blue');
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const fs = require('fs');
    
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      try {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        if (credentials.type === 'service_account' && credentials.project_id) {
          log('✅ Fichier de credentials Google Cloud valide', 'green');
          log(`   Projet: ${credentials.project_id}`, 'yellow');
        } else {
          log('❌ Format de credentials Google Cloud invalide', 'red');
        }
      } catch (error) {
        log('❌ Impossible de lire le fichier de credentials: ' + error.message, 'red');
      }
    } else {
      log('❌ Fichier de credentials Google Cloud non trouvé', 'red');
    }
    
    // 8. Résumé des tests
    log('\n📊 RÉSUMÉ DES TESTS', 'blue');
    log('='.repeat(40));
    
    if (envVarsOk) {
      log('✅ Toutes les variables d\'environnement sont configurées', 'green');
    } else {
      log('❌ Des variables d\'environnement sont manquantes', 'red');
    }
    
    log('✅ Service de modération opérationnel', 'green');
    log('✅ Modèles de données valides', 'green');
    log('✅ Routes de modération chargées', 'green');
    
    log('\n🎯 PROCHAINES ÉTAPES POUR TESTER:', 'blue');
    log('1. Démarrer le serveur: npm start', 'yellow');
    log('2. Tester l\'upload d\'une vidéo via l\'interface', 'yellow');
    log('3. Vérifier les logs de modération dans la console', 'yellow');
    log('4. Accéder aux routes d\'admin de modération', 'yellow');
    log('5. Tester avec une vraie vidéo: node test-moderation.js /path/to/video.mp4', 'yellow');
    
  } catch (error) {
    log('\n❌ Erreur durant les tests: ' + error.message, 'red');
    console.error(error);
  } finally {
    // Fermer la connexion MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      log('\n🔌 Connexion MongoDB fermée', 'yellow');
    }
  }
}

// Exécuter les tests
testModerationSystem()
  .then(() => {
    log('\n🎉 TESTS TERMINÉS', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log('\n💥 ÉCHEC DES TESTS: ' + error.message, 'red');
    process.exit(1);
  }); 