const express = require('express');
const fetch = require('node-fetch');
const { bunnyConfig } = require('../config/bunny');
const router = express.Router();

// Route proxy pour les fichiers Bunny CDN
router.get('/file/*', async (req, res) => {
  try {
    const filePath = req.params[0]; // Récupérer le chemin après /file/
    
    console.log('🐰 Proxy request for file:', filePath);
    
    // Construire l'URL CDN Bunny
    const cdnUrl = bunnyConfig.getCdnUrl(filePath);
    
    console.log('🌐 Fetching from Bunny CDN:', cdnUrl);
    
    // Récupérer le fichier depuis Bunny CDN
    const response = await fetch(cdnUrl);
    
    if (!response.ok) {
      console.log('❌ Failed to fetch file:', response.status);
      return res.status(response.status).json({ error: 'File not found' });
    }
    
    // Définir les en-têtes appropriés
    res.set({
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400', // Cache 24h
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': '*'
    });
    
    // Streamer le fichier
    response.body.pipe(res);
    
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
});

// Route proxy pour les images Bunny CDN (legacy compatibility)
router.get('/image/*', async (req, res) => {
  try {
    const imagePath = req.params[0]; // Récupérer le chemin après /image/
    
    console.log('🖼️ Proxy request for image:', imagePath);
    
    // Si c'est déjà une URL complète Bunny CDN, la rediriger directement
    if (imagePath.includes('b-cdn.net')) {
      return res.redirect(imagePath);
    }
    
    // Construire l'URL CDN Bunny pour l'image
    const cdnUrl = bunnyConfig.getCdnUrl(`images/${imagePath}`);
    
    console.log('🌐 Fetching image from Bunny CDN:', cdnUrl);
    
    // Récupérer l'image depuis Bunny CDN
    const response = await fetch(cdnUrl);
    
    if (!response.ok) {
      console.log('❌ Failed to fetch image:', response.status);
      return res.status(response.status).json({ error: 'Image not found' });
    }
    
    // Définir les en-têtes appropriés pour les images
    res.set({
      'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400', // Cache 24h
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': '*'
    });
    
    // Streamer l'image
    response.body.pipe(res);
    
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
});

module.exports = router; 