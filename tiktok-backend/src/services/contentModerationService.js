const video = require('@google-cloud/video-intelligence');
const fs = require('fs').promises;
const path = require('path');

class ContentModerationService {
  constructor() {
    // Initialiser le client Google Cloud Video Intelligence
    this.client = new video.VideoIntelligenceServiceClient({
      // Les credentials peuvent être définies via la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS
      // ou directement via keyFilename si vous avez un fichier de clés
      ...(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && {
        credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      }),
      ...(process.env.GOOGLE_CLOUD_PROJECT_ID && {
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
      })
    });
    
    // Configuration des seuils de modération
    this.moderationConfig = {
      // Seuils de confiance pour bloquer du contenu (0-1)
      adultContentThreshold: 0.7,     // Contenu adulte/pornographique
      violentContentThreshold: 0.8,   // Violence
      racyContentThreshold: 0.6,      // Contenu suggestif
      
      // Types de contenu à vérifier
      enabledFeatures: [
        'EXPLICIT_CONTENT_DETECTION',  // Détection de contenu explicite
        'SAFE_SEARCH_DETECTION'        // Détection SafeSearch
      ]
    };
  }

  /**
   * Modère une vidéo en utilisant Google Cloud Video Intelligence API
   * @param {string} videoPath - Chemin vers le fichier vidéo local
   * @param {Object} options - Options de modération
   * @returns {Promise<Object>} Résultat de la modération
   */
  async moderateVideo(videoPath, options = {}) {
    try {
      console.log(`🛡️ Démarrage de la modération de contenu pour: ${videoPath}`);
      
      // Vérifier que le fichier existe
      await fs.access(videoPath);
      
      // Lire le fichier vidéo
      const videoBytes = await fs.readFile(videoPath);
      
      // Configuration de la requête
      const request = {
        inputContent: videoBytes,
        features: this.moderationConfig.enabledFeatures,
        videoContext: {
          explicitContentDetectionConfig: {
            model: 'builtin/latest'
          }
        }
      };

      console.log(`📊 Analyse du contenu en cours...`);
      
      // Analyser la vidéo
      const [operation] = await this.client.annotateVideo(request);
      console.log(`⏳ Opération lancée: ${operation.name}`);
      
      // Attendre que l'analyse soit terminée
      const [result] = await operation.promise();
      
      console.log(`✅ Analyse terminée, traitement des résultats...`);
      
      // Analyser les résultats
      const moderationResult = this.analyzeResults(result);
      
      console.log(`🛡️ Résultat de la modération:`, {
        isAllowed: moderationResult.isAllowed,
        confidence: moderationResult.confidence,
        detectedIssues: moderationResult.detectedContent
      });
      
      return moderationResult;
      
    } catch (error) {
      console.error('❌ Erreur lors de la modération:', error);
      
      // En cas d'erreur de l'API, on peut choisir d'être permissif ou restrictif
      if (options.failSafe === 'allow') {
        console.log('⚠️ Mode fail-safe: autorisation par défaut');
        return {
          isAllowed: true,
          confidence: 0,
          detectedContent: [],
          warnings: ['Moderation service unavailable'],
          error: error.message
        };
      } else {
        console.log('🚫 Mode fail-safe: blocage par défaut');
        return {
          isAllowed: false,
          confidence: 1,
          detectedContent: ['moderation_error'],
          warnings: ['Moderation service error - content blocked for safety'],
          error: error.message
        };
      }
    }
  }

  /**
   * Analyse les résultats de l'API Google Cloud Video Intelligence
   * @param {Object} result - Résultats de l'API
   * @returns {Object} Résultat de modération structuré
   */
  analyzeResults(result) {
    const moderationResult = {
      isAllowed: true,
      confidence: 0,
      detectedContent: [],
      details: {},
      warnings: []
    };

    try {
      // Analyser la détection de contenu explicite
      if (result.annotationResults && result.annotationResults[0]) {
        const annotations = result.annotationResults[0];
        
        // Vérifier le contenu explicite frame par frame
        if (annotations.explicitAnnotation) {
          const explicitFrames = annotations.explicitAnnotation.frames || [];
          
          let maxAdult = 0;
          let maxViolent = 0;
          let maxRacy = 0;
          
          explicitFrames.forEach(frame => {
            // Convertir les niveaux de probabilité en scores numériques
            const adultScore = this.convertLikelihoodToScore(frame.pornographyLikelihood);
            const violentScore = this.convertLikelihoodToScore(frame.violenceLikelihood);
            const racyScore = this.convertLikelihoodToScore(frame.racyLikelihood || frame.adultLikelihood);
            
            maxAdult = Math.max(maxAdult, adultScore);
            maxViolent = Math.max(maxViolent, violentScore);
            maxRacy = Math.max(maxRacy, racyScore);
          });
          
          // Stocker les détails
          moderationResult.details = {
            adultContent: maxAdult,
            violentContent: maxViolent,
            racyContent: maxRacy,
            totalFramesAnalyzed: explicitFrames.length
          };
          
          // Vérifier les seuils
          if (maxAdult >= this.moderationConfig.adultContentThreshold) {
            moderationResult.isAllowed = false;
            moderationResult.detectedContent.push('adult_content');
            moderationResult.confidence = Math.max(moderationResult.confidence, maxAdult);
          }
          
          if (maxViolent >= this.moderationConfig.violentContentThreshold) {
            moderationResult.isAllowed = false;
            moderationResult.detectedContent.push('violent_content');
            moderationResult.confidence = Math.max(moderationResult.confidence, maxViolent);
          }
          
          if (maxRacy >= this.moderationConfig.racyContentThreshold) {
            moderationResult.isAllowed = false;
            moderationResult.detectedContent.push('racy_content');
            moderationResult.confidence = Math.max(moderationResult.confidence, maxRacy);
          }
        }
        
        // Vérifier SafeSearch si disponible
        if (annotations.safeSearchAnnotation) {
          const safeSearch = annotations.safeSearchAnnotation;
          const adultScore = this.convertLikelihoodToScore(safeSearch.adult);
          const violenceScore = this.convertLikelihoodToScore(safeSearch.violence);
          const racyScore = this.convertLikelihoodToScore(safeSearch.racy);
          
          if (adultScore >= this.moderationConfig.adultContentThreshold) {
            moderationResult.isAllowed = false;
            moderationResult.detectedContent.push('safe_search_adult');
            moderationResult.confidence = Math.max(moderationResult.confidence, adultScore);
          }
          
          if (violenceScore >= this.moderationConfig.violentContentThreshold) {
            moderationResult.isAllowed = false;
            moderationResult.detectedContent.push('safe_search_violence');
            moderationResult.confidence = Math.max(moderationResult.confidence, violenceScore);
          }
          
          if (racyScore >= this.moderationConfig.racyContentThreshold) {
            moderationResult.isAllowed = false;
            moderationResult.detectedContent.push('safe_search_racy');
            moderationResult.confidence = Math.max(moderationResult.confidence, racyScore);
          }
        }
      }
      
    } catch (error) {
      console.error('Erreur lors de l\'analyse des résultats:', error);
      moderationResult.warnings.push('Error analyzing moderation results');
    }
    
    return moderationResult;
  }

  /**
   * Convertit les niveaux de probabilité de Google Cloud en scores numériques
   * @param {string} likelihood - Niveau de probabilité ('VERY_UNLIKELY', 'UNLIKELY', etc.)
   * @returns {number} Score entre 0 et 1
   */
  convertLikelihoodToScore(likelihood) {
    const likelihoodMap = {
      'UNKNOWN': 0,
      'VERY_UNLIKELY': 0,
      'UNLIKELY': 0.2,
      'POSSIBLE': 0.5,
      'LIKELY': 0.8,
      'VERY_LIKELY': 1.0
    };
    
    return likelihoodMap[likelihood] || 0;
  }

  /**
   * Modère une vidéo depuis une URL (pour les vidéos déjà uploadées)
   * @param {string} videoUrl - URL de la vidéo
   * @param {Object} options - Options de modération
   * @returns {Promise<Object>} Résultat de la modération
   */
  async moderateVideoFromUrl(videoUrl, options = {}) {
    try {
      console.log(`🛡️ Modération depuis URL: ${videoUrl}`);
      
      const request = {
        inputUri: videoUrl,
        features: this.moderationConfig.enabledFeatures,
        videoContext: {
          explicitContentDetectionConfig: {
            model: 'builtin/latest'
          }
        }
      };

      const [operation] = await this.client.annotateVideo(request);
      const [result] = await operation.promise();
      
      return this.analyzeResults(result);
      
    } catch (error) {
      console.error('❌ Erreur lors de la modération depuis URL:', error);
      
      if (options.failSafe === 'allow') {
        return {
          isAllowed: true,
          confidence: 0,
          detectedContent: [],
          warnings: ['Moderation service unavailable'],
          error: error.message
        };
      } else {
        return {
          isAllowed: false,
          confidence: 1,
          detectedContent: ['moderation_error'],
          warnings: ['Moderation service error - content blocked for safety'],
          error: error.message
        };
      }
    }
  }

  /**
   * Met à jour la configuration de modération
   * @param {Object} newConfig - Nouvelle configuration
   */
  updateModerationConfig(newConfig) {
    this.moderationConfig = { ...this.moderationConfig, ...newConfig };
    console.log('📝 Configuration de modération mise à jour:', this.moderationConfig);
  }

  /**
   * Obtient les statistiques de modération formatées pour les logs
   * @param {Object} result - Résultat de modération
   * @returns {string} Statistiques formatées
   */
  getModerationStats(result) {
    if (!result.details) return 'Aucun détail disponible';
    
    const { adultContent, violentContent, racyContent, totalFramesAnalyzed } = result.details;
    
    return `Adult: ${(adultContent * 100).toFixed(1)}%, Violence: ${(violentContent * 100).toFixed(1)}%, Racy: ${(racyContent * 100).toFixed(1)}% (${totalFramesAnalyzed} frames)`;
  }
}

module.exports = new ContentModerationService(); 