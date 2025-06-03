// Test de génération de thumbnail
require('dotenv').config();
const videoConverter = require('./src/services/videoConverter');
const path = require('path');
const fs = require('fs');

async function testThumbnail() {
  console.log('🖼️  Test de génération de thumbnail');
  console.log('='.repeat(40));
  
  // Créer un fichier vidéo test simple avec FFmpeg
  const testVideoPath = path.join(__dirname, 'temp', 'test-video.mp4');
  const testThumbnailPath = path.join(__dirname, 'temp', 'test-thumbnail.jpg');
  
  try {
    // S'assurer que le répertoire temp existe
    await videoConverter.ensureTempDir();
    
    // Créer une vidéo de test simple (écran noir de 3 secondes)
    console.log('📹 Création d\'une vidéo de test...');
    const ffmpeg = require('fluent-ffmpeg');
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input('color=c=black:s=640x480:d=3')
        .inputFormat('lavfi')
        .videoCodec('libx264')
        .fps(30)
        .on('end', () => {
          console.log('✅ Vidéo de test créée');
          resolve();
        })
        .on('error', reject)
        .save(testVideoPath);
    });
    
    // Tester la génération de thumbnail
    console.log('\n🖼️  Test de génération de thumbnail...');
    const result = await videoConverter.generateThumbnail(testVideoPath, testThumbnailPath, 1);
    
    // Vérifier que le fichier a été créé
    if (fs.existsSync(result)) {
      const stats = fs.statSync(result);
      console.log(`✅ Thumbnail générée avec succès: ${path.basename(result)} (${stats.size} bytes)`);
    } else {
      throw new Error('Fichier thumbnail non créé');
    }
    
    console.log('\n🎉 Test de thumbnail réussi !');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error.message);
    console.error(error.stack);
    
    // Suggestions de dépannage
    console.log('\n💡 Suggestions de dépannage:');
    console.log('1. Vérifiez que FFmpeg est installé et accessible');
    console.log('2. Vérifiez les permissions du répertoire temp');
    console.log('3. Essayez avec une vraie vidéo au lieu de la vidéo générée');
    
  } finally {
    // Nettoyer les fichiers de test
    console.log('\n🧹 Nettoyage...');
    try {
      if (fs.existsSync(testVideoPath)) {
        fs.unlinkSync(testVideoPath);
        console.log('🗑️  Vidéo de test supprimée');
      }
      if (fs.existsSync(testThumbnailPath)) {
        fs.unlinkSync(testThumbnailPath);
        console.log('🗑️  Thumbnail de test supprimée');
      }
    } catch (error) {
      console.warn('⚠️  Erreur lors du nettoyage:', error.message);
    }
  }
}

// Lancer le test
testThumbnail().catch(console.error); 