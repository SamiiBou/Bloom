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

// Fonction pour prévisualiser les vidéos S3
async function previewS3Videos() {
  console.log('\n🎬 === PRÉVISUALISATION DES VIDÉOS S3 ===');
  
  // Utiliser directement la collection sans modèle
  const videosCollection = mongoose.connection.db.collection('videos');
  
  // Trouver toutes les vidéos avec des URLs S3
  const s3Videos = await videosCollection.find({
    $or: [
      { videoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).limit(5).toArray(); // Limiter à 5 exemples pour la prévisualisation

  console.log(`📊 ${s3Videos.length} vidéos S3 trouvées (exemples):`);
  
  s3Videos.forEach((video, index) => {
    console.log(`  ${index + 1}. ID: ${video._id}`);
    console.log(`     Title: ${video.title || 'Sans titre'}`);
    console.log(`     Video URL: ${video.videoUrl}`);
    console.log(`     Thumbnail URL: ${video.thumbnailUrl || 'Pas de thumbnail'}`);
    console.log(`     Créé le: ${video.createdAt}`);
    console.log('');
  });
}

// Fonction pour prévisualiser les images S3
async function previewS3Images() {
  console.log('\n🖼️  === PRÉVISUALISATION DES IMAGES S3 ===');
  
  // Utiliser directement la collection sans modèle
  const imagesCollection = mongoose.connection.db.collection('images');
  
  // Trouver toutes les images avec des URLs S3
  const s3Images = await imagesCollection.find({
    $or: [
      { imageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).limit(5).toArray(); // Limiter à 5 exemples pour la prévisualisation

  console.log(`📊 ${s3Images.length} images S3 trouvées (exemples):`);
  
  s3Images.forEach((image, index) => {
    console.log(`  ${index + 1}. ID: ${image._id}`);
    console.log(`     Title: ${image.title || 'Sans titre'}`);
    console.log(`     Image URL: ${image.imageUrl}`);
    console.log(`     Thumbnail URL: ${image.thumbnailUrl || 'Pas de thumbnail'}`);
    console.log(`     Type: ${image.type || 'upload'}`);
    console.log(`     Créé le: ${image.createdAt}`);
    console.log('');
  });
}

// Fonction pour prévisualiser les images IA S3
async function previewS3AIImages() {
  console.log('\n🤖 === PRÉVISUALISATION DES IMAGES IA S3 ===');
  
  // Utiliser directement la collection sans modèle
  const aiImagesCollection = mongoose.connection.db.collection('aiimages');
  
  // Trouver toutes les images IA avec des URLs S3
  const s3AIImages = await aiImagesCollection.find({
    $or: [
      { imageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).limit(5).toArray(); // Limiter à 5 exemples pour la prévisualisation

  console.log(`📊 ${s3AIImages.length} images IA S3 trouvées (exemples):`);
  
  s3AIImages.forEach((aiImage, index) => {
    console.log(`  ${index + 1}. ID: ${aiImage._id}`);
    console.log(`     Task ID: ${aiImage.taskId}`);
    console.log(`     Prompt: ${aiImage.promptText?.substring(0, 100)}...`);
    console.log(`     Image URL: ${aiImage.imageUrl}`);
    console.log(`     Model: ${aiImage.model}`);
    console.log(`     Status: ${aiImage.status}`);
    console.log(`     Créé le: ${aiImage.createdAt}`);
    console.log('');
  });
}

// Fonction pour prévisualiser les tâches d'upload S3
async function previewS3UploadTasks() {
  console.log('\n📤 === PRÉVISUALISATION DES TÂCHES D\'UPLOAD S3 ===');
  
  // Utiliser directement la collection sans modèle
  const uploadTasksCollection = mongoose.connection.db.collection('uploadtasks');
  
  // Trouver toutes les tâches d'upload avec des URLs S3
  const s3UploadTasks = await uploadTasksCollection.find({
    $or: [
      { videoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  }).limit(5).toArray(); // Limiter à 5 exemples pour la prévisualisation

  console.log(`📊 ${s3UploadTasks.length} tâches d'upload S3 trouvées (exemples):`);
  
  s3UploadTasks.forEach((task, index) => {
    console.log(`  ${index + 1}. ID: ${task._id}`);
    console.log(`     Upload ID: ${task.uploadId}`);
    console.log(`     Filename: ${task.filename}`);
    console.log(`     Video URL: ${task.videoUrl}`);
    console.log(`     Status: ${task.status}`);
    console.log(`     Créé le: ${task.createdAt}`);
    console.log('');
  });
}

// Fonction pour prévisualiser les tâches IA S3
async function previewS3AITasks() {
  console.log('\n🎯 === PRÉVISUALISATION DES TÂCHES IA S3 ===');
  
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
  }).limit(5).toArray(); // Limiter à 5 exemples pour la prévisualisation

  console.log(`📊 ${s3AITasks.length} tâches IA S3 trouvées (exemples):`);
  
  s3AITasks.forEach((task, index) => {
    console.log(`  ${index + 1}. ID: ${task._id}`);
    console.log(`     Runway Task ID: ${task.runwayTaskId}`);
    console.log(`     Prompt: ${task.promptText?.substring(0, 100)}...`);
    console.log(`     Type: ${task.type}`);
    console.log(`     Status: ${task.status}`);
    console.log(`     Video URL: ${task.videoUrl || 'Pas de vidéo'}`);
    console.log(`     Créé le: ${task.createdAt}`);
    console.log('');
  });
}

// Fonction pour compter tous les documents
async function countAllS3Documents() {
  console.log('\n📊 === COMPTAGE TOTAL DES DOCUMENTS S3 ===');
  
  // Utiliser directement les collections sans modèles
  const videosCollection = mongoose.connection.db.collection('videos');
  const imagesCollection = mongoose.connection.db.collection('images');
  const aiImagesCollection = mongoose.connection.db.collection('aiimages');
  const uploadTasksCollection = mongoose.connection.db.collection('uploadtasks');
  const aiTasksCollection = mongoose.connection.db.collection('aitasks');
  
  // Compter les vidéos S3
  const videoCount = await videosCollection.countDocuments({
    $or: [
      { videoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  });
  
  // Compter les images S3
  const imageCount = await imagesCollection.countDocuments({
    $or: [
      { imageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  });
  
  // Compter les images IA S3
  const aiImageCount = await aiImagesCollection.countDocuments({
    $or: [
      { imageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  });
  
  // Compter les tâches d'upload S3
  const uploadTaskCount = await uploadTasksCollection.countDocuments({
    $or: [
      { videoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { thumbnailUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  });
  
  // Compter les tâches IA S3
  const aiTaskCount = await aiTasksCollection.countDocuments({
    $or: [
      { videoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { sourceImageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { generatedImageUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } },
      { resultVideoUrl: { $regex: /amazonaws\.com|s3\.|cloudfront\.net/i } }
    ]
  });
  
  console.log(`🎬 Vidéos S3 à archiver: ${videoCount}`);
  console.log(`🖼️  Images S3 à archiver: ${imageCount}`);
  console.log(`🤖 Images IA S3 à archiver: ${aiImageCount}`);
  console.log(`📤 Tâches d'upload S3 à archiver: ${uploadTaskCount}`);
  console.log(`🎯 Tâches IA S3 à archiver: ${aiTaskCount}`);
  
  const total = videoCount + imageCount + aiImageCount + uploadTaskCount + aiTaskCount;
  console.log(`\n📊 TOTAL: ${total} documents seront archivés`);
  
  return total;
}

// Fonction principale
async function main() {
  try {
    console.log('🔍 === PRÉVISUALISATION DE LA MIGRATION S3 ===\n');
    
    await connectDB();
    
    // Compter tous les documents
    const totalDocuments = await countAllS3Documents();
    
    if (totalDocuments === 0) {
      console.log('\n✅ Aucun document S3 trouvé ! Ta base de données est déjà propre.');
      return;
    }
    
    // Prévisualiser les exemples
    await previewS3Videos();
    await previewS3Images();
    await previewS3AIImages();
    await previewS3UploadTasks();
    await previewS3AITasks();
    
    console.log('\n⚠️  === ATTENTION ===');
    console.log(`📊 ${totalDocuments} documents seront SUPPRIMÉS des collections principales`);
    console.log(`📦 Ils seront ARCHIVÉS dans des collections séparées`);
    console.log(`🗑️  Cette opération est IRRÉVERSIBLE`);
    console.log('\n🚀 Pour exécuter la migration, lance:');
    console.log('    node migrate-s3-to-archive.js');
    
  } catch (error) {
    console.error('❌ Erreur lors de la prévisualisation:', error);
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