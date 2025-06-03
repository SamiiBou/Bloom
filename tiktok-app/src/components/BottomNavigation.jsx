import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Home, Compass, Plus, MessageCircle, User, TestTube, Upload, PlayCircle, Gift, Sparkles, ImageIcon, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './BottomNavigation.css';
import apiService from '../services/api';
import UploadModal from './UploadModal';
import VideoPreviewModal from './VideoPreviewModal';
import UploadTracker from './UploadTracker';

const BottomNavigation = ({ currentPage, onPageChange, onVideoUploadSuccess }) => {
  const navItems = [
    { 
      id: 'home', 
      icon: Home, 
      label: 'Home',
      color: '#007AFF'
    },
    { 
      id: 'videos', 
      icon: PlayCircle, 
      label: 'Videos',
      color: '#AF52DE'
    },
    { 
      id: 'images', 
      icon: ImageIcon, 
      label: 'Images',
      color: '#32D74B'
    },
    { 
      id: 'profile', 
      icon: User, 
      label: 'Profile',
      color: '#FF9500'
    }
  ];

  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // States for upload tracking (persistent)
  const [currentUploadId, setCurrentUploadId] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const uploadPollIntervalRef = useRef(null);
  
  // Preview modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const showToast = useCallback((message, duration = 3000) => {
    setUploadStatus(message);
    setTimeout(() => setUploadStatus(''), duration);
  }, []);

  const handleCreateClick = useCallback(() => {
    if (!isUploading) {
      setShowUploadModal(true);
    }
  }, [isUploading]);

  const validateFile = useCallback((file) => {
    if (!file.type.startsWith('video/')) {
      throw new Error('Please select a video file');
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error('Video is too large (max 50MB)');
    }

    // Check video duration if possible
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 180) { // 3 minutes max
          reject(new Error('Video cannot exceed 3 minutes'));
        } else {
          resolve(file);
        }
      };
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Invalid video file'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFileUpload = useCallback(async (file) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatus('🔍 Validating file...');
      setUploadError(null);
      setUploadedVideo(null);

      // Validate file
      await validateFile(file);

      setUploadStatus('📤 Preparing upload...');
      setUploadProgress(5);

      const formData = new FormData();
      formData.append('video', file);
      
      const description = `New video uploaded on ${new Date().toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      formData.append('description', description);

      // Ensure authentication
      const token = localStorage.getItem('authToken');
      if (token && token !== apiService.token) {
        apiService.setToken(token);
      }

      if (!apiService.token) {
        throw new Error('Authentication required. Please log in again.');
      }

      setUploadStatus('📤 Starting upload...');
      setUploadProgress(10);

      // Start upload and get upload ID
      const uploadResponse = await apiService.uploadVideo(formData);
      
      if (uploadResponse.status === 'accepted' && uploadResponse.data.uploadId) {
        const uploadId = uploadResponse.data.uploadId;
        setCurrentUploadId(uploadId);
        setUploadStatus('⚙️ Processing video...');
        setUploadProgress(20);

        // Close upload modal but keep tracking visible
        setShowUploadModal(false);
        
        // Start polling for upload progress
        uploadPollIntervalRef.current = setInterval(async () => {
          try {
            const statusResponse = await apiService.checkUploadTaskStatus(uploadId);
            
            if (statusResponse.status === 'success') {
              const task = statusResponse.data;
              
              // Update progress and status
              setUploadProgress(task.progress || 0);
              setUploadStatus(task.displayStatus || task.status);
              
              // Check if upload is complete
              if (task.status === 'SUCCEEDED') {
                clearInterval(uploadPollIntervalRef.current);
                setIsUploading(false);
                setUploadedVideo(task.video);
                setUploadStatus('✅ Video uploaded successfully!');
                setUploadProgress(100);
                
                // Call callback to refresh user videos
                if (onVideoUploadSuccess && task.video) {
                  onVideoUploadSuccess(task.video);
                }
                
                // Auto-hide after some time
                setTimeout(() => {
                  setCurrentUploadId(null);
                  setUploadedVideo(null);
                  setUploadStatus('');
                  setUploadProgress(0);
                }, 5000);
                
              } else if (task.status === 'FAILED') {
                clearInterval(uploadPollIntervalRef.current);
                setIsUploading(false);
                setUploadError(task.error || 'Upload failed');
                setUploadStatus('❌ Upload failed');
              }
            }
          } catch (pollError) {
            // Gestion spéciale pour le rate limiting (429)
            if (pollError.message?.includes('429')) {
              console.log('⏳ Rate limited, will retry on next poll...');
              // Ne pas arrêter le polling, juste ignorer cette itération
              return;
            }
            
            console.error('Error polling upload status:', pollError);
            // Continue polling pour les autres erreurs aussi - ne pas casser le polling pour une erreur ponctuelle
          }
        }, 3000); // Réduit à 3 secondes maintenant que le backend a un rate limiting plus permissif pour upload progress
        
      } else {
        throw new Error(uploadResponse.message || 'Upload failed');
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setUploadError(error.message);
      setUploadStatus(`❌ ${error.message}`);
      
      // Clear upload ID on error
      setCurrentUploadId(null);
      
      // Auto-hide error after some time
      setTimeout(() => {
        setUploadError(null);
        setUploadStatus('');
        setUploadProgress(0);
      }, 5000);
    }
  }, [validateFile, onVideoUploadSuccess]);

  const handleAIGenerate = useCallback(async (promptText, options = {}) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatus('🤖 AI generation in progress...');

      // Ensure authentication
      const token = localStorage.getItem('authToken');
      if (token && token !== apiService.token) {
        apiService.setToken(token);
      }

      if (!apiService.token) {
        throw new Error('You must be logged in to generate a video');
      }

      setUploadProgress(20);

      // Start AI generation with provided options
      const response = await apiService.generateVideoWithAI(promptText, {
        duration: options.duration || 5,
        ratio: options.ratio || '1280:720',
        model: options.model || 'gen4_turbo'
      });

      if (response.status === 'success') {
        const taskId = response.data.taskId;
        setUploadStatus(`⏳ Generation in progress... (${options.duration || 5}s)`);
        setUploadProgress(40);

        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await apiService.checkAITaskStatus(taskId);
            
            if (statusResponse.status === 'success') {
              const task = statusResponse.data.task;
              
              if (task.status === 'SUCCEEDED') {
                clearInterval(pollInterval);
                setUploadProgress(100);
                setUploadStatus('✅ Video generated! Preview...');
                
                // Show preview modal instead of auto-publishing
                setPreviewData({
                  taskId: taskId,
                  videoUrl: task.videoUrl,
                  promptText: promptText,
                  duration: options.duration || 5,
                  cost: options.duration === 10 ? '0.50' : '0.25'
                });
                setShowPreviewModal(true);
                
                // Clear upload states
                setTimeout(() => {
                  setUploadStatus('');
                  setUploadProgress(0);
                }, 1000);
                
              } else if (task.status === 'FAILED') {
                clearInterval(pollInterval);
                throw new Error('AI generation failed');
              } else {
                // Still processing
                setUploadProgress(Math.min(80, 40 + (Date.now() % 40)));
              }
            }
          } catch (pollError) {
            clearInterval(pollInterval);
            throw pollError;
          }
        }, 3000); // Poll every 3 seconds

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (isUploading) {
            throw new Error('Timeout: Generation is taking too long');
          }
        }, 300000);

      } else {
        throw new Error(response.message || 'AI generation failed');
      }
    } catch (error) {
      console.error('AI Generation error:', error);
      setUploadStatus(`❌ ${error.message}`);
      setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
      }, 4000);
    } finally {
      setIsUploading(false);
    }
  }, [onVideoUploadSuccess, onPageChange, isUploading]);

  const handlePublishVideo = useCallback(async (video) => {
    try {
      setIsPublishing(true);
      
      // La fonction de publication est maintenant gérée dans le modal
      // On reçoit directement la vidéo publiée
      setShowPreviewModal(false);
      setPreviewData(null);
      
      // Call callback to refresh user videos
      if (onVideoUploadSuccess && video) {
        onVideoUploadSuccess(video);
      }
      
      // Navigate to profile
      onPageChange('profile');
      
      // Show success message
      showToast('✅ Video published successfully!');
    } catch (error) {
      console.error('Publish error:', error);
      showToast(`❌ ${error.message}`);
    } finally {
      setIsPublishing(false);
    }
  }, [onVideoUploadSuccess, onPageChange, showToast]);

  const handleRejectVideo = useCallback(async (taskId) => {
    try {
      setIsRejecting(true);
      
      // La fonction de rejet est maintenant gérée dans le modal
      setShowPreviewModal(false);
      setPreviewData(null);
      showToast('🗑️ Video deleted');
    } catch (error) {
      console.error('Reject error:', error);
      showToast(`❌ ${error.message}`);
    } finally {
      setIsRejecting(false);
    }
  }, [showToast]);

  const handleNavClick = useCallback((item) => {
    if (item.id === 'create') {
      handleCreateClick();
    } else {
      onPageChange(item.id);
    }
  }, [handleCreateClick, onPageChange]);

  // Upload tracker handlers
  const handleCloseUploadTracker = useCallback(() => {
    // Only close if upload is complete or failed
    if (!isUploading) {
      setCurrentUploadId(null);
      setUploadedVideo(null);
      setUploadError(null);
      setUploadStatus('');
      setUploadProgress(0);
    }
  }, [isUploading]);

  const handlePreviewUploaded = useCallback((videoData) => {
    // For now, just show a success toast
    console.log('Preview uploaded video:', videoData);
    showToast('✅ Video uploaded successfully!');
  }, [showToast]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (uploadPollIntervalRef.current) {
        clearInterval(uploadPollIntervalRef.current);
      }
    };
  }, []);

  return (
    <>
      <motion.nav 
        className="bottom-navigation"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30,
          mass: 0.8
        }}
      >
        <div className="bottom-navigation-content">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <motion.button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''} ${item.isSpecial ? 'special' : ''} ${item.id === 'create' && isUploading ? 'uploading' : ''}`}
                onClick={() => handleNavClick(item)}
                whileTap={{ scale: 0.95 }}
                disabled={item.id === 'create' && isUploading}
                style={{
                  '--item-color': item.color
                }}
                layout
              >
                <motion.div 
                  className="nav-icon"
                  animate={isActive ? { 
                    scale: [1, 1.1, 1],
                    rotate: isActive && item.isSpecial ? [0, 90, 0] : 0
                  } : {}}
                  transition={{ 
                    duration: 0.4,
                    ease: "backOut"
                  }}
                >
                  {item.id === 'create' && isUploading ? (
                    <motion.div 
                      className="upload-spinner"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    >
                      <Upload size={item.isSpecial ? 24 : 20} strokeWidth={2.5} />
                    </motion.div>
                  ) : (
                    <Icon size={item.isSpecial ? 24 : 20} strokeWidth={2.5} />
                  )}
                  
                  {/* Glow effect pour le bouton special */}
                  {item.isSpecial && <div className="nav-glow" />}
                </motion.div>
                
                <motion.span 
                  className="nav-label"
                  animate={isActive ? { 
                    y: [-2, 0],
                    scale: [0.9, 1]
                  } : {}}
                  transition={{ 
                    duration: 0.3,
                    ease: "easeOut"
                  }}
                >
                  {item.id === 'create' && isUploading ? 'Upload...' : item.label}
                </motion.span>

                {/* Progress indicator pour upload */}
                {item.id === 'create' && isUploading && uploadProgress > 0 && (
                  <motion.div
                    className="upload-progress"
                    style={{
                      '--progress': `${uploadProgress}%`
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.nav>

      {/* Upload Status Toast avec animations premium */}
      <AnimatePresence>
        {uploadStatus && (
          <motion.div 
            className="upload-status-toast"
            initial={{ 
              opacity: 0, 
              y: 100, 
              scale: 0.8,
              filter: "blur(10px)"
            }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              filter: "blur(0px)"
            }}
            exit={{ 
              opacity: 0, 
              y: 100, 
              scale: 0.8,
              filter: "blur(10px)"
            }}
            transition={{ 
              type: "spring", 
              stiffness: 500, 
              damping: 30,
              mass: 0.8
            }}
          >
            <motion.div
              animate={uploadStatus.includes('in progress') ? { 
                scale: [1, 1.02, 1],
                rotate: [0, 1, -1, 0]
              } : {}}
              transition={{ 
                duration: 2, 
                repeat: uploadStatus.includes('in progress') ? Infinity : 0,
                ease: "easeInOut"
              }}
            >
              {uploadStatus}
            </motion.div>
            
            {/* Progress bar premium dans le toast */}
            {isUploading && uploadProgress > 0 && (
              <div className="progress-container">
                <motion.div
                  className="progress-bar"
                  style={{ width: `${uploadProgress}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ 
                    duration: 0.5, 
                    ease: "easeOut" 
                  }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onFileUpload={handleFileUpload}
        onAIGenerate={handleAIGenerate}
        isUploading={isUploading}
        uploadStatus={uploadStatus}
        uploadProgress={uploadProgress}
      />

      {/* Preview Modal */}
      <VideoPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        video={{
          url: previewData?.videoUrl,
          taskId: previewData?.taskId,
          promptText: previewData?.promptText,
          duration: previewData?.duration,
          resolution: 'HD',
          cost: previewData?.cost
        }}
        onPublish={handlePublishVideo}
        onReject={handleRejectVideo}
      />

      {/* Upload Tracker */}
      <UploadTracker
        isUploading={isUploading}
        progress={uploadProgress}
        status={uploadStatus}
        uploadId={currentUploadId}
        onClose={handleCloseUploadTracker}
        onPreview={handlePreviewUploaded}
        uploadedVideo={uploadedVideo}
        error={uploadError}
      />
    </>
  );
};

export default BottomNavigation;