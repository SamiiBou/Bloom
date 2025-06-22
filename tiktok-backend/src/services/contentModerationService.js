const video = require('@google-cloud/video-intelligence');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

class ContentModerationService {
  constructor() {
    // Vérifier si Google Cloud est configuré
    this.isGoogleCloudConfigured = this.checkGoogleCloudConfiguration();
    this.tempCredentialsFile = null;
    
    if (this.isGoogleCloudConfigured) {
      try {
        // Préparer les options du client
        const clientOptions = {};
        
        // Gérer les credentials
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
          // Si on a les credentials en JSON, les utiliser directement
          try {
            clientOptions.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
          } catch (parseError) {
            console.error('❌ Erreur lors du parsing des credentials JSON:', parseError.message);
            throw parseError;
          }
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          // Vérifier si c'est un chemin de fichier ou du JSON
          const credValue = process.env.GOOGLE_APPLICATION_CREDENTIALS;
          
          // Si ça commence par '{', c'est probablement du JSON
          if (credValue.trim().startsWith('{')) {
            try {
              // Créer un fichier temporaire avec les credentials
              const tempDir = os.tmpdir();
              this.tempCredentialsFile = path.join(tempDir, `google-creds-${Date.now()}.json`);
              
              // Écrire les credentials dans le fichier temporaire (version synchrone)
              fsSync.writeFileSync(this.tempCredentialsFile, credValue, 'utf8');
              
              // Mettre à jour la variable d'environnement pour pointer vers le fichier
              process.env.GOOGLE_APPLICATION_CREDENTIALS = this.tempCredentialsFile;
              
              console.log('✅ Fichier de credentials temporaire créé');
            } catch (fileError) {
              console.error('❌ Erreur lors de la création du fichier de credentials:', fileError.message);
              // Essayer de parser le JSON directement
              try {
                clientOptions.credentials = JSON.parse(credValue);
              } catch (parseError) {
                throw new Error('Impossible de traiter les credentials Google Cloud');
              }
            }
          }
          // Sinon, c'est déjà un chemin de fichier, rien à faire
        }
        
        // Ajouter le project ID si disponible
        if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
          clientOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        }
        
        // Initialiser le client Google Cloud Video Intelligence
        this.client = new video.VideoIntelligenceServiceClient(clientOptions);
        console.log('✅ Google Cloud Video Intelligence configuré et prêt');
      } catch (error) {
        console.warn('⚠️ Erreur lors de l\'initialisation de Google Cloud:', error.message);
        this.isGoogleCloudConfigured = false;
        // Nettoyer le fichier temporaire si créé
        this.cleanupTempFile();
      }
    } else {
      console.log('⚠️ Google Cloud Video Intelligence non configuré - Modération de fallback activée');
    }
    
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
    
    // Nettoyer le fichier temporaire quand le processus se termine
    if (this.tempCredentialsFile) {
      process.on('exit', () => this.cleanupTempFile());
      process.on('SIGINT', () => this.cleanupTempFile());
      process.on('SIGTERM', () => this.cleanupTempFile());
      process.on('uncaughtException', () => this.cleanupTempFile());
    }
  }

  /**
   * Vérifie si Google Cloud est configuré
   * @returns {boolean} True si configuré
   */
  checkGoogleCloudConfiguration() {
    const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                          process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const hasProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    
    console.log('🔍 Vérification de la configuration Google Cloud:', {
      hasCredentials: !!hasCredentials,
      hasProjectId: !!hasProjectId
    });
    
    return !!(hasCredentials || hasProjectId);
  }

  /**
   * Modération de fallback - approuve automatiquement le contenu
   * @param {string} source - Source de la vidéo (fichier ou URL)
   * @returns {Promise<Object>} Résultat de la modération
   */
  async fallbackModeration(source) {
    console.log('🛡️ Modération de fallback activée pour:', source);
    console.log('✅ Contenu approuvé automatiquement (Google Cloud non configuré)');
    
    return {
      isAllowed: true,
      confidence: 0.95, // Confidence élevée pour indiquer que c'est une approbation automatique
      detectedContent: [],
      details: {
        adultContent: 0,
        violentContent: 0,
        racyContent: 0,
        totalFramesAnalyzed: 0
      },
      warnings: ['Google Cloud non configuré - Approbation automatique'],
      fallbackUsed: true,
      moderationService: 'fallback'
    };
  }

  /**
   * Modère une vidéo en utilisant Google Cloud Video Intelligence API
   * @param {string} videoPath - Chemin vers le fichier vidéo local
   * @param {Object} options - Options de modération
   * @returns {Promise<Object>} Résultat de la modération
   */
  async moderateVideo(videoPath, options = {}) {
    // Si Google Cloud n'est pas configuré, utiliser la modération de fallback
    if (!this.isGoogleCloudConfigured) {
      return this.fallbackModeration(videoPath);
    }

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
      moderationResult.moderationService = 'google-cloud';
      
      console.log(`🛡️ Résultat de la modération:`, {
        isAllowed: moderationResult.isAllowed,
        confidence: moderationResult.confidence,
        detectedIssues: moderationResult.detectedContent
      });
      
      return moderationResult;
      
    } catch (error) {
      console.error('❌ Erreur lors de la modération Google Cloud:', error);
      console.log('🔄 Basculement vers la modération de fallback');
      
      // En cas d'erreur, utiliser la modération de fallback
      const fallbackResult = await this.fallbackModeration(videoPath);
      fallbackResult.googleCloudError = error.message;
      return fallbackResult;
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
    // Si Google Cloud n'est pas configuré, utiliser la modération de fallback
    if (!this.isGoogleCloudConfigured) {
      return this.fallbackModeration(videoUrl);
    }

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
      
      const moderationResult = this.analyzeResults(result);
      moderationResult.moderationService = 'google-cloud';
      
      return moderationResult;
      
    } catch (error) {
      console.error('❌ Erreur lors de la modération depuis URL Google Cloud:', error);
      console.log('🔄 Basculement vers la modération de fallback');
      
      // En cas d'erreur, utiliser la modération de fallback
      const fallbackResult = await this.fallbackModeration(videoUrl);
      fallbackResult.googleCloudError = error.message;
      return fallbackResult;
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

  /**
   * Nettoie le fichier de credentials temporaire s'il existe
   */
  cleanupTempFile() {
    if (this.tempCredentialsFile) {
      fs.unlink(this.tempCredentialsFile).catch(error => {
        console.error('❌ Erreur lors de la suppression du fichier de credentials temporaire:', error.message);
      });
      this.tempCredentialsFile = null;
    }
  }
}

module.exports = new ContentModerationService(); 