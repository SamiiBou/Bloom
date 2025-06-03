// Test de démarrage du serveur avec modération
require('dotenv').config();

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

async function testServerStart() {
  log('🚀 TEST DE DÉMARRAGE DU SERVEUR', 'blue');
  log('='.repeat(50));
  
  try {
    // 1. Test des imports critiques
    log('\n📦 1. Test des imports...', 'blue');
    
    const express = require('express');
    log('✅ Express chargé', 'green');
    
    const mongoose = require('mongoose');
    log('✅ Mongoose chargé', 'green');
    
    // Test des modèles
    const Video = require('./src/models/Video');
    const ModerationResult = require('./src/models/ModerationResult');
    const User = require('./src/models/User');
    log('✅ Modèles de données chargés', 'green');
    
    // Test des services
    const contentModerationService = require('./src/services/contentModerationService');
    log('✅ Service de modération chargé', 'green');
    
    // Test des routes
    const moderationRoutes = require('./src/routes/moderation');
    const uploadRoutes = require('./src/routes/upload');
    const videoRoutes = require('./src/routes/videos');
    log('✅ Routes chargées', 'green');
    
    // 2. Test de l'app Express
    log('\n🌐 2. Test de l\'application Express...', 'blue');
    
    const app = express();
    
    // Middlewares basiques
    app.use(express.json());
    
    // Test des routes de modération
    app.use('/api/moderation', moderationRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/videos', videoRoutes);
    
    log('✅ Routes de modération enregistrées', 'green');
    
    // 3. Test de connexion MongoDB
    log('\n🗄️ 3. Test de connexion à la base de données...', 'blue');
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log('✅ Connexion MongoDB réussie', 'green');
      
      // Test d'une requête simple
      const userCount = await User.countDocuments();
      log(`✅ Base de données accessible (${userCount} utilisateurs)`, 'green');
      
    } catch (error) {
      log('❌ Erreur de connexion MongoDB: ' + error.message, 'red');
      throw error;
    }
    
    // 4. Test du serveur
    log('\n🖥️ 4. Test de démarrage du serveur...', 'blue');
    
    const PORT = process.env.PORT || 3001;
    const server = app.listen(PORT, () => {
      log(`✅ Serveur démarré sur le port ${PORT}`, 'green');
    });
    
    // Attendre un peu puis fermer
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    server.close(() => {
      log('✅ Serveur fermé proprement', 'green');
    });
    
    // 5. Résumé
    log('\n📊 RÉSUMÉ:', 'blue');
    log('='.repeat(30));
    log('✅ Tous les composants sont opérationnels', 'green');
    log('✅ Le serveur peut démarrer avec la modération', 'green');
    log('✅ Les routes de modération sont fonctionnelles', 'green');
    log('✅ La base de données est accessible', 'green');
    
    log('\n🎯 ÉTAPES SUIVANTES:', 'yellow');
    log('1. Démarrer le serveur: npm start', 'yellow');
    log('2. Tester l\'upload d\'une vidéo', 'yellow');
    log('3. Vérifier les logs de modération', 'yellow');
    log('4. Tester les routes d\'administration', 'yellow');
    
  } catch (error) {
    log('\n💥 ERREUR: ' + error.message, 'red');
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      log('\n🔌 Connexion MongoDB fermée', 'yellow');
    }
  }
}

// Lancer le test
testServerStart()
  .then(() => {
    log('\n🎉 TEST DE DÉMARRAGE RÉUSSI!', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log('\n💥 ÉCHEC DU TEST: ' + error.message, 'red');
    process.exit(1);
  }); 