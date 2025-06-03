const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

class ImageModerationService {
  constructor() {
    // Configuration OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Configuration des seuils de modération
    this.moderationConfig = {
      // Seuils pour différents types de contenu (0-1, plus haut = plus strict)
      harassment: parseFloat(process.env.MODERATION_HARASSMENT_THRESHOLD) || 0.7,
      harassmentThreatening: parseFloat(process.env.MODERATION_HARASSMENT_THREATENING_THRESHOLD) || 0.8,
      hate: parseFloat(process.env.MODERATION_HATE_THRESHOLD) || 0.7,
      hateThreatening: parseFloat(process.env.MODERATION_HATE_THREATENING_THRESHOLD) || 0.8,
      selfHarm: parseFloat(process.env.MODERATION_SELF_HARM_THRESHOLD) || 0.7,
      selfHarmIntent: parseFloat(process.env.MODERATION_SELF_HARM_INTENT_THRESHOLD) || 0.8,
      selfHarmInstructions: parseFloat(process.env.MODERATION_SELF_HARM_INSTRUCTIONS_THRESHOLD) || 0.8,
      sexual: parseFloat(process.env.MODERATION_SEXUAL_THRESHOLD) || 0.7,
      sexualMinors: parseFloat(process.env.MODERATION_SEXUAL_MINORS_THRESHOLD) || 0.3, // Plus strict
      violence: parseFloat(process.env.MODERATION_VIOLENCE_THRESHOLD) || 0.7,
      violenceGraphic: parseFloat(process.env.MODERATION_VIOLENCE_GRAPHIC_THRESHOLD) || 0.8
    };

    console.log('🛡️ Image Moderation Service initialized with OpenAI');
    console.log('⚙️ Moderation thresholds:', this.moderationConfig);
  }

  /**
   * Modérer une image depuis un fichier local
   */
  async moderateImageFromFile(imagePath, options = {}) {
    try {
      console.log(`🔍 Analyzing image file: ${path.basename(imagePath)}`);

      // Lire le fichier et le convertir en base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(imagePath);
      
      return await this.moderateImageFromBase64(base64Image, mimeType, options);
      
    } catch (error) {
      console.error('❌ Error moderating image from file:', error);
      return this.handleModerationError(error, options);
    }
  }

  /**
   * Modérer une image depuis une URL
   */
  async moderateImageFromUrl(imageUrl, options = {}) {
    try {
      console.log(`🔍 Analyzing image from URL: ${imageUrl}`);

      // Utiliser GPT-4 Vision pour analyser l'image et générer une description
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyser cette image et décrire son contenu de manière détaillée. Mentionner spécifiquement s'il y a du contenu explicite, violent, inapproprié ou concernant des mineurs."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 300
      });

      const description = response.choices[0].message.content;
      
      // Maintenant utiliser l'API de modération sur la description
      const moderationResponse = await this.openai.moderations.create({
        input: description
      });

      return this.processOpenAIModerationResult(moderationResponse, options, description);
      
    } catch (error) {
      console.error('❌ Error moderating image from URL:', error);
      return this.handleModerationError(error, options);
    }
  }

  /**
   * Modérer une image depuis des données base64
   */
  async moderateImageFromBase64(base64Data, mimeType, options = {}) {
    try {
      console.log(`🔍 Analyzing image from base64 data (${mimeType})`);

      // Créer l'URL data
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      // Utiliser GPT-4 Vision pour analyser l'image
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyser cette image et décrire son contenu de manière détaillée. Mentionner spécifiquement s'il y a du contenu explicite, violent, inapproprié ou concernant des mineurs."
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 300
      });

      const description = response.choices[0].message.content;
      
      // Maintenant utiliser l'API de modération sur la description
      const moderationResponse = await this.openai.moderations.create({
        input: description
      });

      return this.processOpenAIModerationResult(moderationResponse, options, description);
      
    } catch (error) {
      console.error('❌ Error moderating image from base64:', error);
      return this.handleModerationError(error, options);
    }
  }

  /**
   * Traiter les résultats de OpenAI Moderation
   */
  processOpenAIModerationResult(response, options = {}, description = '') {
    const result = response.results[0];
    const categories = result.categories;
    const categoryScores = result.category_scores;

    console.log('📊 OpenAI Moderation result:', {
      flagged: result.flagged,
      categories: categories,
      scores: categoryScores
    });

    // Analyser chaque catégorie par rapport aux seuils
    const detectedContent = [];
    const warnings = [];
    let highestScore = 0;
    let overallScore = 0;

    const categoryChecks = [
      { key: 'harassment', threshold: this.moderationConfig.harassment, label: 'Harcèlement' },
      { key: 'harassment/threatening', threshold: this.moderationConfig.harassmentThreatening, label: 'Menaces' },
      { key: 'hate', threshold: this.moderationConfig.hate, label: 'Discours haineux' },
      { key: 'hate/threatening', threshold: this.moderationConfig.hateThreatening, label: 'Discours haineux avec menaces' },
      { key: 'self-harm', threshold: this.moderationConfig.selfHarm, label: 'Automutilation' },
      { key: 'self-harm/intent', threshold: this.moderationConfig.selfHarmIntent, label: 'Intention d\'automutilation' },
      { key: 'self-harm/instructions', threshold: this.moderationConfig.selfHarmInstructions, label: 'Instructions d\'automutilation' },
      { key: 'sexual', threshold: this.moderationConfig.sexual, label: 'Contenu sexuel' },
      { key: 'sexual/minors', threshold: this.moderationConfig.sexualMinors, label: 'Contenu sexuel impliquant des mineurs' },
      { key: 'violence', threshold: this.moderationConfig.violence, label: 'Violence' },
      { key: 'violence/graphic', threshold: this.moderationConfig.violenceGraphic, label: 'Violence graphique' }
    ];

    // Vérifier chaque catégorie
    for (const check of categoryChecks) {
      const score = categoryScores[check.key] || 0;
      const flagged = categories[check.key] || false;
      
      if (score > highestScore) {
        highestScore = score;
      }
      
      overallScore += score;

      if (flagged || score > check.threshold) {
        detectedContent.push(check.label);
        console.log(`🚨 Detected: ${check.label} (score: ${(score * 100).toFixed(1)}%, threshold: ${(check.threshold * 100).toFixed(1)}%)`);
      } else if (score > check.threshold * 0.7) { // Warning à 70% du seuil
        warnings.push(`${check.label}: ${(score * 100).toFixed(1)}%`);
      }
    }

    // Calculer la confiance globale
    const confidence = Math.min(highestScore * 2, 1); // Amplifier le score le plus élevé

    // Déterminer si l'image est autorisée
    const isAllowed = detectedContent.length === 0 && !result.flagged;

    const moderationResult = {
      isAllowed,
      confidence,
      detectedContent,
      warnings,
      moderationService: 'openai-moderation',
      details: {
        flagged: result.flagged,
        categories: categories,
        categoryScores: categoryScores,
        overallScore: overallScore / categoryChecks.length,
        highestScore,
        imageDescription: description
      }
    };

    console.log(`🛡️ Image moderation result: ${isAllowed ? 'APPROVED' : 'REJECTED'} (confidence: ${(confidence * 100).toFixed(1)}%)`);
    
    return moderationResult;
  }

  /**
   * Gérer les erreurs de modération
   */
  handleModerationError(error, options = {}) {
    const failSafe = options.failSafe || 'block'; // 'allow', 'block', ou 'review'
    
    console.error('❌ Moderation error:', error.message);

    // En cas d'erreur, retourner un résultat basé sur la stratégie fail-safe
    switch (failSafe) {
      case 'allow':
        return {
          isAllowed: true,
          confidence: 0,
          detectedContent: [],
          warnings: [`Erreur de modération: ${error.message}`],
          error: error.message,
          moderationService: 'openai-moderation'
        };
      
      case 'review':
        return {
          isAllowed: false,
          confidence: 0,
          detectedContent: ['moderation_error'],
          warnings: [`Erreur de modération: ${error.message}`],
          error: error.message,
          moderationService: 'openai-moderation'
        };
      
      default: // 'block'
        return {
          isAllowed: false,
          confidence: 1,
          detectedContent: ['moderation_error'],
          warnings: [`Erreur de modération: ${error.message}`],
          error: error.message,
          moderationService: 'openai-moderation'
        };
    }
  }

  /**
   * Obtenir le type MIME depuis le chemin du fichier
   */
  getMimeTypeFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.svg': 'image/svg+xml'
    };
    
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Vérifier la configuration
   */
  checkConfiguration() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    console.log('✅ OpenAI Image Moderation configuration is valid');
    return true;
  }
}

// Export singleton instance
module.exports = new ImageModerationService(); 