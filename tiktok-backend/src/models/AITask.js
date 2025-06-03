const mongoose = require('mongoose');

const aiTaskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  runwayTaskId: {
    type: String,
    required: [true, 'Runway task ID is required'],
    unique: true,
  },
  promptText: {
    type: String,
    required: [true, 'Prompt text is required'],
    maxlength: [1000, 'Prompt text cannot exceed 1000 characters'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['text-to-video', 'image-to-video'],
    default: 'text-to-video',
  },
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
  },
  publishStatus: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'REJECTED'],
    default: 'DRAFT',
  },
  videoUrl: {
    type: String,
  },
  videoKey: {
    type: String,
  },
  options: {
    model: {
      type: String,
      default: 'gen4_turbo',
    },
    duration: {
      type: Number,
      default: 5,
    },
    ratio: {
      type: String,
      default: '1280:720',
    },
    seed: {
      type: Number,
    },
  },
  sourceImageUrl: {
    type: String, // For image-to-video tasks
  },
  generatedImageUrl: {
    type: String, // For text-to-video tasks (intermediate image)
  },
  resultVideoUrl: {
    type: String, // Final video URL from Runway
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video', // Reference to created Video document
  },
  error: {
    message: String,
    code: String,
    details: mongoose.Schema.Types.Mixed,
  },
  cost: {
    type: Number, // Cost in USD
    default: 0,
  },
  refunded: {
    type: Boolean,
    default: false
  },
  metadata: {
    runwayResponse: mongoose.Schema.Types.Mixed,
    processingTime: Number, // Time in seconds
    retryCount: {
      type: Number,
      default: 0,
    },
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
aiTaskSchema.index({ user: 1, createdAt: -1 });
aiTaskSchema.index({ runwayTaskId: 1 });
aiTaskSchema.index({ status: 1 });
aiTaskSchema.index({ createdAt: 1 }); // For cleanup of old tasks

// Virtual for processing duration
aiTaskSchema.virtual('processingDuration').get(function() {
  if (this.status === 'SUCCEEDED' || this.status === 'FAILED') {
    return this.updatedAt - this.createdAt;
  }
  return Date.now() - this.createdAt;
});

// Method to update status from Runway response
aiTaskSchema.methods.updateFromRunwayTask = function(runwayTask) {
  this.status = runwayTask.status;
  
  if (runwayTask.status === 'SUCCEEDED' && runwayTask.output) {
    this.resultVideoUrl = runwayTask.output[0];
  }
  
  if (runwayTask.status === 'FAILED' && runwayTask.error) {
    this.error = {
      message: runwayTask.error.message || 'Unknown error',
      code: runwayTask.error.code,
      details: runwayTask.error
    };
  }
  
  this.metadata.runwayResponse = runwayTask;
  this.metadata.processingTime = Math.floor((Date.now() - this.createdAt) / 1000);
  
  return this.save();
};

// Static method to cleanup old tasks
aiTaskSchema.statics.cleanupOldTasks = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['SUCCEEDED', 'FAILED', 'CANCELLED'] }
  });
  
  console.log(`🧹 Cleaned up ${result.deletedCount} old AI tasks`);
  return result;
};

// Pre-save middleware to calculate cost
aiTaskSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'SUCCEEDED') {
    // Calculate cost based on duration
    // Runway pricing: 5s video = $0.25, 10s video = $0.50
    const baseCost = this.options.duration <= 5 ? 0.25 : 0.50;
    this.cost = baseCost;
  }
  next();
});

module.exports = mongoose.model('AITask', aiTaskSchema); 
 