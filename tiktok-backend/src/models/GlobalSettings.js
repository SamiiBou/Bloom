const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global' // To ensure only one document for global settings
  },
  nextBloomDropTime: {
    type: Date,
    required: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Initialize the setting if it doesn't exist
globalSettingsSchema.statics.initializeSettings = async function() {
  const GlobalSettings = this;
  let settings = await GlobalSettings.findOne({ key: 'global' });
  if (!settings) {
    // Set initial drop time to 2 hours from now
    const initialDropTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    settings = await GlobalSettings.create({ nextBloomDropTime: initialDropTime });
    console.log('GlobalSettings initialized with nextBloomDropTime:', settings.nextBloomDropTime);
  }
  return settings;
};

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema); 