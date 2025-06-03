const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Multer S3 configuration for video uploads
const uploadVideo = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    // acl: 'public-read', // Removed: Bucket does not allow ACLs
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileName = `videos/${uniqueSuffix}-${file.originalname}`;
      cb(null, fileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
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

// Multer S3 configuration for thumbnail uploads
const uploadThumbnail = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    // acl: 'public-read', // Removed: Bucket does not allow ACLs
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileName = `thumbnails/${uniqueSuffix}-${file.originalname}`;
      cb(null, fileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
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

// Function to delete file from S3
const deleteFromS3 = async (fileKey) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
    };
    
    await s3.deleteObject(params).promise();
    console.log(`✅ File deleted from S3: ${fileKey}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting file from S3:', error);
    return false;
  }
};

// Function to generate signed URL for private access
const generateSignedUrl = (fileKey, expiresIn = 3600) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileKey,
    Expires: expiresIn, // URL expires in 1 hour by default
  };
  
  return s3.getSignedUrl('getObject', params);
};

module.exports = {
  s3,
  uploadVideo,
  uploadThumbnail,
  deleteFromS3,
  generateSignedUrl,
};