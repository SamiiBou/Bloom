const multer = require('multer');
const { uploadToBunny, deleteFromBunny, bunnyConfig } = require('./bunny');

// Configuration Multer pour stockage en mémoire avant upload vers Bunny CDN
const memoryStorage = multer.memoryStorage();

// Multer configuration pour les vidéos
const uploadVideo = multer({
  storage: memoryStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB default
  },
  fileFilter: (req, file, cb) => {
    // DEBUGGING: Log detected mimetype and allowed types
    console.log('--- File Filter Debug ---');
    console.log('Fieldname:', file.fieldname);
    console.log('Detected file.mimetype:', file.mimetype);
    
    if (file.fieldname === 'video') {
      const allowedVideoTypes = process.env.ALLOWED_VIDEO_TYPES?.split(',') || [
        'video/mp4',
        'video/avi',
        'video/mov',
        'video/wmv'
      ];
      console.log('Allowed video types:', allowedVideoTypes);
      console.log('Is video mimetype allowed?', allowedVideoTypes.includes(file.mimetype));
      if (allowedVideoTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type for video. Only specified video types are allowed.'), false);
      }
    } else if (file.fieldname === 'thumbnail') {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      console.log('Allowed image types:', allowedImageTypes);
      console.log('Is image mimetype allowed?', allowedImageTypes.includes(file.mimetype));
      if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type for thumbnail. Only JPEG, PNG, JPG are allowed.'), false);
      }
    } else {
      // Should not happen with current setup
      console.log('Unexpected fieldname:', file.fieldname);
      cb(new Error('Unexpected fieldname for file upload.'), false);
    }
    console.log('-------------------------');
  },
});

// Multer configuration pour les thumbnails
const uploadThumbnail = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for thumbnails
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    // Minimal debug for thumbnail-specific upload, if needed later
    // console.log('--- Thumbnail-only Filter ---');
    // console.log('Detected file.mimetype:', file.mimetype);
    // console.log('Allowed image types:', allowedTypes);
    // console.log('Is image mimetype allowed?', allowedTypes.includes(file.mimetype));
    // console.log('-----------------------------');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed for thumbnails.'), false);
    }
  },
});

// Configuration Multer pour les images
const uploadImage = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    console.log('--- Image Filter Debug ---');
    console.log('Detected file.mimetype:', file.mimetype);
    console.log('Allowed image types:', allowedTypes);
    console.log('Is image mimetype allowed?', allowedTypes.includes(file.mimetype));
    console.log('-------------------------');
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  },
});

/**
 * Upload a video file to Bunny CDN
 * @param {Object} file - Multer file object
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadVideoToBunny(file) {
  return await uploadToBunny(file.buffer, file.originalname, 'videos', file.mimetype);
}

/**
 * Upload a thumbnail file to Bunny CDN
 * @param {Object} file - Multer file object
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadThumbnailToBunny(file) {
  return await uploadToBunny(file.buffer, file.originalname, 'thumbnails', file.mimetype);
}

/**
 * Upload an image file to Bunny CDN
 * @param {Object} file - Multer file object
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadImageToBunny(file) {
  return await uploadToBunny(file.buffer, file.originalname, 'images', file.mimetype);
}

/**
 * Upload a file from file system to Bunny CDN
 * @param {string} filePath - Path to the file on filesystem
 * @param {string} fileName - Name for the file
 * @param {string} folder - Folder to upload to
 * @param {string} contentType - MIME type
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadFileToBunny(filePath, fileName, folder = 'files', contentType = 'application/octet-stream') {
  const fs = require('fs').promises;
  const fileBuffer = await fs.readFile(filePath);
  return await uploadToBunny(fileBuffer, fileName, folder, contentType);
}

/**
 * Delete a file from Bunny CDN (replacement for deleteFromS3)
 * @param {string} fileKey - Key/path of the file to delete
 * @returns {Promise<boolean>}
 */
async function deleteFromBunnyWrapper(fileKey) {
  try {
    const result = await deleteFromBunny(fileKey);
    console.log(`✅ File deleted from Bunny CDN: ${fileKey}`);
    return result;
  } catch (error) {
    console.error('❌ Error deleting file from Bunny CDN:', error);
    return false;
  }
}

/**
 * Generate a public URL for a file (replacement for generateSignedUrl)
 * Since Bunny CDN files are public via CDN, we just return the CDN URL
 * @param {string} fileKey - Key/path of the file
 * @param {number} expiresIn - Not used for Bunny CDN (files are public)
 * @returns {string}
 */
function generatePublicUrl(fileKey, expiresIn = 3600) {
  // For Bunny CDN, files are publicly accessible via CDN
  // The expiresIn parameter is ignored as files are public
  return bunnyConfig.getCdnUrl(fileKey);
}

module.exports = {
  // Multer configurations
  uploadVideo,
  uploadThumbnail,
  uploadImage,
  
  // Upload functions
  uploadVideoToBunny,
  uploadThumbnailToBunny,
  uploadImageToBunny,
  uploadFileToBunny,
  
  // Management functions
  deleteFromBunny: deleteFromBunnyWrapper,
  generatePublicUrl,
  
  // Legacy compatibility (for gradual migration)
  deleteFromS3: deleteFromBunnyWrapper, // Alias for backward compatibility
  generateSignedUrl: generatePublicUrl, // Alias for backward compatibility
  
  // Bunny CDN configuration
  bunnyConfig
};