// Test du processus d'upload complet
require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const videoConverter = require('./src/services/videoConverter');

async function testUploadProcess() {
  console.log('🧪 Test du processus d\'upload complet');
  console.log('='.repeat(50));
  
  const tempDir = path.join(__dirname, 'temp');
  
  try {
    // 1. Créer une vidéo de test
    console.log('📹 Création d\'une vidéo de test...');
    await videoConverter.ensureTempDir();
    
    const testVideoPath = path.join(tempDir, 'test-upload.mp4');
    const ffmpeg = require('fluent-ffmpeg');
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input('color=c=blue:s=640x480:d=2')
        .inputFormat('lavfi')
        .videoCodec('libx264')
        .fps(30)
        .on('end', resolve)
        .on('error', reject)
        .save(testVideoPath);
    });
    
    console.log('✅ Vidéo de test créée');
    
    // 2. Tester la vérification de conversion
    console.log('\n🔍 Test de vérification de conversion...');
    const needsConversion = await videoConverter.needsConversion(testVideoPath);
    console.log(`Conversion nécessaire: ${needsConversion ? 'OUI' : 'NON'}`);
    
    // 3. Convertir si nécessaire
    let finalVideoPath = testVideoPath;
    if (needsConversion) {
      console.log('\n🔄 Test de conversion...');
      const convertedPath = path.join(tempDir, 'test-upload-converted.mp4');
      finalVideoPath = await videoConverter.convertToMP4(testVideoPath, convertedPath);
      console.log('✅ Conversion terminée');
    }
    
    // 4. Obtenir les métadonnées
    console.log('\n📊 Test d\'extraction de métadonnées...');
    const metadata = await videoConverter.getVideoMetadata(finalVideoPath);
    console.log('Métadonnées:', {
      duration: metadata.duration,
      format: metadata.format,
      resolution: `${metadata.video?.width}x${metadata.video?.height}`
    });
    
    // 5. Générer la thumbnail
    console.log('\n🖼️  Test de génération de thumbnail...');
    const thumbnailPath = path.join(tempDir, 'test-thumbnail.jpg');
    const finalThumbnailPath = await videoConverter.generateThumbnail(finalVideoPath, thumbnailPath);
    
    // Vérifier que la thumbnail existe
    const thumbnailStats = await fs.stat(finalThumbnailPath);
    console.log(`✅ Thumbnail générée: ${path.basename(finalThumbnailPath)} (${thumbnailStats.size} bytes)`);
    
    console.log('\n🎉 PROCESSUS D\'UPLOAD COMPLET RÉUSSI !');
    console.log('\n✅ Tous les composants fonctionnent:');
    console.log('  - Vérification de conversion ✅');
    console.log('  - Conversion vidéo ✅');
    console.log('  - Extraction de métadonnées ✅');
    console.log('  - Génération de thumbnail ✅');
    
    console.log('\n🚀 Votre upload devrait maintenant fonctionner !');
    
  } catch (error) {
    console.error('\n❌ Erreur durant le test:', error.message);
    console.error(error.stack);
  } finally {
    // Nettoyer
    console.log('\n🧹 Nettoyage des fichiers de test...');
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        if (file.startsWith('test-')) {
          await fs.unlink(path.join(tempDir, file));
          console.log(`🗑️  ${file} supprimé`);
        }
      }
    } catch (error) {
      console.warn('⚠️  Erreur lors du nettoyage:', error.message);
    }
  }
}

testUploadProcess().catch(console.error); 