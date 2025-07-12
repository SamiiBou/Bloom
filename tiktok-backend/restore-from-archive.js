const mongoose = require('mongoose');
require('dotenv').config();

// Configuration MongoDB
const MONGODB_URI = "mongodb+srv://samiboudechicha:M6OamXokmeWWr6Aj@bloom.hal8f4c.mongodb.net/?retryWrites=true&w=majority&appName=Bloom";

// Fonction pour se connecter à MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB avec succès');
  } catch (error) {
    console.error('❌ Erreur de connexion à MongoDB:', error);
    process.exit(1);
  }
}

// Fonction pour restaurer les vidéos depuis l'archive
async function restoreVideosFromArchive() {
  console.log('\n🎬 === RESTAURATION DES VIDÉOS DEPUIS L\'ARCHIVE ===');
  
  const Video = mongoose.model('Video', new mongoose.Schema({}, { strict: false }));
  const archiveCollection = mongoose.connection.db.collection('videos_s3_archive');
  
  // Récupérer tous les documents archivés
  const archivedVideos = await archiveCollection.find({}).toArray();
  console.log(`📊 ${archivedVideos.length} vidéos trouvées dans l'archive`);
  
  if (archivedVideos.length > 0) {
    // Préparer les documents pour la restauration
    const videosToRestore = archivedVideos.map(video => {
      const { _id, originalId, archivedAt, archivedReason, ...videoData } = video;
      return {
        ...videoData,
        _id: originalId, // Restaurer l'ID original
        restoredAt: new Date(),
        restoredFrom: 'videos_s3_archive'
      };
    });
    
    // Restaurer dans la collection principale
    await Video.insertMany(videosToRestore, { ordered: false });
    console.log(`✅ ${videosToRestore.length} vidéos restaurées dans la collection principale`);
    
    // Optionnel: Supprimer de l'archive après restauration
    // await archiveCollection.deleteMany({});
    // console.log('🗑️  Archive vidéos nettoyée');
  }
}

// Fonction pour restaurer les images depuis l'archive
async function restoreImagesFromArchive() {
  console.log('\n🖼️  === RESTAURATION DES IMAGES DEPUIS L\'ARCHIVE ===');
  
  const Image = mongoose.model('Image', new mongoose.Schema({}, { strict: false }));
  const archiveCollection = mongoose.connection.db.collection('images_s3_archive');
  
  // Récupérer tous les documents archivés
  const archivedImages = await archiveCollection.find({}).toArray();
  console.log(`📊 ${archivedImages.length} images trouvées dans l'archive`);
  
  if (archivedImages.length > 0) {
    // Préparer les documents pour la restauration
    const imagesToRestore = archivedImages.map(image => {
      const { _id, originalId, archivedAt, archivedReason, ...imageData } = image;
      return {
        ...imageData,
        _id: originalId, // Restaurer l'ID original
        restoredAt: new Date(),
        restoredFrom: 'images_s3_archive'
      };
    });
    
    // Restaurer dans la collection principale
    await Image.insertMany(imagesToRestore, { ordered: false });
    console.log(`✅ ${imagesToRestore.length} images restaurées dans la collection principale`);
  }
}

// Fonction pour restaurer les images IA depuis l'archive
async function restoreAIImagesFromArchive() {
  console.log('\n🤖 === RESTAURATION DES IMAGES IA DEPUIS L\'ARCHIVE ===');
  
  const AIImage = mongoose.model('AIImage', new mongoose.Schema({}, { strict: false }));
  const archiveCollection = mongoose.connection.db.collection('aiimages_s3_archive');
  
  // Récupérer tous les documents archivés
  const archivedAIImages = await archiveCollection.find({}).toArray();
  console.log(`📊 ${archivedAIImages.length} images IA trouvées dans l'archive`);
  
  if (archivedAIImages.length > 0) {
    // Préparer les documents pour la restauration
    const aiImagesToRestore = archivedAIImages.map(aiImage => {
      const { _id, originalId, archivedAt, archivedReason, ...aiImageData } = aiImage;
      return {
        ...aiImageData,
        _id: originalId, // Restaurer l'ID original
        restoredAt: new Date(),
        restoredFrom: 'aiimages_s3_archive'
      };
    });
    
    // Restaurer dans la collection principale
    await AIImage.insertMany(aiImagesToRestore, { ordered: false });
    console.log(`✅ ${aiImagesToRestore.length} images IA restaurées dans la collection principale`);
  }
}

// Fonction pour restaurer les tâches d'upload depuis l'archive
async function restoreUploadTasksFromArchive() {
  console.log('\n📤 === RESTAURATION DES TÂCHES D\'UPLOAD DEPUIS L\'ARCHIVE ===');
  
  const UploadTask = mongoose.model('UploadTask', new mongoose.Schema({}, { strict: false }));
  const archiveCollection = mongoose.connection.db.collection('uploadtasks_s3_archive');
  
  // Récupérer tous les documents archivés
  const archivedUploadTasks = await archiveCollection.find({}).toArray();
  console.log(`📊 ${archivedUploadTasks.length} tâches d'upload trouvées dans l'archive`);
  
  if (archivedUploadTasks.length > 0) {
    // Préparer les documents pour la restauration
    const uploadTasksToRestore = archivedUploadTasks.map(task => {
      const { _id, originalId, archivedAt, archivedReason, ...taskData } = task;
      return {
        ...taskData,
        _id: originalId, // Restaurer l'ID original
        restoredAt: new Date(),
        restoredFrom: 'uploadtasks_s3_archive'
      };
    });
    
    // Restaurer dans la collection principale
    await UploadTask.insertMany(uploadTasksToRestore, { ordered: false });
    console.log(`✅ ${uploadTasksToRestore.length} tâches d'upload restaurées dans la collection principale`);
  }
}

// Fonction pour restaurer les tâches IA depuis l'archive
async function restoreAITasksFromArchive() {
  console.log('\n🎯 === RESTAURATION DES TÂCHES IA DEPUIS L\'ARCHIVE ===');
  
  const AITask = mongoose.model('AITask', new mongoose.Schema({}, { strict: false }));
  const archiveCollection = mongoose.connection.db.collection('aitasks_s3_archive');
  
  // Récupérer tous les documents archivés
  const archivedAITasks = await archiveCollection.find({}).toArray();
  console.log(`📊 ${archivedAITasks.length} tâches IA trouvées dans l'archive`);
  
  if (archivedAITasks.length > 0) {
    // Préparer les documents pour la restauration
    const aiTasksToRestore = archivedAITasks.map(task => {
      const { _id, originalId, archivedAt, archivedReason, ...taskData } = task;
      return {
        ...taskData,
        _id: originalId, // Restaurer l'ID original
        restoredAt: new Date(),
        restoredFrom: 'aitasks_s3_archive'
      };
    });
    
    // Restaurer dans la collection principale
    await AITask.insertMany(aiTasksToRestore, { ordered: false });
    console.log(`✅ ${aiTasksToRestore.length} tâches IA restaurées dans la collection principale`);
  }
}

// Fonction pour vérifier les archives disponibles
async function checkAvailableArchives() {
  console.log('\n📦 === VÉRIFICATION DES ARCHIVES DISPONIBLES ===');
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  const archiveCollections = collections.filter(c => c.name.includes('_s3_archive'));
  
  if (archiveCollections.length === 0) {
    console.log('❌ Aucune archive trouvée !');
    return false;
  }
  
  console.log('📊 Archives disponibles:');
  let totalDocuments = 0;
  
  for (const collection of archiveCollections) {
    const count = await mongoose.connection.db.collection(collection.name).countDocuments();
    console.log(`📦 ${collection.name}: ${count} documents`);
    totalDocuments += count;
  }
  
  console.log(`\n📊 TOTAL: ${totalDocuments} documents dans les archives`);
  return totalDocuments > 0;
}

// Fonction pour afficher les statistiques après restauration
async function showRestoreStats() {
  console.log('\n📊 === STATISTIQUES APRÈS RESTAURATION ===');
  
  const Video = mongoose.model('Video', new mongoose.Schema({}, { strict: false }));
  const Image = mongoose.model('Image', new mongoose.Schema({}, { strict: false }));
  const AIImage = mongoose.model('AIImage', new mongoose.Schema({}, { strict: false }));
  const UploadTask = mongoose.model('UploadTask', new mongoose.Schema({}, { strict: false }));
  const AITask = mongoose.model('AITask', new mongoose.Schema({}, { strict: false }));
  
  const videoCount = await Video.countDocuments();
  const imageCount = await Image.countDocuments();
  const aiImageCount = await AIImage.countDocuments();
  const uploadTaskCount = await UploadTask.countDocuments();
  const aiTaskCount = await AITask.countDocuments();
  
  console.log(`🎬 Videos: ${videoCount}`);
  console.log(`🖼️  Images: ${imageCount}`);
  console.log(`🤖 Images IA: ${aiImageCount}`);
  console.log(`📤 Tâches d'upload: ${uploadTaskCount}`);
  console.log(`🎯 Tâches IA: ${aiTaskCount}`);
  
  // Compter les documents restaurés
  const restoredVideoCount = await Video.countDocuments({ restoredFrom: { $exists: true } });
  const restoredImageCount = await Image.countDocuments({ restoredFrom: { $exists: true } });
  const restoredAIImageCount = await AIImage.countDocuments({ restoredFrom: { $exists: true } });
  const restoredUploadTaskCount = await UploadTask.countDocuments({ restoredFrom: { $exists: true } });
  const restoredAITaskCount = await AITask.countDocuments({ restoredFrom: { $exists: true } });
  
  const totalRestored = restoredVideoCount + restoredImageCount + restoredAIImageCount + restoredUploadTaskCount + restoredAITaskCount;
  
  console.log(`\n🔄 Documents restaurés: ${totalRestored}`);
  console.log(`  - Vidéos: ${restoredVideoCount}`);
  console.log(`  - Images: ${restoredImageCount}`);
  console.log(`  - Images IA: ${restoredAIImageCount}`);
  console.log(`  - Tâches d'upload: ${restoredUploadTaskCount}`);
  console.log(`  - Tâches IA: ${restoredAITaskCount}`);
}

// Fonction principale
async function main() {
  try {
    console.log('🔄 === RESTAURATION DEPUIS LES ARCHIVES S3 ===\n');
    
    await connectDB();
    
    // Vérifier si des archives sont disponibles
    const hasArchives = await checkAvailableArchives();
    
    if (!hasArchives) {
      console.log('\n❌ Aucune archive disponible pour la restauration !');
      console.log('💡 Assure-toi d\'avoir exécuté la migration d\'abord.');
      return;
    }
    
    console.log('\n⚠️  === ATTENTION ===');
    console.log('🔄 Cette opération va restaurer TOUS les documents archivés');
    console.log('📊 Les données seront restaurées dans les collections principales');
    console.log('🗑️  Cette opération peut créer des doublons si des données existent déjà');
    
    // Demander confirmation (pour un script manuel)
    console.log('\n▶️  Début de la restauration...');
    
    // Restaurer toutes les données
    await restoreVideosFromArchive();
    await restoreImagesFromArchive();
    await restoreAIImagesFromArchive();
    await restoreUploadTasksFromArchive();
    await restoreAITasksFromArchive();
    
    // Afficher les statistiques finales
    await showRestoreStats();
    
    console.log('\n✅ === RESTAURATION TERMINÉE AVEC SUCCÈS ===');
    console.log('📝 Toutes les données ont été restaurées depuis les archives');
    console.log('💡 Les archives sont toujours disponibles pour référence');
    
  } catch (error) {
    console.error('❌ Erreur lors de la restauration:', error);
    console.log('\n💡 Conseils de dépannage:');
    console.log('- Vérifier la connexion à MongoDB');
    console.log('- Vérifier que les archives existent');
    console.log('- Vérifier les permissions sur les collections');
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connexion MongoDB fermée');
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { main }; 