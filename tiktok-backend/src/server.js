// Charger les variables d'environnement en premier
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

// Connexion à la base de données
connectDB();

const app = express();

// IMPORTANT: Configurer trust proxy AVANT d'utiliser rate limiting
app.set('trust proxy', 1); // Important pour ngrok et les proxies

// Liste des origines autorisées
const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  process.env.FRONTEND_URL,
  // Permettre tous les domaines ngrok pour le développement
  /https:\/\/.*\.ngrok\.app$/,
  /https:\/\/.*\.ngrok\.io$/
];

// Console.log des domaines autorisés au démarrage
console.log('🌐 Domaines CORS autorisés:');
allowedOrigins.forEach((origin, index) => {
  if (typeof origin === 'string') {
    console.log(`  ${index + 1}. ${origin || 'undefined'}`);
  } else if (origin instanceof RegExp) {
    console.log(`  ${index + 1}. ${origin.toString()} (RegExp)`);
  }
});
console.log(`📝 FRONTEND_URL depuis .env: ${process.env.FRONTEND_URL || 'non défini'}`);
console.log('---');

// Configuration CORS pour ngrok
const corsOptions = {
  origin: function (origin, callback) {
    // Permettre les requêtes sans origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ Origin non autorisée:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Important pour les cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting (maintenant que trust proxy est configuré)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par windowMs
  message: 'Trop de requêtes depuis cette IP, réessayez plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    trustProxy: app.get('trust proxy'),
    // Debug des variables d'environnement AWS (sans exposer les clés secrètes)
    awsConfig: {
      region: process.env.AWS_REGION,
      bucketName: process.env.AWS_S3_BUCKET_NAME,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
    }
  });
});

// Routes API - AJOUT DE TOUTES LES ROUTES MANQUANTES
app.use('/api/wallet', require('./routes/walletAuth'));
app.use('/api/auth', require('./routes/auth'));           // Routes d'authentification
app.use('/api/upload', require('./routes/upload'));       // Routes d'upload
app.use('/api/videos', require('./routes/videos'));       // Routes des vidéos
app.use('/api/users', require('./routes/users'));         // Routes des utilisateurs
app.use('/api/ai', require('./routes/ai'));               // Routes IA Runway
app.use('/api/video', require('./routes/video'));
app.use('/api/images', require('./routes/images')); // Nouvelle route pour les images
app.use('/api/airdrop', require('./routes/airdrop').router); // Routes airdrop
app.use('/api/moderation', require('./routes/moderation')); // Routes de modération de contenu

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  
  // Erreur CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      status: 'error',
      message: 'CORS: Origin non autorisée',
      origin: req.get('Origin')
    });
  }

  // Autres erreurs
  res.status(500).json({
    status: 'error',
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route non trouvée',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📱 TikTok Backend API ready at http://localhost:${PORT}`);
  console.log(`🏥 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔒 Trust proxy configured: ${app.get('trust proxy')}`);
  
  // Rappel des domaines autorisés au démarrage final
  console.log('\n🔐 Récapitulatif CORS - Domaines autorisés:');
  allowedOrigins.forEach((origin, index) => {
    if (typeof origin === 'string') {
      console.log(`  ✅ ${origin || 'undefined'}`);
    } else if (origin instanceof RegExp) {
      console.log(`  ✅ ${origin.toString()} (pattern)`);
    }
  });
  console.log('');
});

module.exports = app;