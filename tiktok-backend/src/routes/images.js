const express = require('express');
const { protect } = require('../middleware/auth');
const Image = require('../models/Image');
const ImageComment = require('../models/ImageComment');
const User = require('../models/User');
const router = express.Router();

/**
 * GET /api/images
 * Get published images (public feed)
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const sortBy = req.query.sortBy || 'createdAt'; // createdAt, likes, title
    const order = req.query.order === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    console.log(`📋 Getting published images - Page: ${page}, Limit: ${limit}, Sort: ${sortBy}`);

    // Build sort object
    let sort = {};
    if (sortBy === 'likes') {
      // Sort by number of likes (using virtual field)
      sort = { likesCount: order, createdAt: -1 };
    } else if (sortBy === 'title') {
      sort = { title: order, createdAt: -1 };
    } else {
      sort = { createdAt: order };
    }

    // Get images with user information populated
    const images = await Image.find({
      // Filtre de modération: uniquement les images approuvées
      moderationStatus: 'approved'
    })
      .populate('user', 'username displayName avatar verified')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Add likesCount to each image
    const imagesWithCounts = images.map(image => ({
      ...image,
      likesCount: image.likes ? image.likes.length : 0
    }));

    // Get total count for pagination (seulement les images approuvées)
    const total = await Image.countDocuments({ moderationStatus: 'approved' });

    console.log(`✅ Found ${images.length} images out of ${total} total`);

    res.json({
      status: 'success',
      data: {
        images: imagesWithCounts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching published images:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch images',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/images/:id
 * Get a specific image by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const image = await Image.findById(id)
      .populate('user', 'username displayName avatar verified')
      .lean();

    if (!image) {
      return res.status(404).json({
        status: 'error',
        message: 'Image not found'
      });
    }

    // Add likesCount
    const imageWithCount = {
      ...image,
      likesCount: image.likes ? image.likes.length : 0
    };

    res.json({
      status: 'success',
      data: {
        image: imageWithCount
      }
    });

  } catch (error) {
    console.error('❌ Error fetching image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/images/:id/like
 * Like/unlike an image
 */
router.post('/:id/like', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log(`❤️ Like action for image ${id} by user ${userId}`);

    const image = await Image.findById(id);
    
    if (!image) {
      return res.status(404).json({
        status: 'error',
        message: 'Image not found'
      });
    }

    // Check if user already liked the image
    const hasLiked = image.likes.includes(userId);
    
    if (hasLiked) {
      // Unlike: remove user from likes array
      image.likes = image.likes.filter(likeUserId => !likeUserId.equals(userId));
      console.log(`👎 User ${userId} unliked image ${id}`);
    } else {
      // Like: add user to likes array
      image.likes.push(userId);
      console.log(`👍 User ${userId} liked image ${id}`);
    }

    await image.save();

    // Populate user info for response
    await image.populate('user', 'username displayName avatar verified');

    res.json({
      status: 'success',
      data: {
        imageId: id,
        liked: !hasLiked,
        likesCount: image.likes.length,
        userId: userId.toString(),
        image: {
          ...image.toObject(),
          likesCount: image.likes.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error toggling like:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to toggle like',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/images/user/:userId
 * Get images by specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    console.log(`👤 Getting images for user ${userId}`);

    const images = await Image.find({ 
      user: userId,
      // Filtre de modération: uniquement les images approuvées
      moderationStatus: 'approved'
    })
      .populate('user', 'username displayName avatar verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add likesCount to each image
    const imagesWithCounts = images.map(image => ({
      ...image,
      likesCount: image.likes ? image.likes.length : 0
    }));

    const total = await Image.countDocuments({ 
      user: userId,
      moderationStatus: 'approved'
    });

    res.json({
      status: 'success',
      data: {
        images: imagesWithCounts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user images:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user images',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/images/:id
 * Delete an image (only by owner)
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const image = await Image.findById(id);
    
    if (!image) {
      return res.status(404).json({
        status: 'error',
        message: 'Image not found'
      });
    }

    // Check if user owns the image
    if (!image.user.equals(userId)) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this image'
      });
    }

    await Image.findByIdAndDelete(id);

    // Update user image count
    await User.findByIdAndUpdate(userId, {
      $inc: { imagesCount: -1 }
    });

    console.log(`🗑️ Image ${id} deleted by user ${userId}`);

    res.json({
      status: 'success',
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/images/stats/popular
 * Get popular images (most liked)
 */
router.get('/stats/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    console.log(`📊 Getting ${limit} most popular images`);

    // Aggregate to get images sorted by likes count
    const popularImages = await Image.aggregate([
      {
        $addFields: {
          likesCount: { $size: '$likes' }
        }
      },
      {
        $match: {
          likesCount: { $gt: 0 } // Only images with at least 1 like
        }
      },
      {
        $sort: { likesCount: -1, createdAt: -1 }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                username: 1,
                displayName: 1,
                avatar: 1,
                verified: 1
              }
            }
          ]
        }
      },
      {
        $unwind: '$user'
      }
    ]);

    console.log(`✅ Found ${popularImages.length} popular images`);

    res.json({
      status: 'success',
      data: {
        images: popularImages
      }
    });

  } catch (error) {
    console.error('❌ Error fetching popular images:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch popular images',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/images/:id/comments
 * Add a comment to an image
 */
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentComment } = req.body;
    const userId = req.user._id;

    console.log(`💬 Adding comment to image ${id} by user ${userId}`);

    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Comment content is required'
      });
    }

    if (content.trim().length > 500) {
      return res.status(400).json({
        status: 'error',
        message: 'Comment is too long (max 500 characters)'
      });
    }

    // Check if image exists
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({
        status: 'error',
        message: 'Image not found'
      });
    }

    // Create comment
    const comment = new ImageComment({
      image: id,
      user: userId,
      content: content.trim(),
      parentComment: parentComment || null
    });

    await comment.save();

    // Populate user data for response
    await comment.populate('user', 'username displayName avatar verified');

    console.log(`✅ Comment added successfully: ${comment._id}`);

    res.status(201).json({
      status: 'success',
      data: {
        comment: {
          ...comment.toObject(),
          likesCount: 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Error adding comment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add comment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/images/:id/comments
 * Get comments for an image
 */
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log(`📋 Getting comments for image ${id} - Page: ${page}, Limit: ${limit}`);

    // Check if image exists
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({
        status: 'error',
        message: 'Image not found'
      });
    }

    // Get comments (only top-level comments, not replies)
    const comments = await ImageComment.find({
      image: id,
      parentComment: null,
      isDeleted: false
    })
      .populate('user', 'username displayName avatar verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add likesCount to each comment
    const commentsWithCounts = comments.map(comment => ({
      ...comment,
      likesCount: comment.likes ? comment.likes.length : 0
    }));

    // Get total count
    const total = await ImageComment.countDocuments({
      image: id,
      parentComment: null,
      isDeleted: false
    });

    console.log(`✅ Found ${comments.length} comments out of ${total} total`);

    res.json({
      status: 'success',
      data: {
        comments: commentsWithCounts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch comments',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 