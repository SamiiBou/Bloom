// Script de migration pour approuver les anciennes images
require('dotenv').config();
const mongoose = require('mongoose');

async function migrateExistingImages() {
  console.log('🔄 MIGRATION DES ANCIENNES IMAGES');
  console.log('='.repeat(50));
  
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connexion MongoDB établie');
    
    const Image = require('./src/models/Image');
    const User = require('./src/models/User');
    
    // Trouver toutes les images sans statut de modération ou avec statut 'pending'
    const imagesToMigrate = await Image.find({
      $or: [
        { moderationStatus: { $exists: false } },
        { moderationStatus: 'pending' },
        { moderationStatus: null }
      ]
    });
    
    console.log(`📊 Trouvé ${imagesToMigrate.length} images à migrer`);
    
    if (imagesToMigrate.length === 0) {
      console.log('✅ Aucune image à migrer');
      return;
    }
    
    // Afficher les images qui seront migrées
    console.log('\n📋 Images qui seront approuvées:');
    for (const image of imagesToMigrate) {
      console.log(`  - ${image.title || 'Sans titre'} - ${image.createdAt.toLocaleDateString()}`);
    }
    
    // Demander confirmation (simulation - en vrai on l'approuve directement)
    console.log('\n🔄 Migration en cours...');
    
    // Mettre à jour toutes les anciennes images
    const updateResult = await Image.updateMany(
      {
        $or: [
          { moderationStatus: { $exists: false } },
          { moderationStatus: 'pending' },
          { moderationStatus: null }
        ]
      },
      {
        $set: {
          moderationStatus: 'approved',
          'contentModeration.autoModerationStatus': 'approved',
          'contentModeration.isAutoApproved': true,
          'contentModeration.moderationConfidence': 1.0,
          'contentModeration.needsManualReview': false,
          'contentModeration.lastModeratedAt': new Date()
        }
      }
    );
    
    console.log(`✅ ${updateResult.modifiedCount} images mises à jour avec succès`);
    
    // Vérification
    const approvedCount = await Image.countDocuments({ moderationStatus: 'approved' });
    const totalCount = await Image.countDocuments();
    
    console.log('\n📊 RÉSULTATS DE LA MIGRATION:');
    console.log(`  - Images approuvées: ${approvedCount}`);
    console.log(`  - Total images: ${totalCount}`);
    console.log(`  - Taux d'approbation: ${((approvedCount / totalCount) * 100).toFixed(1)}%`);
    
    console.log('\n🎉 MIGRATION TERMINÉE AVEC SUCCÈS !');
    console.log('💡 Vos anciennes images sont maintenant visibles dans la section Images');
    
  } catch (error) {
    console.error('❌ Erreur durant la migration:', error);
    throw error;
  } finally {
    // Fermer la connexion MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 Connexion MongoDB fermée');
    }
  }
}

// Lancer la migration
migrateExistingImages()
  .then(() => {
    console.log('\n✅ MIGRATION COMPLÈTE');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 ERREUR DE MIGRATION:', error.message);
    process.exit(1);
  }); 