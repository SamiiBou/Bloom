require('dotenv').config();
const AWS = require('aws-sdk');

// Configuration AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function setupCORS() {
  try {
    console.log('🔧 Configuration des règles CORS pour le bucket S3...');
    console.log('📦 Bucket:', process.env.AWS_S3_BUCKET_NAME);

    const corsConfiguration = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [
              'http://localhost:3000',
              'https://localhost:3000',
              'https://bloom-3n1v.vercel.app',
              'https://*.ngrok.app',
              'https://*.ngrok.io'
            ],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3000,
            ExposeHeaders: ['ETag', 'Content-Length']
          },
          {
            // Règle plus permissive pour les images
            AllowedOrigins: ['*'],
            AllowedMethods: ['GET'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3000
          }
        ]
      }
    };

    console.log('📋 Configuration CORS:', JSON.stringify(corsConfiguration, null, 2));

    await s3.putBucketCors(corsConfiguration).promise();
    
    console.log('✅ Configuration CORS appliquée avec succès !');
    
    // Vérifier la configuration
    console.log('\n🔍 Vérification de la configuration CORS...');
    const currentCors = await s3.getBucketCors({
      Bucket: process.env.AWS_S3_BUCKET_NAME
    }).promise();
    
    console.log('📊 Configuration CORS actuelle:', JSON.stringify(currentCors, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration CORS:', error);
    
    if (error.code === 'NoSuchCORSConfiguration') {
      console.log('ℹ️ Aucune configuration CORS existante trouvée (normal pour un nouveau bucket)');
    }
  }
}

setupCORS(); 