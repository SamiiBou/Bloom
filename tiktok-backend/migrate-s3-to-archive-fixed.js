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

// Fonction pour créer des collections d'archive
async function createArchiveCollections() {
  const collections = [
    'videos_s3_archive',
    'images_s3_archive', 
    'aiimages_s3_archive',
    'uploadtasks_s3_archive',
    'aitasks_s3_archive'
  ];

  for (const collectionName of collections) {
    const collection = mongoose.connection.db.collection(collectionName);
    
    // Vérifier si la collection existe déjà
    const existingCollections = await mongoose.connection.db.listCollections({ name: collectionName }).toArray();
    
    if (existingCollections.length === 0) {
      await collection.createIndex({ archivedAt: 1 });
      await collection.createIndex({ originalId: 1 });
      console.log(`📦 Collection d'archive créée: ${collectionName}`);
    } else {
      console.log(`📦 Collection d'archive existe déjà: ${collectionName}`);
    }
  }
}

// Fonction pour archiver les vidéos S3
async function archiveS3Videos() {
  console.log('\n🎬 === ARCHIVAGE DES VIDÉOS S3 ===');
  
  // Utiliser directement la collection sans modèle
  const videosCollection = mongoose.connection.db.collection('videos');
  
  // Trouver toutes les vidéos avec des URLs S3
  const s3Videos = await videosCollection.find({
    $or: [
      { videoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).toArray();

  console.log(`📊 ${s3Videos.length} vidéos S3 trouvées`);

  if (s3Videos.length > 0) {
    // Archiver dans la collection d'archive
    const archiveCollection = mongoose.connection.db.collection('videos_s3_archive');
    
    const videosToArchive = s3Videos.map(video => ({
      ...video,
      originalId: video._id,
      archivedAt: new Date(),
      archivedReason: 'S3 to Bunny Cloudinary migration'
    }));

    await archiveCollection.insertMany(videosToArchive);
    console.log(`✅ ${videosToArchive.length} vidéos archivées dans videos_s3_archive`);

    // Supprimer les vidéos originales
    const videoIds = s3Videos.map(v => v._id);
    await videosCollection.deleteMany({ _id: { $in: videoIds } });
    console.log(`🗑️  ${videoIds.length} vidéos S3 supprimées de la collection principale`);
  }
}

// Fonction pour archiver les images S3
async function archiveS3Images() {
  console.log('\n🖼️  === ARCHIVAGE DES IMAGES S3 ===');
  
  // Utiliser directement la collection sans modèle
  const imagesCollection = mongoose.connection.db.collection('images');
  
  // Trouver toutes les images avec des URLs S3
  const s3Images = await imagesCollection.find({
    $or: [
      { imageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).toArray();

  console.log(`📊 ${s3Images.length} images S3 trouvées`);

  if (s3Images.length > 0) {
    // Archiver dans la collection d'archive
    const archiveCollection = mongoose.connection.db.collection('images_s3_archive');
    
    const imagesToArchive = s3Images.map(image => ({
      ...image,
      originalId: image._id,
      archivedAt: new Date(),
      archivedReason: 'S3 to Bunny Cloudinary migration'
    }));

    await archiveCollection.insertMany(imagesToArchive);
    console.log(`✅ ${imagesToArchive.length} images archivées dans images_s3_archive`);

    // Supprimer les images originales
    const imageIds = s3Images.map(i => i._id);
    await imagesCollection.deleteMany({ _id: { $in: imageIds } });
    console.log(`🗑️  ${imageIds.length} images S3 supprimées de la collection principale`);
  }
}

// Fonction pour archiver les images IA S3
async function archiveS3AIImages() {
  console.log('\n🤖 === ARCHIVAGE DES IMAGES IA S3 ===');
  
  // Utiliser directement la collection sans modèle
  const aiImagesCollection = mongoose.connection.db.collection('aiimages');
  
  // Trouver toutes les images IA avec des URLs S3
  const s3AIImages = await aiImagesCollection.find({
    $or: [
      { imageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).toArray();

  console.log(`📊 ${s3AIImages.length} images IA S3 trouvées`);

  if (s3AIImages.length > 0) {
    // Archiver dans la collection d'archive
    const archiveCollection = mongoose.connection.db.collection('aiimages_s3_archive');
    
    const aiImagesToArchive = s3AIImages.map(aiImage => ({
      ...aiImage,
      originalId: aiImage._id,
      archivedAt: new Date(),
      archivedReason: 'S3 to Bunny Cloudinary migration'
    }));

    await archiveCollection.insertMany(aiImagesToArchive);
    console.log(`✅ ${aiImagesToArchive.length} images IA archivées dans aiimages_s3_archive`);

    // Supprimer les images IA originales
    const aiImageIds = s3AIImages.map(ai => ai._id);
    await aiImagesCollection.deleteMany({ _id: { $in: aiImageIds } });
    console.log(`🗑️  ${aiImageIds.length} images IA S3 supprimées de la collection principale`);
  }
}

// Fonction pour archiver les tâches d'upload S3
async function archiveS3UploadTasks() {
  console.log('\n📤 === ARCHIVAGE DES TÂCHES D\'UPLOAD S3 ===');
  
  // Utiliser directement la collection sans modèle
  const uploadTasksCollection = mongoose.connection.db.collection('uploadtasks');
  
  // Trouver toutes les tâches d'upload avec des URLs S3
  const s3UploadTasks = await uploadTasksCollection.find({
    $or: [
      { videoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).toArray();

  console.log(`📊 ${s3UploadTasks.length} tâches d'upload S3 trouvées`);

  if (s3UploadTasks.length > 0) {
    // Archiver dans la collection d'archive
    const archiveCollection = mongoose.connection.db.collection('uploadtasks_s3_archive');
    
    const uploadTasksToArchive = s3UploadTasks.map(task => ({
      ...task,
      originalId: task._id,
      archivedAt: new Date(),
      archivedReason: 'S3 to Bunny Cloudinary migration'
    }));

    await archiveCollection.insertMany(uploadTasksToArchive);
    console.log(`✅ ${uploadTasksToArchive.length} tâches d'upload archivées dans uploadtasks_s3_archive`);

    // Supprimer les tâches d'upload originales
    const uploadTaskIds = s3UploadTasks.map(t => t._id);
    await uploadTasksCollection.deleteMany({ _id: { $in: uploadTaskIds } });
    console.log(`🗑️  ${uploadTaskIds.length} tâches d'upload S3 supprimées de la collection principale`);
  }
}

// Fonction pour archiver les tâches IA S3
async function archiveS3AITasks() {
  console.log('\n🎯 === ARCHIVAGE DES TÂCHES IA S3 ===');
  
  // Utiliser directement la collection sans modèle
  const aiTasksCollection = mongoose.connection.db.collection('aitasks');
  
  // Trouver toutes les tâches IA avec des URLs S3
  const s3AITasks = await aiTasksCollection.find({
    $or: [
      { videoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { sourceImageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { generatedImageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { resultVideoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).toArray();

  console.log(`📊 ${s3AITasks.length} tâches IA S3 trouvées`);

  if (s3AITasks.length > 0) {
    // Archiver dans la collection d'archive
    const archiveCollection = mongoose.connection.db.collection('aitasks_s3_archive');
    
    const aiTasksToArchive = s3AITasks.map(task => ({
      ...task,
      originalId: task._id,
      archivedAt: new Date(),
      archivedReason: 'S3 to Bunny Cloudinary migration'
    }));

    await archiveCollection.insertMany(aiTasksToArchive);
    console.log(`✅ ${aiTasksToArchive.length} tâches IA archivées dans aitasks_s3_archive`);

    // Supprimer les tâches IA originales
    const aiTaskIds = s3AITasks.map(t => t._id);
    await aiTasksCollection.deleteMany({ _id: { $in: aiTaskIds } });
    console.log(`🗑️  ${aiTaskIds.length} tâches IA S3 supprimées de la collection principale`);
  }
}

// Fonction pour nettoyer les résultats de modération orphelins
async function cleanupOrphanedModerationResults() {
  console.log('\n🧹 === NETTOYAGE DES RÉSULTATS DE MODÉRATION ORPHELINS ===');
  
  // Utiliser directement les collections sans modèles
  const moderationResultsCollection = mongoose.connection.db.collection('moderationresults');
  const videosCollection = mongoose.connection.db.collection('videos');
  const imagesCollection = mongoose.connection.db.collection('images');
  
  // Trouver tous les résultats de modération
  const moderationResults = await moderationResultsCollection.find({}).toArray();
  console.log(`📊 ${moderationResults.length} résultats de modération trouvés`);
  
  let orphanedCount = 0;
  const orphanedIds = [];
  
  for (const result of moderationResults) {
    let isOrphaned = false;
    
    // Vérifier si la vidéo associée existe encore
    if (result.video) {
      const videoExists = await videosCollection.findOne({ _id: result.video });
      if (!videoExists) {
        isOrphaned = true;
      }
    }
    
    // Vérifier si l'image associée existe encore
    if (result.image) {
      const imageExists = await imagesCollection.findOne({ _id: result.image });
      if (!imageExists) {
        isOrphaned = true;
      }
    }
    
    if (isOrphaned) {
      orphanedIds.push(result._id);
      orphanedCount++;
    }
  }
  
  if (orphanedCount > 0) {
    await moderationResultsCollection.deleteMany({ _id: { $in: orphanedIds } });
    console.log(`🗑️  ${orphanedCount} résultats de modération orphelins supprimés`);
  } else {
    console.log(`✅ Aucun résultat de modération orphelin trouvé`);
  }
}

// Fonction pour afficher les statistiques finales
async function showFinalStats() {
  console.log('\n📊 === STATISTIQUES FINALES ===');
  
  // Utiliser directement les collections sans modèles
  const videosCollection = mongoose.connection.db.collection('videos');
  const imagesCollection = mongoose.connection.db.collection('images');
  const aiImagesCollection = mongoose.connection.db.collection('aiimages');
  const uploadTasksCollection = mongoose.connection.db.collection('uploadtasks');
  const aiTasksCollection = mongoose.connection.db.collection('aitasks');
  
  const videoCount = await videosCollection.countDocuments();
  const imageCount = await imagesCollection.countDocuments();
  const aiImageCount = await aiImagesCollection.countDocuments();
  const uploadTaskCount = await uploadTasksCollection.countDocuments();
  const aiTaskCount = await aiTasksCollection.countDocuments();
  
  console.log(`🎬 Videos restantes: ${videoCount}`);
  console.log(`🖼️  Images restantes: ${imageCount}`);
  console.log(`🤖 Images IA restantes: ${aiImageCount}`);
  console.log(`📤 Tâches d'upload restantes: ${uploadTaskCount}`);
  console.log(`🎯 Tâches IA restantes: ${aiTaskCount}`);
  
  // Statistiques des archives
  const collections = await mongoose.connection.db.listCollections().toArray();
  const archiveCollections = collections.filter(c => c.name.includes('_s3_archive'));
  
  console.log('\n📦 === COLLECTIONS D\'ARCHIVE ===');
  for (const collection of archiveCollections) {
    const count = await mongoose.connection.db.collection(collection.name).countDocuments();
    console.log(`📦 ${collection.name}: ${count} documents`);
  }
}

// Fonction principale
async function main() {
  try {
    console.log('🚀 === DÉBUT DE LA MIGRATION S3 VERS BUNNY CLOUDINARY ===\n');
    
    await connectDB();
    
    // Créer les collections d'archive
    await createArchiveCollections();
    
    // Archiver toutes les données S3
    await archiveS3Videos();
    await archiveS3Images();
    await archiveS3AIImages();
    await archiveS3UploadTasks();
    await archiveS3AITasks();
    
    // Nettoyer les résultats de modération orphelins
    await cleanupOrphanedModerationResults();
    
    // Afficher les statistiques finales
    await showFinalStats();
    
    console.log('\n✅ === MIGRATION TERMINÉE AVEC SUCCÈS ===');
    console.log('📝 Toutes les données S3 ont été archivées et supprimées des collections principales');
    console.log('🎉 Tu peux maintenant commencer à utiliser Bunny Cloudinary sur une base propre!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
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