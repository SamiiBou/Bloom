const axios = require('axios');
const path = require('path');

// Configuration Bunny CDN
const bunnyConfig = {
  storageZoneName: process.env.BUNNY_STORAGE_ZONE_NAME || 'bloom-storage',
  accessKey: process.env.BUNNY_STORAGE_ACCESS_KEY,
  region: process.env.BUNNY_STORAGE_REGION || '', // Empty string for Frankfurt (default)
  cdnUrl: process.env.BUNNY_CDN_URL || 'https://bloom-vid.b-cdn.net',
  
  // API endpoints based on region
  getStorageEndpoint() {
    const baseEndpoint = 'storage.bunnycdn.com';
    return this.region ? `${this.region}.${baseEndpoint}` : baseEndpoint;
  },
  
  // Get full storage URL for a file
  getStorageUrl(filePath) {
    return `https://${this.getStorageEndpoint()}/${this.storageZoneName}/${filePath}`;
  },
  
  // Get CDN URL for a file
  getCdnUrl(filePath) {
    return `${this.cdnUrl}/${filePath}`;
  }
};

/**
 * Upload a file to Bunny CDN storage
 * @param {Buffer|Stream} fileData - File data to upload
 * @param {string} fileName - Name of the file
 * @param {string} folder - Folder to upload to (e.g., 'videos', 'images', 'thumbnails')
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<{url: string, key: string, cdnUrl: string}>}
 */
async function uploadToBunny(fileData, fileName, folder = 'files', contentType = 'application/octet-stream') {
  if (!bunnyConfig.accessKey) {
    throw new Error('BUNNY_STORAGE_ACCESS_KEY is not configured');
  }

  // Generate unique file name
  const fileExtension = path.extname(fileName);
  const baseName = path.basename(fileName, fileExtension);
  const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${baseName}${fileExtension}`;
  const filePath = `${folder}/${uniqueFileName}`;
  
  const uploadUrl = bunnyConfig.getStorageUrl(filePath);
  
  try {
    console.log(`🐰 Uploading to Bunny CDN: ${uploadUrl}`);
    
    const response = await axios.put(uploadUrl, fileData, {
      headers: {
        'AccessKey': bunnyConfig.accessKey,
        'Content-Type': contentType,
        'accept': 'application/json'
      },
      timeout: 120000, // 2 minutes timeout
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (response.status === 201) {
      console.log(`✅ File uploaded successfully to Bunny CDN: ${filePath}`);
      return {
        url: bunnyConfig.getCdnUrl(filePath), // Return CDN URL for public access
        key: filePath, // Store the path for management
        cdnUrl: bunnyConfig.getCdnUrl(filePath),
        storageUrl: uploadUrl // Direct storage URL (for internal use)
      };
    } else {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Bunny CDN upload error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Delete a file from Bunny CDN storage
 * @param {string} filePath - Path to the file to delete
 * @returns {Promise<boolean>}
 */
async function deleteFromBunny(filePath) {
  if (!bunnyConfig.accessKey) {
    throw new Error('BUNNY_STORAGE_ACCESS_KEY is not configured');
  }

  const deleteUrl = bunnyConfig.getStorageUrl(filePath);
  
  try {
    console.log(`🗑️ Deleting from Bunny CDN: ${deleteUrl}`);
    
    const response = await axios.delete(deleteUrl, {
      headers: {
        'AccessKey': bunnyConfig.accessKey,
        'accept': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });
    
    if (response.status === 200) {
      console.log(`✅ File deleted successfully from Bunny CDN: ${filePath}`);
      return true;
    } else {
      console.log(`⚠️ Delete response status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Bunny CDN delete error:', error.message);
    if (error.response && error.response.status === 404) {
      console.log('File not found, considering as deleted');
      return true;
    }
    return false;
  }
}

/**
 * Download a file from Bunny CDN storage
 * @param {string} filePath - Path to the file to download
 * @returns {Promise<Buffer>}
 */
async function downloadFromBunny(filePath) {
  if (!bunnyConfig.accessKey) {
    throw new Error('BUNNY_STORAGE_ACCESS_KEY is not configured');
  }

  const downloadUrl = bunnyConfig.getStorageUrl(filePath);
  
  try {
    console.log(`📥 Downloading from Bunny CDN: ${downloadUrl}`);
    
    const response = await axios.get(downloadUrl, {
      headers: {
        'AccessKey': bunnyConfig.accessKey,
        'accept': 'application/octet-stream'
      },
      responseType: 'arraybuffer',
      timeout: 120000 // 2 minutes timeout
    });
    
    console.log(`✅ File downloaded successfully from Bunny CDN: ${filePath}`);
    return Buffer.from(response.data);
  } catch (error) {
    console.error('❌ Bunny CDN download error:', error.message);
    throw error;
  }
}

/**
 * Check if a file exists in Bunny CDN storage
 * @param {string} filePath - Path to the file to check
 * @returns {Promise<boolean>}
 */
async function fileExistsInBunny(filePath) {
  if (!bunnyConfig.accessKey) {
    throw new Error('BUNNY_STORAGE_ACCESS_KEY is not configured');
  }

  const checkUrl = bunnyConfig.getStorageUrl(filePath);
  
  try {
    const response = await axios.head(checkUrl, {
      headers: {
        'AccessKey': bunnyConfig.accessKey
      },
      timeout: 10000 // 10 seconds timeout
    });
    
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * List files in a directory
 * @param {string} directoryPath - Path to the directory
 * @returns {Promise<Array>}
 */
async function listFilesInBunny(directoryPath = '') {
  if (!bunnyConfig.accessKey) {
    throw new Error('BUNNY_STORAGE_ACCESS_KEY is not configured');
  }

  const listUrl = bunnyConfig.getStorageUrl(directoryPath);
  
  try {
    console.log(`📂 Listing files in Bunny CDN: ${listUrl}`);
    
    const response = await axios.get(listUrl, {
      headers: {
        'AccessKey': bunnyConfig.accessKey,
        'accept': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });
    
    return response.data || [];
  } catch (error) {
    console.error('❌ Bunny CDN list error:', error.message);
    throw error;
  }
}

module.exports = {
  bunnyConfig,
  uploadToBunny,
  deleteFromBunny,
  downloadFromBunny,
  fileExistsInBunny,
  listFilesInBunny
}; 