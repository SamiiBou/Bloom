/**
 * Script de configuration automatique de FFmpeg pour le développement
 * À exécuter une fois après npm install
 */

const ffmpeg = require('fluent-ffmpeg');

async function setupFFmpegPaths() {
  try {
    // En développement, utiliser les packages npm pour les binaires FFmpeg
    if (process.env.NODE_ENV !== 'production') {
      try {
        const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
        const ffprobePath = require('@ffprobe-installer/ffprobe').path;
        
        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpeg.setFfprobePath(ffprobePath);
        
        console.log('✅ FFmpeg configuré automatiquement pour le développement');
        console.log(`   FFmpeg: ${ffmpegPath}`);
        console.log(`   FFprobe: ${ffprobePath}`);
        
        return true;
      } catch (devError) {
        console.warn('⚠️  Packages FFmpeg de développement non trouvés');
        console.log('   Installez avec: npm install --save-dev @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe');
      }
    }

    // Vérifier si FFmpeg est disponible dans le système
    return new Promise((resolve) => {
      ffmpeg()
        .getAvailableFormats((err, formats) => {
          if (err) {
            console.error('❌ FFmpeg non disponible sur le système');
            console.log('   Installez FFmpeg:');
            console.log('   - Ubuntu/Debian: sudo apt-get install ffmpeg');
            console.log('   - CentOS/RHEL: sudo yum install ffmpeg');
            console.log('   - macOS: brew install ffmpeg');
            console.log('   - Windows: https://ffmpeg.org/download.html');
            resolve(false);
          } else {
            console.log('✅ FFmpeg système détecté et fonctionnel');
            resolve(true);
          }
        });
    });

  } catch (error) {
    console.error('❌ Erreur de configuration FFmpeg:', error.message);
    return false;
  }
}

// Auto-configuration si ce script est exécuté directement
if (require.main === module) {
  setupFFmpegPaths().then(success => {
    if (success) {
      console.log('🎬 Configuration FFmpeg terminée avec succès');
    } else {
      console.log('💡 Ajoutez les chemins FFmpeg dans votre .env si nécessaire');
      process.exit(1);
    }
  });
}

module.exports = setupFFmpegPaths;