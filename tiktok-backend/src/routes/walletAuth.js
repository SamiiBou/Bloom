const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { verifySiweMessage } = require('@worldcoin/minikit-js');
const User = require('../models/User');
const router = express.Router();

// Store pour les nonces (en production, utilise Redis ou une DB)
const nonceStore = new Map();

// Nettoyer les anciens nonces (expiration après 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of nonceStore.entries()) {
    if (now - timestamp > 5 * 60 * 1000) { // 5 minutes
      nonceStore.delete(nonce);
    }
  }
}, 60 * 1000); // Nettoyer chaque minute

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

// Fonction pour nettoyer le nom d'utilisateur
const sanitizeUsername = (username) => {
  if (!username) return null;
  
  // Remplacer les caractères non autorisés par des underscores
  // Le regex autorise seulement lettres, chiffres et underscores
  const sanitized = username.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // S'assurer que le nom fait au moins 3 caractères
  if (sanitized.length < 3) {
    return `user_${sanitized}_${Date.now().toString().slice(-4)}`;
  }
  
  // S'assurer que le nom ne dépasse pas 30 caractères
  return sanitized.slice(0, 30);
};

// Fonction pour générer un nom d'utilisateur unique
const generateUniqueUsername = async (baseUsername, walletAddress) => {
  if (!baseUsername) {
    // Fallback: utiliser l'adresse wallet
    baseUsername = `user_${walletAddress.slice(2, 8)}`;
  }
  
  let uniqueUsername = baseUsername;
  let counter = 1;
  
  // Vérifier si le nom d'utilisateur existe déjà
  while (await User.findOne({ username: uniqueUsername })) {
    // Si le nom existe, ajouter un numéro
    const suffix = `_${counter}`;
    const maxBaseLength = 30 - suffix.length;
    uniqueUsername = baseUsername.slice(0, maxBaseLength) + suffix;
    counter++;
    
    // Éviter une boucle infinie
    if (counter > 999) {
      uniqueUsername = `user_${Date.now().toString().slice(-8)}`;
      break;
    }
  }
  
  return uniqueUsername;
};

// GET /api/wallet/nonce - Générer un nonce pour l'authentification
router.get('/nonce', (req, res) => {
  console.log('📡 Requête nonce reçue');
  console.log('📡 Headers:', req.headers);
  console.log('📡 Origin:', req.get('origin'));
  
  try {
    // Générer un nonce de 8+ caractères alphanumériques
    const nonce = crypto.randomUUID().replace(/-/g, '');
    console.log('✅ Nonce généré:', nonce);
    
    // Stocker le nonce avec timestamp
    nonceStore.set(nonce, Date.now());
    console.log('✅ Nonce stocké dans le store');
    
    // Pour ngrok/cross-origin, on utilise aussi un cookie en backup
    res.cookie('siwe', nonce, {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 5 * 60 * 1000, // 5 minutes
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Important pour ngrok
    });
    
    console.log('✅ Cookie nonce défini');
    
    res.json({ 
      nonce,
      timestamp: Date.now(),
      expires: Date.now() + 5 * 60 * 1000
    });
    
  } catch (error) {
    console.error('❌ Erreur génération nonce:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate nonce',
      error: error.message
    });
  }
});

// POST /api/wallet/complete-siwe - Vérifier l'authentification SIWE
router.post('/complete-siwe', async (req, res) => {
  console.log('📡 Requête vérification SIWE reçue');
  console.log('📡 Body:', req.body);
  console.log('📡 Cookies reçus:', req.cookies);
  
  try {
    const { payload, nonce, minikitUserData } = req.body;
    
    if (!payload || !nonce) {
      console.log('❌ Payload ou nonce manquant');
      return res.status(400).json({
        status: 'error',
        isValid: false,
        message: 'Payload et nonce requis'
      });
    }
    
    // Vérifier le nonce dans le store ET dans les cookies
    const storedTimestamp = nonceStore.get(nonce);
    const cookieNonce = req.cookies.siwe;
    
    console.log('🔍 Nonce dans store:', !!storedTimestamp);
    console.log('🔍 Nonce dans cookie:', cookieNonce);
    console.log('🔍 Nonce reçu:', nonce);
    
    // Vérifier que le nonce existe (store OU cookie) et n'est pas expiré
    const isNonceValid = storedTimestamp || (cookieNonce === nonce);
    const isNotExpired = storedTimestamp ? (Date.now() - storedTimestamp < 5 * 60 * 1000) : true;
    
    if (!isNonceValid || !isNotExpired) {
      console.log('❌ Nonce invalide ou expiré');
      console.log('Valid:', isNonceValid, 'Not expired:', isNotExpired);
      return res.status(400).json({
        status: 'error',
        isValid: false,
        message: 'Invalid or expired nonce'
      });
    }
    
    console.log('✅ Nonce valide, vérification signature...');
    
    // Vérifier le message SIWE
    const validMessage = await verifySiweMessage(payload, nonce);
    console.log('✅ Résultat vérification:', validMessage);
    
    if (validMessage.isValid) {
      // Nettoyer le nonce après utilisation
      nonceStore.delete(nonce);
      res.clearCookie('siwe');
      
      console.log('✅ Authentification réussie pour:', payload.address);
      console.log('📋 Données MiniKit reçues:', minikitUserData);
      
      // Créer ou mettre à jour l'utilisateur avec les données MiniKit
      const walletAddress = payload.address.toLowerCase();
      
      // Préparer les données utilisateur
      const userData = {
        walletAddress,
        lastLogin: new Date(),
        authMethod: 'wallet',
        lastWalletSignature: payload.signature,
      };
      
      // Ajouter les données MiniKit si disponibles
      if (minikitUserData) {
        console.log('🔍 Traitement des données MiniKit:', minikitUserData);
        
        if (minikitUserData.username) {
          userData.minikitUsername = minikitUserData.username;
          // Utiliser le username MiniKit comme username principal s'il n'existe pas
          const sanitizedUsername = sanitizeUsername(minikitUserData.username);
          userData.username = await generateUniqueUsername(sanitizedUsername, walletAddress);
          userData.displayName = sanitizedUsername; // Garder le nom original comme displayName
        }
        
        if (minikitUserData.userId) {
          userData.minikitUserId = minikitUserData.userId;
        }
        
        if (minikitUserData.profilePicture) {
          userData.minikitProfilePicture = minikitUserData.profilePicture;
          userData.avatar = minikitUserData.profilePicture;
        }
        
        if (minikitUserData.verificationLevel) {
          userData.minikitVerificationLevel = minikitUserData.verificationLevel;
          userData.verified = minikitUserData.verificationLevel === 'orb';
        }
        
        if (minikitUserData.nullifierHash) {
          userData.worldIdNullifierHash = minikitUserData.nullifierHash;
        }
      }
      
      // Si pas de username MiniKit, générer un username basé sur l'adresse wallet
      if (!userData.username) {
        userData.username = await generateUniqueUsername(null, walletAddress);
        userData.displayName = userData.username;
      }
      
      console.log('💾 Données utilisateur à sauvegarder:', userData);
      
      try {
        // Chercher l'utilisateur existant ou en créer un nouveau
        let user = await User.findOne({ walletAddress });
        
        if (user) {
          console.log('👤 Utilisateur existant trouvé:', user._id);
          // Mettre à jour les données existantes
          Object.assign(user, userData);
          await user.save();
          console.log('✅ Utilisateur mis à jour avec succès');
          
          // Generate JWT token for API authentication
          const token = generateToken(user._id);
          
          res.json({
            status: 'success',
            isValid: true,
            data: {
              token,
              user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName,
                walletAddress: user.walletAddress,
                avatar: user.avatar,
                verified: user.verified,
                authMethod: user.authMethod,
                minikitProfile: user.getMiniKitProfile(),
                publicProfile: user.getPublicProfile()
              }
            }
          });
          
        } else {
          console.log('👤 Création d\'un nouvel utilisateur');
          user = new User(userData);
          await user.save();
          console.log('✅ Nouvel utilisateur créé avec succès');
          
          // Generate JWT token for API authentication
          const token = generateToken(user._id);
          
          res.json({
            status: 'success',
            isValid: true,
            data: {
              token,
              user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName,
                walletAddress: user.walletAddress,
                avatar: user.avatar,
                verified: user.verified,
                authMethod: user.authMethod,
                minikitProfile: user.getMiniKitProfile(),
                publicProfile: user.getPublicProfile()
              }
            }
          });
        }
        
      } catch (dbError) {
        console.error('❌ Erreur base de données:', dbError);
        
        // Si erreur de duplication, essayer de récupérer l'utilisateur existant
        if (dbError.code === 11000) {
          console.log('🔄 Tentative de récupération utilisateur existant...');
          const existingUser = await User.findOne({ walletAddress });
          if (existingUser) {
            console.log('✅ Utilisateur existant récupéré');
            
            // Generate JWT token for API authentication
            const token = generateToken(existingUser._id);
            
            res.json({
              status: 'success',
              isValid: true,
              data: {
                token,
                user: {
                  id: existingUser._id,
                  username: existingUser.username,
                  displayName: existingUser.displayName,
                  walletAddress: existingUser.walletAddress,
                  avatar: existingUser.avatar,
                  verified: existingUser.verified,
                  authMethod: existingUser.authMethod,
                  minikitProfile: existingUser.getMiniKitProfile(),
                  publicProfile: existingUser.getPublicProfile()
                }
              }
            });
            return;
          }
        }
        
        throw dbError;
      }
      
    } else {
      console.log('❌ Signature invalide');
      res.status(400).json({
        status: 'error',
        isValid: false,
        message: 'Invalid signature',
        details: validMessage
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur vérification SIWE:', error);
    res.status(500).json({
      status: 'error',
      isValid: false,
      message: error.message || 'Verification failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/wallet/profile - Obtenir le profil utilisateur connecté
router.get('/profile', async (req, res) => {
  try {
    // Cette route nécessiterait un middleware d'authentification
    // Pour l'instant, on retourne juste des stats
    const totalUsers = await User.countDocuments();
    const walletUsers = await User.countDocuments({ authMethod: 'wallet' });
    
    res.json({
      status: 'success',
      message: 'Profile endpoint - implement authentication middleware',
      stats: {
        totalUsers,
        walletUsers,
        nonceStoreSize: nonceStore.size
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;