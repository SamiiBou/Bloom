const cron = require('node-cron');
const User = require('../models/User');
const GlobalSettings = require('../models/GlobalSettings');

const BLOOM_INCREMENT = 0.5;
const CRON_SCHEDULE = '0 */2 * * *'; // Runs every 2 hours (at the start of the hour)

// Function to process the bloom drop
async function processBloomDrop() {
  console.log('[BloomService] Processing global Bloom drop...');
  try {
    // Increment grabBalance for all users
    const updateResult = await User.updateMany({}, { $inc: { grabBalance: BLOOM_INCREMENT } });
    console.log(`[BloomService] Incremented grabBalance by ${BLOOM_INCREMENT} for ${updateResult.modifiedCount} users.`);

    // Update the nextBloomDropTime
    const newNextDropTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const settings = await GlobalSettings.findOneAndUpdate(
      { key: 'global' }, 
      { nextBloomDropTime: newNextDropTime }, 
      { new: true, upsert: true } // upsert ensures it's created if somehow missing
    );
    console.log('[BloomService] Next Bloom drop scheduled for:', settings.nextBloomDropTime);

  } catch (error) {
    console.error('[BloomService] Error processing Bloom drop:', error);
  }
}

// Schedule the cron job
cron.schedule(CRON_SCHEDULE, () => {
  console.log('[BloomService] Cron job triggered. Time for a Bloom drop!');
  processBloomDrop();
}, {
  scheduled: true,
  timezone: "Etc/UTC" // Using UTC to avoid timezone issues
});

console.log(`[BloomService] Bloom drop cron job scheduled: ${CRON_SCHEDULE}`);

// Function to get the next drop time
async function getNextBloomDropTime() {
  try {
    const settings = await GlobalSettings.findOne({ key: 'global' });
    if (settings && settings.nextBloomDropTime) {
      return settings.nextBloomDropTime;
    }
    // If not found, initialize and return (should have been caught by server startup init)
    const initializedSettings = await GlobalSettings.initializeSettings();
    return initializedSettings.nextBloomDropTime;
  } catch (error) {
    console.error('[BloomService] Error fetching next Bloom drop time:', error);
    // Fallback to 2 hours from now if there's an error, though this should be rare
    return new Date(Date.now() + 2 * 60 * 60 * 1000); 
  }
}

module.exports = {
  processBloomDrop, // Exported for potential manual trigger if needed
  getNextBloomDropTime,
  startBloomService: () => {
    // This function can be called in server.js to ensure the service is loaded and cron starts
    console.log('[BloomService] Service started and cron job initialized.');
  }
}; 