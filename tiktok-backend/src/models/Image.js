// models/Image.js
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    /* ----- propriétaire de l'image ----- */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /* ----- données « média » ----- */
    imageUrl: {
      type: String,
      required: true,
    },
    imageKey: {
      type: String, // clé S3 si tu stockes dans ton bucket
      default: null,
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    width: Number,
    height: Number,

    /* ----- métadonnées « contenu » ----- */
    title: {
      type: String,
      maxlength: 140,
    },
    description: {
      type: String,
      maxlength: 5_000,
    },
    hashtags: [String],

    /* ----- "like" / popularité ----- */
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    /* ----- nature de l'image ----- */
    type: {
      type: String,
      enum: ['ai-generated', 'upload'],
      default: 'upload',
    },

    /* ----- MODÉRATION DE CONTENU ----- */
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'under_review'],
      default: 'pending',
      index: true
    },
    
    contentModeration: {
      // Statut de la modération automatique
      autoModerationStatus: {
        type: String,
        enum: ['analyzing', 'approved', 'rejected', 'error'],
        default: 'analyzing'
      },
      
      // Référence vers le résultat de modération détaillé
      autoModerationResult: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModerationResult',
        default: null
      },
      
      // Indique si l'image a été approuvée automatiquement
      isAutoApproved: {
        type: Boolean,
        default: false
      },
      
      // Score de confiance de la modération (0-1)
      moderationConfidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      
      // Indique si une révision manuelle est nécessaire
      needsManualReview: {
        type: Boolean,
        default: false
      },
      
      // Raisons du rejet si l'image est rejetée
      rejectionReasons: {
        type: [String],
        default: []
      },
      
      // Informations sur la révision manuelle
      manualReview: {
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        reviewedAt: {
          type: Date,
          default: null
        },
        reviewNotes: {
          type: String,
          default: ''
        },
        overrideReason: {
          type: String,
          default: ''
        }
      },
      
      // Timestamp de la dernière modération
      lastModeratedAt: {
        type: Date,
        default: Date.now
      }
    },

    /* ----- extra technique pour les images IA ----- */
    metadata: {
      aiGenerated: { type: Boolean, default: false },
      provider: String, // ex : 'flux'
      model: String,
      promptText: String,
      taskId: String,
      generationCost: Number, // centimes
      aspectRatio: String,
      fileSize: Number,
      originalFormat: String,
      uploadMethod: String
    },
  },
  { timestamps: true }
);

/* Virtuel pour exposer rapidement le nombre de likes */
imageSchema.virtual('likesCount').get(function () {
  return this.likes?.length || 0;
});

/* Index utiles */
imageSchema.index({ user: 1, createdAt: -1 });
imageSchema.index({ type: 1, createdAt: -1 });
imageSchema.index({ moderationStatus: 1, createdAt: -1 });
imageSchema.index({ 'contentModeration.needsManualReview': 1, moderationStatus: 1 });

module.exports = mongoose.model('Image', imageSchema);
