const mongoose = require('mongoose');

const moderationResultSchema = new mongoose.Schema({
  // Référence vers le contenu modéré (vidéo OU image)
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    default: null,
  },
  image: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image',
    default: null,
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Résultat de la modération
  isAllowed: {
    type: Boolean,
    required: true,
    default: false,
  },
  
  // Niveau de confiance du résultat (0-1)
  confidence: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 1,
  },
  
  // Types de contenu détectés
  detectedContent: [{
    type: String,
    enum: [
      // Pour vidéos (Google Cloud)
      'adult_content',
      'violent_content', 
      'racy_content',
      'safe_search_adult',
      'safe_search_violence',
      'safe_search_racy',
      // Pour images (OpenAI)
      'Harcèlement',
      'Menaces', 
      'Discours haineux',
      'Discours haineux avec menaces',
      'Automutilation',
      'Intention d\'automutilation',
      'Instructions d\'automutilation',
      'Contenu sexuel',
      'Contenu sexuel impliquant des mineurs',
      'Violence',
      'Violence graphique',
      // Erreurs génériques
      'moderation_error'
    ]
  }],
  
  // Détails de l'analyse
  details: {
    adultContent: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    violentContent: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    racyContent: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    totalFramesAnalyzed: {
      type: Number,
      default: 0,
    }
  },
  
  // Avertissements et erreurs
  warnings: [{
    type: String
  }],
  
  error: {
    type: String,
    default: null,
  },
  
  // Métadonnées de la modération
  moderationService: {
    type: String,
    default: 'google-cloud-video-intelligence',
  },
  
  // Version de l'API utilisée
  apiVersion: {
    type: String,
    default: 'v1',
  },
  
  // Temps de traitement en millisecondes
  processingTime: {
    type: Number,
    default: 0,
  },
  
  // Configuration utilisée lors de la modération
  moderationConfig: {
    adultContentThreshold: {
      type: Number,
      default: 0.7,
    },
    violentContentThreshold: {
      type: Number,
      default: 0.8,
    },
    racyContentThreshold: {
      type: Number,
      default: 0.6,
    }
  },
  
  // Action prise suite à la modération
  action: {
    type: String,
    enum: ['approved', 'rejected', 'pending_review', 'auto_blocked'],
    default: 'pending_review',
  },
  
  // ID de l'opération Google Cloud (pour le suivi)
  operationId: {
    type: String,
    default: null,
  },
  
  // Révision manuelle si nécessaire
  manualReview: {
    reviewed: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewDecision: {
      type: String,
      enum: ['approve', 'reject', 'needs_more_review'],
      default: null,
    },
    reviewNotes: {
      type: String,
      default: null,
    }
  }
}, {
  timestamps: true,
});

// Index pour optimiser les requêtes
moderationResultSchema.index({ video: 1 }, { sparse: true });
moderationResultSchema.index({ image: 1 }, { sparse: true });
moderationResultSchema.index({ user: 1 });
moderationResultSchema.index({ isAllowed: 1 });
moderationResultSchema.index({ action: 1 });
moderationResultSchema.index({ createdAt: 1 });
moderationResultSchema.index({ 'detectedContent': 1 });

// Index composé pour éviter les doublons
moderationResultSchema.index({ 
  video: 1, 
  image: 1, 
  user: 1, 
  createdAt: 1 
}, { 
  sparse: true,
  background: true 
});

// Validation: Au moins une référence (video OU image) doit être présente
moderationResultSchema.pre('save', function(next) {
  if (!this.video && !this.image) {
    const error = new Error('Au moins une référence vers une vidéo ou une image est requise');
    return next(error);
  }
  if (this.video && this.image) {
    const error = new Error('Une seule référence (vidéo ou image) peut être présente');
    return next(error);
  }
  next();
});

// Méthodes du schéma
moderationResultSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    isAllowed: this.isAllowed,
    confidence: this.confidence,
    detectedContent: this.detectedContent,
    action: this.action,
    warnings: this.warnings,
    createdAt: this.createdAt
  };
};

// Méthode statique pour obtenir les statistiques de modération
moderationResultSchema.statics.getModerationStats = async function(timeframe = '7d') {
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case '1d':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        approved: { 
          $sum: { $cond: [{ $eq: ['$isAllowed', true] }, 1, 0] }
        },
        rejected: { 
          $sum: { $cond: [{ $eq: ['$isAllowed', false] }, 1, 0] }
        },
        averageConfidence: { $avg: '$confidence' },
        detectedContentTypes: { $push: '$detectedContent' }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      total: 0,
      approved: 0,
      rejected: 0,
      approvalRate: 0,
      averageConfidence: 0,
      commonIssues: []
    };
  }
  
  const result = stats[0];
  const flattenedContent = result.detectedContentTypes.flat();
  const contentCounts = {};
  
  flattenedContent.forEach(content => {
    contentCounts[content] = (contentCounts[content] || 0) + 1;
  });
  
  const commonIssues = Object.entries(contentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
  
  return {
    total: result.total,
    approved: result.approved,
    rejected: result.rejected,
    approvalRate: result.total > 0 ? (result.approved / result.total * 100).toFixed(2) : 0,
    averageConfidence: result.averageConfidence ? result.averageConfidence.toFixed(3) : 0,
    commonIssues
  };
};

module.exports = mongoose.model('ModerationResult', moderationResultSchema); 