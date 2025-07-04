import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  Download, 
  Share, 
  MessageCircle,
  Image as ImageIcon,
  User,
  Sparkles,
  Calendar,
  Eye,
  MoreHorizontal,
  Plus,
  Upload,
  Camera,
  RefreshCw
} from 'lucide-react';
import apiService from '../services/api';
import FluxImageGenerator from './FluxImageGenerator';
import PublishModal from './PublishModal';
import BloomLogo from '../assets/Bloom_LOGO.jpg';
import './ImageFeed.css';
import LoadingSpinner from './LoadingSpinner';

const ImageFeed = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likingStatus, setLikingStatus] = useState({});
  
  // Modal states
  const [showFluxModal, setShowFluxModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pendingUpload, setPendingUpload] = useState(null);
  
  // Comments states
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [currentImageId, setCurrentImageId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [commentsCount, setCommentsCount] = useState({});

  // Load published images
  const loadImages = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (!append) setLoading(true);
      
      const response = await apiService.getPublishedImages({ 
        page: pageNum, 
        limit: 12 
      });
      
      if (response.status === 'success') {
        const newImages = response.data.images || [];
        
        if (append) {
          setImages(prev => [...prev, ...newImages]);
        } else {
          setImages(newImages);
        }
        
        setHasMore(newImages.length === 12);
        setPage(pageNum);
      } else {
        throw new Error(response.message || 'Error loading images');
      }
    } catch (error) {
      console.error('Error loading images:', error);
      setError(error.message || 'Error loading images');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Refresh images
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setError('');
    loadImages(1, false);
  }, [loadImages]);

  // Load more images
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadImages(page + 1, true);
    }
  }, [loading, hasMore, page, loadImages]);

  // Like/unlike image - Improved version with optimistic update
  const handleLike = useCallback(async (imageId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (likingStatus[imageId]) {
      console.log('❤️ [ImageLike] Already processing like for image:', imageId);
      return; // Prevent multiple rapid clicks
    }

    setLikingStatus(prev => ({ ...prev, [imageId]: true }));

    const currentUserId = apiService.getCurrentUserId();
    if (!currentUserId) {
      console.error("❤️ [ImageLike] User ID not found. Cannot perform like.");
      setLikingStatus(prev => ({ ...prev, [imageId]: false }));
      return;
    }

    const imageIndex = images.findIndex(img => img._id === imageId);
    if (imageIndex === -1) {
      console.error("❤️ [ImageLike] Image not found in state:", imageId);
      setLikingStatus(prev => ({ ...prev, [imageId]: false }));
      return;
    }

    const originalImage = JSON.parse(JSON.stringify(images[imageIndex])); // Deep copy for reliable revert

    // Optimistic update
    setImages(prevImages => {
      const newImages = [...prevImages];
      const imageToUpdate = { ...newImages[imageIndex] }; // Work on a copy

      const isCurrentlyLiked = imageToUpdate.likes?.includes(currentUserId);
      
      if (isCurrentlyLiked) {
        imageToUpdate.likes = (imageToUpdate.likes || []).filter(id => id !== currentUserId);
        imageToUpdate.likesCount = (imageToUpdate.likesCount || 1) - 1;
      } else {
        imageToUpdate.likes = [...(imageToUpdate.likes || []), currentUserId];
        imageToUpdate.likesCount = (imageToUpdate.likesCount || 0) + 1;
      }
      imageToUpdate.likesCount = Math.max(0, imageToUpdate.likesCount); // Ensure likesCount is not negative

      newImages[imageIndex] = imageToUpdate;
      return newImages;
    });

    try {
      console.log('❤️ [ImageLike] Making API call for image:', imageId);
      const response = await apiService.likeImage(imageId);
      console.log('❤️ [ImageLike] API response for image:', imageId, response);
      
      if (response.status === 'success') {
        // Sync with server state if necessary, especially likesCount
        setImages(prevImages => prevImages.map(img => {
          if (img._id === imageId) {
            const serverUserId = response.data.userId; // Should be currentUserId
            const serverLiked = response.data.liked;
            const serverLikesCount = response.data.likesCount;

            const updatedImg = { ...img, likesCount: serverLikesCount };
            
            // Reconcile likes array based on server response for the current user
            let currentLikesOptimistic = [...(img.likes || [])]; // Take from current state (which is optimistic)
            if (serverLiked) {
              if (!currentLikesOptimistic.includes(serverUserId)) {
                currentLikesOptimistic.push(serverUserId);
              }
            } else {
              currentLikesOptimistic = currentLikesOptimistic.filter(id => id !== serverUserId);
            }
            updatedImg.likes = currentLikesOptimistic;
            
            // Double check integrity of likesCount with actual likes array length for the current user
            // This is a safety, serverLikesCount should be the source of truth for the count.
            // updatedImg.likesCount = updatedImg.likes.length; // Or trust serverLikesCount

            return updatedImg;
          }
          return img;
        }));
        console.log('❤️ [ImageLike] API call successful, state synced with server for image:', imageId);
      } else {
        console.error('❤️ [ImageLike] API error (not success status) for image:', imageId, response.message);
        // Revert optimistic update
        setImages(prevImages => prevImages.map(img => 
          img._id === imageId ? originalImage : img
        ));
      }
    } catch (error) {
      console.error('❤️ [ImageLike] Network/request error, reverting optimistic update for image:', imageId, error);
      // Revert optimistic update
      setImages(prevImages => prevImages.map(img => 
        img._id === imageId ? originalImage : img
      ));
    } finally {
      setLikingStatus(prev => ({ ...prev, [imageId]: false }));
    }
  }, [images, likingStatus]);

  // Handle comment action
  const handleComment = useCallback(async (imageId) => {
    console.log('Comment on image:', imageId);
    setCurrentImageId(imageId);
    setShowCommentsModal(true);
    setComments([]);
    setCommentsError('');
    
    // Load comments for this image
    try {
      setCommentsLoading(true);
      const response = await apiService.getImageComments(imageId, { page: 1, limit: 20 });
      
      if (response.status === 'success') {
        setComments(response.data.comments || []);
        setCommentsCount(prev => ({
          ...prev,
          [imageId]: response.data.pagination?.total || 0
        }));
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      setCommentsError('Error loading comments');
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  // Add comment
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !currentImageId || addingComment) return;
    
    try {
      setAddingComment(true);
      const response = await apiService.addImageComment(currentImageId, newComment.trim());
      
      if (response.status === 'success') {
        // Add comment to local state
        setComments(prev => [response.data.comment, ...prev]);
        setNewComment('');
        
        // Update comments count
        setCommentsCount(prev => ({
          ...prev,
          [currentImageId]: (prev[currentImageId] || 0) + 1
        }));
      } else {
        throw new Error(response.message || 'Error adding comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setCommentsError('Error adding comment');
    } finally {
      setAddingComment(false);
    }
  }, [newComment, currentImageId, addingComment]);

  // Handle modal close
  const handleCloseUploadModal = useCallback(() => {
    console.log('❌ [COMPONENT] handleCloseUploadModal called');
    setShowUploadModal(false);
    setUploadError('');
    setUploading(false);
    console.log('❌ [COMPONENT] Upload modal closed and states reset');
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((event) => {
    console.log('📁 [COMPONENT] handleFileUpload called');
    console.log('📁 [COMPONENT] Event target:', event.target);
    console.log('📁 [COMPONENT] Files:', event.target.files);
    
    const file = event.target.files[0];
    console.log('📁 [COMPONENT] Selected file:', file);
    
    if (!file) {
      console.log('📁 [COMPONENT] No file selected');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      console.log('📁 [COMPONENT] Invalid file type:', file.type);
      setUploadError('Please select a valid image file');
      return;
    }

    console.log('📁 [COMPONENT] File validation passed');
    console.log('📁 [COMPONENT] File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    // Create preview URL
    console.log('📁 [COMPONENT] Creating preview URL...');
    const previewUrl = URL.createObjectURL(file);
    console.log('📁 [COMPONENT] Preview URL created:', previewUrl);
    
    // Store file and preview for publish modal
    const uploadData = {
      file: file,
      preview: previewUrl
    };
    console.log('📁 [COMPONENT] Setting pending upload data:', uploadData);
    setPendingUpload(uploadData);

    // Close upload modal and open publish modal
    console.log('📁 [COMPONENT] Closing upload modal, opening publish modal');
    setShowUploadModal(false);
    setShowPublishModal(true);
    
    // Reset file input
    console.log('📁 [COMPONENT] Resetting file input');
    event.target.value = '';
    console.log('📁 [COMPONENT] handleFileUpload completed');
  }, []);

  // Handle publish from modal
  const handlePublishImage = useCallback(async (publishData) => {
    if (!pendingUpload) {
      console.log('❌ No pending upload data');
      return;
    }

    console.log('🚀 Starting image publication...', publishData);

    try {
      setUploading(true);
      setUploadError('');

      // Create form data with custom text
      const formData = new FormData();
      formData.append('image', pendingUpload.file);
      
      // Use caption as description, and file name as title (or no title if caption exists)
      if (publishData.caption && publishData.caption.trim()) {
        formData.append('title', ''); // No title to avoid duplication
        formData.append('description', publishData.caption.trim());
      } else {
        formData.append('title', pendingUpload.file.name.split('.')[0]);
        formData.append('description', 'Image uploaded from device');
      }
      
      // Add hashtags if provided
      if (publishData.hashtags && publishData.hashtags.length > 0) {
        formData.append('hashtags', JSON.stringify(publishData.hashtags));
      }

      console.log('📤 Uploading image to server...');
      console.log('📋 FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, typeof value === 'object' ? value.name || 'File object' : value);
      }
      
      // Add timeout for the upload
      const uploadPromise = apiService.uploadImage(formData);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout - please try again')), 60000)
      );
      
      const response = await Promise.race([uploadPromise, timeoutPromise]);
      
      console.log('📦 Upload response:', response);
      console.log('📦 Response status:', response?.status);
      console.log('📦 Response success:', response?.success);
      console.log('📦 Response message:', response?.message);

      // Check for success in different response formats
      const isSuccess = (response?.status === 'success') || 
                       (response?.success === true) || 
                       (response?.data?.image && !response?.error);

      if (isSuccess) {
        console.log('✅ Image uploaded successfully!');
        
        // Close modal and cleanup
        setShowPublishModal(false);
        URL.revokeObjectURL(pendingUpload.preview);
        setPendingUpload(null);
        setUploadError('');
        
        // Refresh the feed to show the new image
        console.log('🔄 Refreshing image feed...');
        setTimeout(() => {
          loadImages(1, false);
        }, 2000); // Augmenté le délai pour s'assurer que l'image est bien traitée
        
        console.log('✅ Image published and feed refresh initiated!');
      } else {
        console.log('❌ Upload failed:', response);
        console.log('❌ Full response object:', JSON.stringify(response, null, 2));
        
        // Vérifier si c'est juste un problème de modération mais que l'upload a réussi
        if (response?.data?.image && response?.moderation?.status === 'rejected') {
          console.log('⚠️ Image uploaded but moderation failed - still showing as success to user');
          
          // Close modal and cleanup
          setShowPublishModal(false);
          URL.revokeObjectURL(pendingUpload.preview);
          setPendingUpload(null);
          setUploadError('');
          
          // Refresh the feed
          setTimeout(() => {
            loadImages(1, false);
          }, 2000);
          
          return; // Sortir de la fonction car c'est un succès partiel
        }
        
        const errorMessage = response?.message || 
                            response?.error || 
                            response?.data?.message || 
                            response?.data?.error || 
                            'Publication failed - please try again';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('❌ Publish error:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Publication failed - please try again';
      
      if (error.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Upload timed out. Please check your internet connection and try again.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setUploadError(errorMessage);
      
      // Don't close modal on error, let user try again
    } finally {
      setUploading(false);
      console.log('🏁 Upload process completed');
    }
  }, [pendingUpload, loadImages]);

  // Handle cancel publish
  const handleCancelPublish = useCallback(() => {
    if (pendingUpload) {
      URL.revokeObjectURL(pendingUpload.preview);
      setPendingUpload(null);
    }
    setShowPublishModal(false);
  }, [pendingUpload]);

  if (loading && images.length === 0) {
    return (
      <div className="video-catalog loading video-catalog-loading">
        <LoadingSpinner text="Loading images..." size="medium" variant="pulse" />
      </div>
    );
  }

  if (error && images.length === 0) {
    return (
      <div className="image-feed">
        <div className="error-container">
          <ImageIcon size={64} />
          <h3>Error loading</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="image-feed">
      {/* Header avec logo */}
      <div className="image-feed-header">
        <div className="header-left">
          <img src={BloomLogo} alt="Logo Bloom" style={{ height: 50, maxWidth: 140, width: 'auto', objectFit: 'contain', display: 'block' }} />
        </div>
      </div>

      {/* Images Grid */}
      {images.length === 0 ? (
        <div className="empty-feed">
          <ImageIcon size={64} />
          <h3>Aucune image</h3>
          <p>Les images publiées apparaîtront ici</p>
        </div>
      ) : (
        <>
          <div className="images-grid">
            <AnimatePresence>
              {images.map((image, index) => (
                <motion.div
                  key={image._id}
                  className="image-post"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {/* Image */}
                  <div className="image-container">
                    <img 
                      src={image.imageUrl} 
                      alt={image.title || 'Generated image'} 
                      className="post-image" 
                      loading="lazy"
                    />
                  </div>

                  {/* Post Info */}
                  <div className="post-info">
                    {/* User Info */}
                    <div className="post-header">
                      <div className="user-info">
                        <div className="user-avatar">
                          {image.user?.avatar ? (
                            <img src={image.user.avatar} alt={image.user.displayName} />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        <div className="user-details">
                          <span className="username">
                            {image.user?.displayName || image.user?.username || 'User'}
                          </span>
                          <span className="post-date">
                            <Calendar size={12} />
                            {new Date(image.createdAt).toLocaleDateString('en-US')}
                          </span>
                        </div>
                      </div>
                      
                      <button className="more-button">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="post-content">
                      {/* Only show title if it exists, is not empty, and is different from description */}
                      {image.title && 
                       image.title.trim() && 
                       image.title.trim() !== '' &&
                       image.title !== image.description && 
                       image.title.trim() !== image.description?.trim() && (
                        <h3 className="post-title">{image.title}</h3>
                      )}
                      
                      {image.description && image.description.trim() && (
                        <p className="post-description">
                          {image.description.length > 300 
                            ? image.description.substring(0, 300) + '...'
                            : image.description
                          }
                        </p>
                      )}

                      {/* Hashtags */}
                      {image.hashtags && image.hashtags.length > 0 && (
                        <div className="hashtags">
                          {image.hashtags.slice(0, 5).map((tag, idx) => (
                            <span key={idx} className="hashtag">#{tag}</span>
                          ))}
                          {image.hashtags.length > 5 && (
                            <span className="hashtag-more">+{image.hashtags.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="post-actions">
                      {/* Like button - Recreated for better click handling */}
                      <div
                        onClick={(e) => handleLike(image._id, e)}
                        onTouchEnd={(e) => handleLike(image._id, e)}
                        className={`action-button like-button ${
                          image.likes?.includes(apiService.getCurrentUserId()) ? 'liked' : ''
                        }`}
                        title="Like"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: '20px',
                          transition: 'all 0.2s ease',
                          fontSize: '14px',
                          fontWeight: '500',
                          pointerEvents: 'auto'
                        }}
                      >
                        <Heart
                          size={16}
                          fill={image.likes?.includes(apiService.getCurrentUserId()) ? '#ff0050' : 'none'}
                          style={{ pointerEvents: 'none' }}
                        />
                        <span
                          className="action-count"
                          style={{ pointerEvents: 'none' }}
                        >
                          {image.likesCount || image.likes?.length || 0}
                        </span>
                      </div>

                      {/* Comment button - Recreated for better click handling */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleComment(image._id);
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleComment(image._id);
                        }}
                        className="action-button comment-button"
                        title="Comment"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: '20px',
                          transition: 'all 0.2s ease',
                          fontSize: '14px',
                          fontWeight: '500',
                          pointerEvents: 'auto'
                        }}
                      >
                        <MessageCircle
                          size={16}
                          style={{ pointerEvents: 'none' }}
                        />
                        <span
                          className="action-count"
                          style={{ pointerEvents: 'none' }}
                        >
                          {commentsCount[image._id] || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="load-more-container">
              <button 
                onClick={handleLoadMore}
                className="load-more-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles size={20} />
                    </motion.div>
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Bouton de création flottant - Design Apple Minimaliste avec fond noir */}
      <div className="create-image-fab">
        <button 
          className="fab-button-dark"
          onClick={() => setShowUploadModal(true)}
          aria-label="Create an image"
        >
          <Plus size={20} strokeWidth={2} />
          <div className="fab-shine-dark"></div>
        </button>
        <div className="fab-label-dark">New image</div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseUploadModal}
          >
            <motion.div
              className="upload-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Upload an image</h3>
              <p style={{ margin: '0 0 1.5rem 0', color: '#86868b', fontSize: '14px' }}>
                Select an image from your device to share with the community
              </p>
              
              {uploadError && (
                <div className="error-message">
                  {uploadError}
                </div>
              )}
              
              <div className="upload-area">
                <Camera size={48} style={{ color: '#00d4aa', marginBottom: '0.5rem' }} />
                <p style={{ fontWeight: '600', color: '#1d1d1f', marginBottom: '0.25rem' }}>
                  Select an image from your device
                </p>
                <p style={{ fontSize: '12px', color: '#86868b', margin: 0 }}>
                  Supported formats: JPG, PNG, WebP • Max 10MB
                </p>
                
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  id="image-upload"
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
                <label 
                  htmlFor="image-upload" 
                  className={`upload-button ${uploading ? 'uploading' : ''}`}
                  style={{ marginTop: '1rem' }}
                >
                  {uploading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        style={{ display: 'inline-block', marginRight: '0.5rem' }}
                      >
                        <Sparkles size={16} />
                      </motion.div>
                      Processing...
                    </>
                  ) : (
                    'Choose an image'
                  )}
                </label>
              </div>
              
              <button 
                className="cancel-button"
                onClick={handleCloseUploadModal}
                disabled={uploading}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLUX AI Modal */}
      <AnimatePresence>
        {showFluxModal && (
          <motion.div
            className="modal-overlay flux-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flux-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
              <div className="flux-modal-content">
                <FluxImageGenerator />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Modal */}
      <AnimatePresence>
        {showCommentsModal && (
          <motion.div
            className="modal-overlay comments-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCommentsModal(false)}
          >
            <motion.div
              className="comments-modal"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="comments-modal-header">
                <h3>Comments</h3>
                <button 
                  className="close-button"
                  onClick={() => setShowCommentsModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="comments-modal-content">
                {/* Add comment form */}
                <div className="add-comment-form">
                  <div className="comment-input-container">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      maxLength={500}
                      disabled={addingComment}
                      rows={3}
                    />
                    <button 
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addingComment}
                      className={`send-comment-btn ${addingComment ? 'sending' : ''}`}
                    >
                      {addingComment ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Sparkles size={16} />
                        </motion.div>
                      ) : (
                        'Publish'
                      )}
                    </button>
                  </div>
                  <div className="comment-counter">
                    {newComment.length}/500
                  </div>
                </div>

                {/* Comments list */}
                <div className="comments-list">
                  {commentsError && (
                    <div className="error-message">
                      {commentsError}
                    </div>
                  )}

                  {commentsLoading ? (
                    <div className="comments-loading">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles size={24} />
                      </motion.div>
                      <p>Loading comments...</p>
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="no-comments">
                      <MessageCircle size={48} />
                      <p>No comments</p>
                      <span>Be the first to comment on this image!</span>
                    </div>
                  ) : (
                    <div className="comments-container">
                      {comments.map((comment) => (
                        <div key={comment._id} className="comment-item">
                          <div className="comment-avatar">
                            {comment.user?.avatar ? (
                              <img src={comment.user.avatar} alt={comment.user.displayName} />
                            ) : (
                              <User size={24} />
                            )}
                          </div>
                          <div className="comment-content">
                            <div className="comment-header">
                              <span className="comment-username">
                                {comment.user?.displayName || comment.user?.username || 'User'}
                              </span>
                              <span className="comment-date">
                                {new Date(comment.createdAt).toLocaleDateString('en-US')}
                              </span>
                            </div>
                            <p className="comment-text">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Publish Modal */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={handleCancelPublish}
        onPublish={handlePublishImage}
        imagePreview={pendingUpload?.preview}
        isPublishing={uploading}
        error={uploadError}
      />
    </div>
  );
};

export default ImageFeed;