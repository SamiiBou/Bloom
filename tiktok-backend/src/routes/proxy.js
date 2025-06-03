const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Route proxy pour les images S3
router.get('/image/*', async (req, res) => {
  try {
    const imageUrl = req.params[0]; // Récupérer l'URL après /image/
    
    console.log('🖼️ Proxy request for image:', imageUrl);
    
    // Vérifier que l'URL est bien de notre bucket S3
    if (!imageUrl.includes('hollywoodtok.s3.amazonaws.com')) {
      return res.status(400).json({ error: 'Invalid image URL' });
    }
    
    // Récupérer l'image depuis S3
    const response = await fetch(`https://${imageUrl}`);
    
    if (!response.ok) {
      console.log('❌ Failed to fetch image:', response.status);
      return res.status(response.status).json({ error: 'Image not found' });
    }
    
    // Définir les en-têtes appropriés
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