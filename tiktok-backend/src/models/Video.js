const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  title: {
    type: String,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    trim: true,
    // Pour les vidéos longues, le titre est requis, pour les shorts on peut utiliser une partie de la description
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters'], // Augmenté pour les vidéos longues
    trim: true,
  },
  category: {
    type: String,
    enum: [
      'education', 'entertainment', 'music', 'gaming', 'sports', 'technology', 
      'lifestyle', 'travel', 'food', 'fashion', 'news', 'comedy', 'art', 
      'science', 'health', 'business', 'other'
    ],
    default: 'other',
  },
  videoUrl: {
    type: String,
    required: [true, 'Video URL is required'],
  },
  videoKey: {
    type: String,
    required: [true, 'Video key is required'], // S3 key for deletion
  },
  thumbnailUrl: {
    type: String,
    default: '',
  },
  thumbnailKey: {
    type: String,
    default: '', // S3 key for thumbnail deletion
  },
  duration: {
    type: Number, // Duration in seconds
    default: 0,
  },
  type: {
    type: String,
    enum: ['short', 'long'],
    default: 'short', // Par défaut, les vidéos sont des shorts
  },
  fileSize: {
    type: Number, // File size in bytes
    default: 0,
  },
  resolution: {
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
  },
  music: {
    title: {
      type: String,
      default: '',
    },
    artist: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      default: '',
    },
  },
  hashtags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
      trim: true,
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      text: {
        type: String,
        required: true,
        maxlength: [500, 'Reply cannot exceed 500 characters'],
        trim: true,
      },
      likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }],
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  shares: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    platform: {
      type: String,
      enum: ['tiktok', 'facebook', 'twitter', 'instagram', 'whatsapp', 'copy'],
      default: 'tiktok',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    duration: {
      type: Number, // How long they watched in seconds
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  // Computed fields for performance
  likesCount: {
    type: Number,
    default: 0,
  },
  commentsCount: {
    type: Number,
    default: 0,
  },
  sharesCount: {
    type: Number,
    default: 0,
  },
  viewsCount: {
    type: Number,
    default: 0,
  },
  // Video status
  isPublic: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  // Moderation
  isReported: {
    type: Boolean,
    default: false,
  },
  reportCount: {
    type: Number,
    default: 0,
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'under_review'],
    default: 'pending',
  },
  
  // Content Moderation - Nouveau système
  contentModeration: {
    // Statut de la modération automatique
    autoModerationStatus: {
      type: String,
      enum: ['pending', 'analyzing', 'approved', 'rejected', 'error'],
      default: 'pending',
    },
    
    // Résultat de la modération automatique
    autoModerationResult: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ModerationResult',
      default: null,
    },
    
    // Si la vidéo a passé la modération automatique
    isAutoApproved: {
      type: Boolean,
      default: false,
    },
    
    // Si la vidéo nécessite une révision manuelle
    needsManualReview: {
      type: Boolean,
      default: false,
    },
    
    // Raisons du rejet automatique
    rejectionReasons: [{
      type: String,
      enum: [
        'adult_content',
        'violent_content',
        'racy_content',
        'safe_search_adult',
        'safe_search_violence',
        'safe_search_racy',
        'moderation_error'
      ]
    }],
    
    // Date de la dernière modération
    lastModeratedAt: {
      type: Date,
      default: null,
    },
    
    // Niveau de confiance de la modération (0-1)
    moderationConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    
    // Bypass de la modération (pour les utilisateurs de confiance)
    isModerationBypassed: {
      type: Boolean,
      default: false,
    },
    
    // Utilisateur qui a bypass la modération
    bypassedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    }
  },
}, {
  timestamps: true,
});

// Indexes for better performance
videoSchema.index({ user: 1, createdAt: -1 });
videoSchema.index({ hashtags: 1 });
videoSchema.index({ createdAt: -1 });
videoSchema.index({ likesCount: -1 });
videoSchema.index({ viewsCount: -1 });
videoSchema.index({ isPublic: 1, isActive: 1 });
videoSchema.index({ type: 1, createdAt: -1 });
videoSchema.index({ type: 1, isPublic: 1, isActive: 1 });

// MÉTHODES AMÉLIORÉES

// Update likes count
videoSchema.methods.updateLikesCount = async function() {
  this.likesCount = this.likes.length;
  return await this.save();
};

// Update comments count
videoSchema.methods.updateCommentsCount = async function() {
  this.commentsCount = this.comments.length;
  return await this.save();
};

// Update shares count
videoSchema.methods.updateSharesCount = async function() {
  this.sharesCount = this.shares.length;
  return await this.save();
};

// Update views count
videoSchema.methods.updateViewsCount = async function() {
  this.viewsCount = this.views.length;
  return await this.save();
};

// Check if user liked the video
videoSchema.methods.isLikedByUser = function(userId) {
  if (!userId) return false;
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Check if user liked a specific comment
videoSchema.methods.isCommentLikedByUser = function(commentId, userId) {
  if (!userId) return false;
  const comment = this.comments.id(commentId);
  if (!comment) return false;
  return comment.likes.some(like => like.toString() === userId.toString());
};

// Add view (avec protection anti-spam améliorée)
videoSchema.methods.addView = async function(userId, ipAddress, userAgent, duration = 0) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Check if user already viewed recently (to prevent spam)
  const existingView = this.views.find(view => {
    if (userId && view.user && view.user.toString() === userId.toString()) {
      return view.createdAt > oneHourAgo;
    }
    // Pour les utilisateurs non connectés, vérifier par IP
    if (!userId && view.ipAddress === ipAddress) {
      return view.createdAt > oneHourAgo;
    }
    return false;
  });
  
  if (!existingView) {
    this.views.push({
      user: userId || null,
      ipAddress,
      userAgent,
      duration,
      createdAt: now
    });
    await this.updateViewsCount();
    console.log(`👀 Nouvelle vue ajoutée pour la vidéo ${this._id}`);
  }
};

// Extract hashtags from description
videoSchema.methods.extractHashtags = function() {
  const hashtagRegex = /#[\w\u00C0-\u017F]+/g; // Support des caractères accentués
  const hashtags = this.description.match(hashtagRegex);
  if (hashtags) {
    this.hashtags = [...new Set(hashtags.map(tag => tag.substring(1).toLowerCase()))]; // Supprime les doublons
  } else {
    this.hashtags = [];
  }
};

// Extract mentions from description
videoSchema.methods.extractMentions = async function() {
  const mentionRegex = /@[\w\u00C0-\u017F]+/g;
  const mentions = this.description.match(mentionRegex);
  
  if (mentions) {
    const User = mongoose.model('User');
    const usernames = mentions.map(mention => mention.substring(1).toLowerCase());
    
    // Trouver les utilisateurs mentionnés
    const mentionedUsers = await User.find({
      username: { $in: usernames }
    }).select('_id');
    
    this.mentions = mentionedUsers.map(user => user._id);
  } else {
    this.mentions = [];
  }
};

// Get comment by ID (helper method)
videoSchema.methods.getCommentById = function(commentId) {
  return this.comments.id(commentId);
};

// Add comment with validation
videoSchema.methods.addComment = async function(userId, text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Comment text is required');
  }
  
  if (text.trim().length > 500) {
    throw new Error('Comment cannot exceed 500 characters');
  }

  this.comments.push({
    user: userId,
    text: text.trim(),
    createdAt: new Date()
  });

  await this.updateCommentsCount();
  return this.comments[this.comments.length - 1];
};

// Remove comment
videoSchema.methods.removeComment = async function(commentId) {
  const comment = this.comments.id(commentId);
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  comment.remove();
  await this.updateCommentsCount();
  return true;
};

// Toggle comment like
videoSchema.methods.toggleCommentLike = async function(commentId, userId) {
  const comment = this.comments.id(commentId);
  if (!comment) {
    throw new Error('Comment not found');
  }

  const likeIndex = comment.likes.findIndex(like => like.toString() === userId.toString());
  
  if (likeIndex > -1) {
    comment.likes.splice(likeIndex, 1);
    await this.save();
    return { isLiked: false, likesCount: comment.likes.length };
  } else {
    comment.likes.push(userId);
    await this.save();
    return { isLiked: true, likesCount: comment.likes.length };
  }
};

// Pre-save middleware to extract hashtags and mentions
videoSchema.pre('save', async function(next) {
  if (this.isModified('description')) {
    this.extractHashtags();
    // Note: extractMentions est async, donc nous ne l'exécutons que si nécessaire
    if (this.isNew || this.isModified('description')) {
      try {
        await this.extractMentions();
      } catch (error) {
        console.error('Erreur lors de l\'extraction des mentions:', error);
        // Ne pas bloquer la sauvegarde pour une erreur de mentions
      }
    }
  }
  next();
});

// Middleware post-save pour les notifications (optionnel)
videoSchema.post('save', function(doc) {
  // TODO: Envoyer des notifications pour les nouvelles mentions
  if (doc.mentions && doc.mentions.length > 0) {
    console.log(`📧 ${doc.mentions.length} utilisateurs mentionnés dans la vidéo ${doc._id}`);
  }
});

// Virtual pour obtenir l'URL complète de la vidéo si nécessaire
videoSchema.virtual('fullVideoUrl').get(function() {
  if (this.videoUrl.startsWith('http')) {
    return this.videoUrl;
  }
  return `${process.env.CDN_BASE_URL || ''}${this.videoUrl}`;
});

// Virtual pour obtenir l'URL complète de la thumbnail
videoSchema.virtual('fullThumbnailUrl').get(function() {
  if (!this.thumbnailUrl) return '';
  if (this.thumbnailUrl.startsWith('http')) {
    return this.thumbnailUrl;
  }
  return `${process.env.CDN_BASE_URL || ''}${this.thumbnailUrl}`;
});

// Inclure les virtuals dans la sérialisation JSON
videoSchema.set('toJSON', { virtuals: true });
videoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Video', videoSchema);