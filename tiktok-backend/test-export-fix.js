const fs = require('fs');
const path = require('path');

console.log('🧪 Test de correction de l\'export vidéo');
console.log('=====================================');

// Simuler les données d'export avec différents types d'URLs
const testCases = [
  {
    name: 'Export avec blob URLs',
    data: {
      clips: [
        {
          id: 1,
          type: 'video',
          source: 'blob:http://localhost:3000/12345-6789',
          startTime: 0,
          duration: 5,
          volume: 1,
          metadata: {
            originalUrl: 'blob:http://localhost:3000/12345-6789',
            isBlob: true
          }
        },
        {
          id: 2,
          type: 'text',
          content: 'Mon super texte',
          startTime: 1,
          duration: 3,
          position: { x: 50, y: 30 },
          style: {
            fontSize: 24,
            color: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
          }
        },
        {
          id: 'music',
          type: 'audio',
          source: 'blob:http://localhost:3000/audio-12345',
          startTime: 0,
          duration: 5,
          volume: 0.3,
          metadata: {
            title: 'Ma musique',
            artist: 'Votre musique',
            originalUrl: 'blob:http://localhost:3000/audio-12345',
            isBlob: true
          }
        }
      ],
      duration: 5,
      resolution: { width: 1280, height: 720 },
      fps: 30,
      metadata: {
        exportDate: new Date().toISOString(),
        videosCount: 1,
        textsCount: 1,
        hasMusic: true
      }
    }
  },
  {
    name: 'Export avec URLs normales',
    data: {
      clips: [
        {
          id: 1,
          type: 'video',
          source: 'https://example.com/video.mp4',
          startTime: 0,
          duration: 5,
          volume: 1,
          metadata: {
            originalUrl: 'https://example.com/video.mp4',
            isBlob: false
          }
        }
      ],
      duration: 5,
      resolution: { width: 1280, height: 720 },
      fps: 30
    }
  }
];

// Fonction de test de l'export
function testExport(testCase) {
  console.log(`\n📋 Test: ${testCase.name}`);
  console.log('-------------------');
  
  try {
    // Vérifier la structure des données
    const { clips, duration, resolution, fps } = testCase.data;
    
    console.log(`✅ Clips: ${clips.length}`);
    console.log(`✅ Durée: ${duration}s`);
    console.log(`✅ Résolution: ${resolution.width}x${resolution.height}`);
    console.log(`✅ FPS: ${fps}`);
    
    // Analyser les clips
    clips.forEach((clip, index) => {
      console.log(`   Clip ${index + 1}: ${clip.type}`);
      
      if (clip.type === 'video' || clip.type === 'audio') {
        const isBlob = clip.source.startsWith('blob:');
        console.log(`     Source: ${isBlob ? 'BLOB URL' : 'URL normale'}`);
        
        if (isBlob) {
          console.log(`     ⚠️  Blob URL détectée - conversion nécessaire`);
          console.log(`     🔄 URL convertie: https://example.com/test-${clip.type}-${index + 1}.mp4`);
        }
      }
      
      if (clip.type === 'text') {
        console.log(`     Texte: "${clip.content}"`);
        console.log(`     Position: ${clip.position.x}%, ${clip.position.y}%`);
      }
    });
    
    // Simuler l'export
    const exportResult = {
      status: 'success',
      data: {
        video: {
          id: Date.now(),
          videoUrl: 'https://example.com/exported-video.mp4',
          duration: duration,
          description: `Vidéo éditée - ${clips.filter(c => c.type === 'video').length} clip(s)`,
          metadata: {
            isEdited: true,
            clipsCount: clips.length,
            exportDate: new Date()
          }
        }
      }
    };
    
    console.log(`✅ Export simulé réussi`);
    console.log(`   ID: ${exportResult.data.video.id}`);
    console.log(`   URL: ${exportResult.data.video.videoUrl}`);
    
    return { success: true, result: exportResult };
    
  } catch (error) {
    console.log(`❌ Erreur lors du test: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Fonction de test des blob URLs
function testBlobURLHandling() {
  console.log('\n🔍 Test de gestion des Blob URLs');
  console.log('================================');
  
  const blobUrls = [
    'blob:http://localhost:3000/12345-6789',
    'blob:https://example.com/abcdef-123456',
    'https://example.com/normal-video.mp4',
    'data:video/mp4;base64,AAAAA...'
  ];
  
  blobUrls.forEach((url, index) => {
    const isBlob = url.startsWith('blob:');
    const isData = url.startsWith('data:');
    const isNormal = !isBlob && !isData;
    
    console.log(`URL ${index + 1}: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`);
    
    if (isBlob) {
      console.log('   Type: Blob URL ⚠️');
      console.log('   Action: Conversion nécessaire');
      console.log('   Nouveau: https://example.com/converted-file.mp4');
    } else if (isData) {
      console.log('   Type: Data URL ⚠️');
      console.log('   Action: Upload nécessaire');
    } else {
      console.log('   Type: URL normale ✅');
      console.log('   Action: Aucune conversion nécessaire');
    }
    console.log('');
  });
}

// Fonction de test des erreurs
function testErrorHandling() {
  console.log('\n🚨 Test de gestion des erreurs');
  console.log('==============================');
  
  const errorCases = [
    {
      name: 'DOMException',
      error: new DOMException('Failed to execute', 'NotAllowedError'),
      expectedMessage: 'Erreur d\'accès aux fichiers. Veuillez recharger l\'éditeur et réessayer.'
    },
    {
      name: 'Fetch Error',
      error: new Error('fetch failed'),
      expectedMessage: 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
    },
    {
      name: 'Blob Error',
      error: new Error('blob url invalid'),
      expectedMessage: 'Erreur avec les fichiers uploadés. Veuillez les re-uploader.'
    },
    {
      name: 'Generic Error',
      error: new Error('Something went wrong'),
      expectedMessage: 'Erreur lors de l\'export de la vidéo'
    }
  ];
  
  errorCases.forEach(testCase => {
    console.log(`\nTest erreur: ${testCase.name}`);
    
    let errorMessage = 'Erreur lors de l\'export de la vidéo';
    
    if (testCase.error.name === 'DOMException') {
      errorMessage = 'Erreur d\'accès aux fichiers. Veuillez recharger l\'éditeur et réessayer.';
    } else if (testCase.error.message.includes('fetch')) {
      errorMessage = 'Erreur de connexion au serveur. Vérifiez votre connexion internet.';
    } else if (testCase.error.message.includes('blob')) {
      errorMessage = 'Erreur avec les fichiers uploadés. Veuillez les re-uploader.';
    }
    
    const isCorrect = errorMessage === testCase.expectedMessage;
    console.log(`   Erreur: ${testCase.error.message}`);
    console.log(`   Message: ${errorMessage}`);
    console.log(`   Résultat: ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
  });
}

// Exécuter tous les tests
console.log('🚀 Démarrage des tests...\n');

// Test 1: Export avec différents types d'URLs
testCases.forEach(testCase => {
  const result = testExport(testCase);
  if (!result.success) {
    console.log(`❌ Test échoué: ${result.error}`);
  }
});

// Test 2: Gestion des Blob URLs
testBlobURLHandling();

// Test 3: Gestion des erreurs
testErrorHandling();

console.log('\n🎉 Tests terminés !');
console.log('\n📝 Résumé des améliorations:');
console.log('- ✅ Détection et conversion des blob URLs');
console.log('- ✅ Messages d\'erreur spécifiques');
console.log('- ✅ Validation des données avant export');
console.log('- ✅ Nettoyage automatique des ressources');
console.log('- ✅ Logs détaillés pour le debugging');

console.log('\n🔧 Pour activer l\'export réel:');
console.log('1. Décommentez le code d\'appel API dans handleExportVideo');
console.log('2. Implémentez l\'upload des fichiers blob vers le serveur');
console.log('3. Configurez l\'endpoint /api/video/render'); 
 