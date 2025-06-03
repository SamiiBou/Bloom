const mongoose = require('mongoose');

const uploadTaskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  uploadId: {
    type: String,
    required: [true, 'Upload ID is required'],
    unique: true,
  },
  filename: {
    type: String,
    required: [true, 'Filename is required'],
  },
  originalFilename: {
    type: String,
    required: [true, 'Original filename is required'],
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['UPLOADED', 'VALIDATING', 'CONVERTING', 'GENERATING_THUMBNAIL', 'UPLOADING_TO_S3', 'MODERATING', 'SUCCEEDED', 'FAILED'],
    default: 'UPLOADED',
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  currentStep: {
    type: String,
    default: 'Initializing...',
  },
  videoUrl: {
    type: String,
  },
  videoKey: {
    type: String,
  },
  thumbnailUrl: {
    type: String,
  },
  thumbnailKey: {
    type: String,
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video', // Reference to created Video document
  },
  fileInfo: {
    originalSize: Number,
    convertedSize: Number,
    duration: Number,
    format: String,
    resolution: {
      width: Number,
      height: Number,
    },
    bitrate: Number,
  },
  processing: {
    conversionNeeded: {
      type: Boolean,
      default: false,
    },
    conversionStarted: Date,
    conversionCompleted: Date,
    thumbnailGenerated: Date,
    s3UploadStarted: Date,
    s3UploadCompleted: Date,
    moderationStarted: Date,
    moderationCompleted: Date,
  },
  moderation: {
    status: {
      type: String,
      enum: ['pending', 'analyzing', 'approved', 'rejected', 'error'],
      default: 'pending',
    },
    confidence: Number,
    detectedIssues: [String],
    needsReview: {
      type: Boolean,
      default: false,
    },
  },
  error: {
    message: String,
    code: String,
    step: String,
    details: mongoose.Schema.Types.Mixed,
  },
  tempFiles: [String], // Array of temporary file paths to cleanup
  metadata: {
    processingTime: Number, // Time in milliseconds
    retryCount: {
      type: Number,
      default: 0,
    },
    ipAddress: String,
    userAgent: String,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
uploadTaskSchema.index({ user: 1, createdAt: -1 });
uploadTaskSchema.index({ uploadId: 1 });
uploadTaskSchema.index({ status: 1 });
uploadTaskSchema.index({ createdAt: 1 }); // For cleanup of old tasks

// Virtual for processing duration
uploadTaskSchema.virtual('processingDuration').get(function() {
  if (this.status === 'SUCCEEDED' || this.status === 'FAILED') {
    return this.updatedAt - this.createdAt;
  }
  return Date.now() - this.createdAt;
});

// Method to update progress and status
uploadTaskSchema.methods.updateProgress = function(status, progress, currentStep) {
  this.status = status || this.status;
  this.progress = progress !== undefined ? progress : this.progress;
  this.currentStep = currentStep || this.currentStep;
  
  // Update processing timestamps
  switch (status) {
    case 'CONVERTING':
      if (!this.processing.conversionStarted) {
        this.processing.conversionStarted = new Date();
      }
      break;
    case 'GENERATING_THUMBNAIL':
      if (this.processing.conversionStarted && !this.processing.conversionCompleted) {
        this.processing.conversionCompleted = new Date();
      }
      break;
    case 'UPLOADING_TO_S3':
      if (!this.processing.s3UploadStarted) {
        this.processing.s3UploadStarted = new Date();
      }
      if (!this.processing.thumbnailGenerated) {
        this.processing.thumbnailGenerated = new Date();
      }
      break;
    case 'MODERATING':
      if (!this.processing.s3UploadCompleted) {
        this.processing.s3UploadCompleted = new Date();
      }
      if (!this.processing.moderationStarted) {
        this.processing.moderationStarted = new Date();
      }
      break;
    case 'SUCCEEDED':
    case 'FAILED':
      if (!this.processing.moderationCompleted) {
        this.processing.moderationCompleted = new Date();
      }
      this.metadata.processingTime = Date.now() - this.createdAt;
      break;
  }
  
  return this.save();
};

// Method to set error
uploadTaskSchema.methods.setError = function(error, step) {
  this.status = 'FAILED';
  this.error = {
    message: error.message || 'Unknown error',
    code: error.code,
    step: step,
    details: error
  };
  this.metadata.processingTime = Date.now() - this.createdAt;
  
  return this.save();
};

// Static method to cleanup old tasks
uploadTaskSchema.statics.cleanupOldTasks = async function(daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['SUCCEEDED', 'FAILED'] }
  });
  
  console.log(`🧹 Cleaned up ${result.deletedCount} old upload tasks`);
  return result;
};

// Static method to get progress mapping
uploadTaskSchema.statics.getProgressMapping = function() {
  return {
    'UPLOADED': { progress: 5, step: '📤 File received...' },
    'VALIDATING': { progress: 10, step: '🔍 Validating file...' },
    'CONVERTING': { progress: 30, step: '🔄 Converting video...' },
    'GENERATING_THUMBNAIL': { progress: 60, step: '🖼️ Generating thumbnail...' },
    'UPLOADING_TO_S3': { progress: 80, step: '☁️ Uploading to cloud...' },
    'MODERATING': { progress: 90, step: '🛡️ Content moderation...' },
    'SUCCEEDED': { progress: 100, step: '✅ Upload completed!' },
    'FAILED': { progress: 0, step: '❌ Upload failed' }
  };
};

module.exports = mongoose.model('UploadTask', uploadTaskSchema); 