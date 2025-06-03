const mongoose = require('mongoose');

const aiImageSchema = new mongoose.Schema({
  // User who initiated the generation
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Task identification
  taskId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Prompt and input data
  promptText: {
    type: String,
    required: true,
    maxlength: 1000
  },

  // Generation type
  type: {
    type: String,
    enum: ['text-to-image', 'image-to-image', 'inpainting', 'outpainting'],
    required: true,
    default: 'text-to-image'
  },

  // Model used for generation
  model: {
    type: String,
    required: true,
    enum: [
      'flux-pro-1.1',
      'flux-pro', 
      'flux-dev',
      'flux-schnell',
      'flux-pro-1.1-kontext',
      'flux-kontext-max'
    ]
  },

  // Task status
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },

  // Generation options
  options: {
    width: { type: Number, default: 1024 },
    height: { type: Number, default: 1024 },
    steps: { type: Number, default: 30 },
    guidance: { type: Number, default: 3.5 },
    aspectRatio: { type: String, default: '1:1' },
    seed: { type: Number, default: null },
    promptUpsampling: { type: Boolean, default: false },
    safetyTolerance: { type: Number, default: 2 }
  },

  // Input image data (for image-to-image)
  sourceImageUrl: {
    type: String,
    default: null
  },

  sourceImageBase64: {
    type: String,
    default: null
  },

  // Generated image URLs
  imageUrl: {
    type: String,
    default: null
  },

  imageKey: {
    type: String, // S3 key for our stored version
    default: null
  },

  thumbnailUrl: {
    type: String,
    default: null
  },

  // Error information
  error: {
    type: String,
    default: null
  },

  // Publishing status
  publishStatus: {
    type: String,
    enum: ['UNPUBLISHED', 'PUBLISHED', 'REJECTED'],
    default: 'UNPUBLISHED'
  },

  // Associated published image record
  publishedImage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image', // Référence vers un modèle Image si tu en as un
    default: null
  },

  // Cost and billing
  cost: {
    type: Number,
    default: 0
  },

  // Provider information
  provider: {
    type: String,
    default: 'flux',
    enum: ['flux', 'runway', 'veo']
  },

  // Metadata
  metadata: {
    provider: { type: String, default: 'flux' },
    processingTime: { type: Number, default: null }, // in milliseconds
    originalTaskId: { type: String, default: null }, // Original provider task ID
    imageSize: { type: Number, default: null }, // File size in bytes
    contentType: { type: String, default: 'image/jpeg' },
    tags: [{ type: String }], // Auto-generated or user tags
    nsfw: { type: Boolean, default: false },
    moderationFlags: [{ type: String }],
    downloads: {
      count: { type: Number, default: 0 },
      lastDownloadAt: { type: Date, default: null },
      downloadHistory: [{
        downloadedAt: { type: Date, default: Date.now },
        ipAddress: { type: String, default: null },
        userAgent: { type: String, default: null }
      }]
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
aiImageSchema.index({ user: 1, createdAt: -1 });
aiImageSchema.index({ status: 1, createdAt: -1 });
aiImageSchema.index({ taskId: 1 });
aiImageSchema.index({ publishStatus: 1 });
aiImageSchema.index({ 'metadata.provider': 1 });

// Virtual for processing time in seconds
aiImageSchema.virtual('processingTimeSeconds').get(function() {
  return this.metadata.processingTime ? Math.round(this.metadata.processingTime / 1000) : null;
});

// Virtual for image dimensions
aiImageSchema.virtual('dimensions').get(function() {
  return {
    width: this.options.width,
    height: this.options.height,
    aspectRatio: this.options.aspectRatio
  };
});

// Virtual for cost in dollars
aiImageSchema.virtual('costInDollars').get(function() {
  return this.cost ? (this.cost / 100).toFixed(3) : '0.000';
});

// Instance method to update from FLUX task result
aiImageSchema.methods.updateFromFluxTask = async function(fluxResult) {
  this.status = fluxResult.status;
  
  if (fluxResult.status === 'SUCCEEDED' && fluxResult.output && fluxResult.output.length > 0) {
    this.imageUrl = fluxResult.output[0];
    this.metadata.processingTime = Date.now() - new Date(this.createdAt).getTime();
  } else if (fluxResult.status === 'FAILED') {
    this.error = fluxResult.error || 'Generation failed';
  }

  return this.save();
};

// Instance method to record download
aiImageSchema.methods.recordDownload = async function(ipAddress = null, userAgent = null) {
  // Increment download count
  this.metadata.downloads.count += 1;
  this.metadata.downloads.lastDownloadAt = new Date();
  
  // Add to download history (keep only last 10 downloads)
  this.metadata.downloads.downloadHistory.push({
    downloadedAt: new Date(),
    ipAddress: ipAddress,
    userAgent: userAgent
  });
  
  // Keep only last 10 download records
  if (this.metadata.downloads.downloadHistory.length > 10) {
    this.metadata.downloads.downloadHistory = this.metadata.downloads.downloadHistory.slice(-10);
  }
  
  return this.save();
};

// Static method to find by task ID
aiImageSchema.statics.findByTaskId = function(taskId) {
  return this.findOne({ taskId });
};

// Static method to get user's generation history
aiImageSchema.statics.getUserHistory = function(userId, options = {}) {
  const { page = 1, limit = 10, status = null, model = null } = options;
  const skip = (page - 1) * limit;
  
  const query = { user: userId };
  if (status) query.status = status;
  if (model) query.model = model;
  
  return this.find(query)
    .populate('user', 'username displayName avatar')
    .populate('publishedImage', 'imageUrl thumbnailUrl description likes')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get generation statistics
aiImageSchema.statics.getGenerationStats = function(userId, timeframe = 'month') {
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case 'day':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalGenerations: { $sum: 1 },
        successfulGenerations: {
          $sum: { $cond: [{ $eq: ['$status', 'SUCCEEDED'] }, 1, 0] }
        },
        failedGenerations: {
          $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
        },
        totalCost: { $sum: '$cost' },
        avgProcessingTime: { $avg: '$metadata.processingTime' },
        modelUsage: {
          $push: '$model'
        }
      }
    }
  ]);
};

// Pre-save middleware
aiImageSchema.pre('save', function(next) {
  // Set cost based on model if not already set
  if (this.isNew && this.cost === 0) {
    const modelPricing = {
      'flux-pro-1.1': 3, // 3 cents
      'flux-pro': 5, // 5 cents
      'flux-dev': 2.5, // 2.5 cents
      'flux-schnell': 1, // 1 cent
      'flux-pro-1.1-kontext': 6, // 6 cents
      'flux-kontext-max': 8 // 8 cents
    };
    this.cost = modelPricing[this.model] || 3;
  }
  
  next();
});

// Pre-remove middleware (cleanup)
aiImageSchema.pre('remove', async function(next) {
  try {
    // TODO: Cleanup S3 files if needed
    // if (this.imageKey) {
    //   // Delete from S3
    // }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('AIImage', aiImageSchema);