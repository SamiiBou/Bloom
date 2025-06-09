import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Pause, Volume2, VolumeX, 
  Trash2, Share, Download, RefreshCw, AlertCircle
} from 'lucide-react';
import './VideoPreviewModal.css';

const VideoPreviewModal = ({ 
  isOpen, 
  onClose, 
  video,
  onPublish,
  onReject 
}) => {
  // States for playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoVolume, setVideoVolume] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [publishDescription, setPublishDescription] = useState('');
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [loadingAttempts, setLoadingAttempts] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const videoRef = useRef(null);
  const loadingTimeoutRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced video loading with multiple attempts
  const loadVideo = useCallback(async () => {
    if (!videoRef.current || !video?.url) return;

    console.log('🎬 VideoPreviewModal: Starting enhanced video loading...', { 
      url: video.url, 
      attempt: loadingAttempts + 1 
    });

    try {
      const videoElement = videoRef.current;
      
      // Reset states
      setVideoError(null);
      setVideoLoaded(false);
      setVideoReady(false);
      
      // Enhanced video element configuration
      videoElement.crossOrigin = 'anonymous';
      videoElement.preload = 'auto'; // More aggressive preloading
      videoElement.muted = isMuted;
      videoElement.volume = videoVolume;
      videoElement.playsInline = true;
      videoElement.controls = false;
      videoElement.loop = true;
      
      // Set loading timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('⏰ Video loading timeout, attempting retry...');
        handleVideoRetry();
      }, 15000); // 15 second timeout
      
      // Force video source reload
      if (videoElement.src !== video.url) {
        videoElement.src = video.url;
      }
      
      // Try to load video data
      videoElement.load();
      
      setLoadingAttempts(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ Error during video loading setup:', error);
      setVideoError(`Loading setup error: ${error.message}`);
    }
  }, [video?.url, isMuted, videoVolume, loadingAttempts]);

  // Reset state when modal opens/closes or video changes
  useEffect(() => {
    if (isOpen && video?.url) {
      console.log('🎬 VideoPreviewModal: Modal opened with video URL:', video.url);
      setIsPlaying(false);
      setVideoLoaded(false);
      setVideoError(null);
      setVideoReady(false);
      setUserInteracted(false);
      setLoadingAttempts(0);
      setRetryCount(0);
      
      // Start loading with a small delay to ensure DOM is ready
      setTimeout(() => {
        loadVideo();
      }, 100);
    }
  }, [isOpen, video?.url, loadVideo]);

  // Enhanced retry mechanism
  const handleVideoRetry = useCallback(() => {
    if (retryCount >= 3) {
      console.error('❌ Max retry attempts reached');
      setVideoError('Impossible de charger la vidéo après plusieurs tentatives');
      return;
    }

    console.log(`🔄 Retrying video load (attempt ${retryCount + 1}/3)...`);
    setRetryCount(prev => prev + 1);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    retryTimeoutRef.current = setTimeout(() => {
      loadVideo();
    }, 2000); // 2 second delay between retries
  }, [retryCount, loadVideo]);

  // Enhanced playback management with user interaction handling
  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) {
      console.warn('❌ Video ref not available');
      return;
    }

    // Mark user interaction
    if (!userInteracted) {
      setUserInteracted(true);
      console.log('✅ User interaction detected');
    }

    try {
      const videoElement = videoRef.current;
      
      // Ensure video is ready
      if (!videoLoaded || !videoReady) {
        console.log('⏳ Video not ready yet, forcing load...');
        await loadVideo();
        return;
      }

      if (videoElement.paused) {
        console.log('▶️ Starting video playback...');
        setVideoError(null);
        
        // Additional checks before play
        if (videoElement.readyState < 2) {
          console.log('📊 Video not sufficiently loaded, waiting...');
          return;
        }
        
        // Enhanced play with better error handling
        try {
          const playPromise = videoElement.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            setIsPlaying(true);
            console.log('✅ Video playback started successfully');
          }
        } catch (playError) {
          console.error('❌ Play error:', playError);
          
          // Handle specific autoplay errors
          if (playError.name === 'NotAllowedError') {
            setVideoError('Cliquez sur le bouton play pour démarrer la vidéo');
          } else if (playError.name === 'NotSupportedError') {
            setVideoError('Format vidéo non supporté');
          } else {
            setVideoError(`Erreur de lecture: ${playError.message}`);
          }
          
          setIsPlaying(false);
        }
      } else {
        console.log('⏸️ Pausing video playback...');
        videoElement.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('❌ Error during playback handling:', error);
      setVideoError(`Erreur de lecture: ${error.message}`);
      setIsPlaying(false);
    }
  }, [videoLoaded, videoReady, userInteracted, loadVideo]);

  // Enhanced volume controls
  const handleVolumeChange = useCallback((newVolume) => {
    setVideoVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  }, []);

  const handleMuteToggle = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  }, [isMuted]);

  // Enhanced video event handlers
  const handleVideoLoadedData = useCallback(() => {
    console.log('✅ Video loaded and ready to play');
    setVideoLoaded(true);
    setVideoError(null);
    
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  const handleVideoCanPlay = useCallback(() => {
    console.log('✅ Video can start playing');
    setVideoReady(true);
    setVideoLoaded(true);
    
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  const handleVideoError = useCallback((event) => {
    console.error('❌ Video loading error:', event);
    const error = event.target.error;
    let errorMessage = 'Erreur de chargement vidéo';
    
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = 'Chargement vidéo interrompu';
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = 'Erreur réseau lors du chargement';
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = 'Erreur de décodage vidéo';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Format vidéo non supporté';
          break;
        default:
          errorMessage = 'Erreur vidéo inconnue';
      }
    }
    
    setVideoError(errorMessage);
    setVideoLoaded(false);
    setVideoReady(false);
    
    // Auto-retry on certain errors
    if (error && (error.code === error.MEDIA_ERR_NETWORK || error.code === error.MEDIA_ERR_ABORTED)) {
      console.log('🔄 Auto-retrying after network/abort error...');
      setTimeout(() => {
        handleVideoRetry();
      }, 3000);
    }
  }, [handleVideoRetry]);

  // Video download with enhanced error handling
  const handleDownload = useCallback(() => {
    if (!video?.url) {
      alert('URL de téléchargement non disponible');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = video.url;
      link.download = `ai-video-${video.taskId || Date.now()}.mp4`;
      link.crossOrigin = 'anonymous';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('❌ Download error:', error);
      alert('Erreur lors du téléchargement');
    }
  }, [video]);

  // Video publication
  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      console.log('📤 Publishing video...');
      
      // Stop playback
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      
      // Publish via API
      const { default: apiService } = await import('../services/api.js');
      
      const result = await apiService.publishAIVideo(
        video.taskId,
        publishDescription || `AI generated video`, 
        ['ai', 'generated'] 
      );
      
      if (result.status === 'success') {
        console.log('✅ Video published successfully');
        onPublish(result.data.video);
        onClose();
      } else {
        throw new Error(result.message || 'Error during publication');
      }
      
    } catch (error) {
      console.error('❌ Publication error:', error);
      alert(`Erreur lors de la publication: ${error.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Video rejection
  const handleReject = async () => {
    try {
      setIsRejecting(true);
      console.log('🗑️ Rejecting video...');
      
      // Stop playback
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      
      // Confirm rejection
      const confirmed = window.confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?');
      if (!confirmed) {
        setIsRejecting(false);
        return;
      }
      
      // Reject via API
      const { default: apiService } = await import('../services/api.js');
      
      const result = await apiService.rejectAIVideo(video.taskId);
      
      if (result.status === 'success') {
        console.log('✅ Video rejected');
        onReject(video.taskId);
        onClose();
      } else {
        throw new Error(result.message || 'Error during rejection');
      }
      
    } catch (error) {
      console.error('❌ Rejection error:', error);
      alert(`Erreur lors de la suppression: ${error.message}`);
    } finally {
      setIsRejecting(false);
    }
  };

  // Enhanced modal closure
  const handleClose = useCallback(() => {
    // Stop playback and cleanup
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      setIsPlaying(false);
    }
    
    // Clear timeouts
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    onClose();
  }, [onClose]);

  // Manual retry function
  const handleManualRetry = useCallback(() => {
    console.log('🔄 Manual retry initiated...');
    setRetryCount(0);
    setLoadingAttempts(0);
    loadVideo();
  }, [loadVideo]);

  if (!video || !video.url) {
    console.warn('❌ VideoPreviewModal: Missing video data or URL', { video });
    return null;
  }

  console.log('🎬 VideoPreviewModal: Rendering with video data:', { 
    url: video.url, 
    taskId: video.taskId, 
    isOpen,
    videoLoaded,
    videoReady,
    userInteracted
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="preview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div 
            className="preview-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-header">
              <h3>Prévisualisation vidéo générée</h3>
              <button 
                className="close-button"
                onClick={handleClose}
              >
                ×
              </button>
            </div>
            
            <div className="preview-content">
              <div className="preview-video-container">
                <video
                  key={`${video.url}-${loadingAttempts}`}
                  ref={videoRef}
                  src={video.url}
                  className="preview-video"
                  onPlay={() => {
                    console.log('🎬 Video onPlay event fired');
                    setIsPlaying(true);
                  }}
                  onPause={() => {
                    console.log('⏸️ Video onPause event fired');
                    setIsPlaying(false);
                  }}
                  muted={isMuted}
                  volume={videoVolume}
                  loop
                  playsInline
                  crossOrigin="anonymous"
                  onLoadedData={handleVideoLoadedData}
                  onError={handleVideoError}
                  onCanPlay={handleVideoCanPlay}
                  onLoadedMetadata={() => {
                    console.log('📊 Video metadata loaded');
                    setVideoLoaded(true);
                  }}
                  onWaiting={() => {
                    console.log('⏳ Video waiting for data...');
                  }}
                  onSeeking={() => {
                    console.log('🔍 Video seeking...');
                  }}
                  preload="auto"
                />
                
                {/* Enhanced Video Controls Overlay */}
                <div 
                  className={`video-controls-overlay ${isPlaying ? 'playing' : ''}`} 
                  onClick={handlePlayPause}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="play-pause-btn">
                    {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                  </div>
                  
                  {!isPlaying && !videoError && (
                    <div className="play-instruction">
                      {videoLoaded && videoReady ? 
                        'Cliquez pour lire la vidéo' : 
                        loadingAttempts > 0 ? 
                          `Chargement de la vidéo... (tentative ${loadingAttempts})` :
                          'Chargement de la vidéo...'
                      }
                    </div>
                  )}
                  
                  {videoError && (
                    <div className="video-error">
                      <AlertCircle size={24} style={{ marginBottom: '8px' }} />
                      <div>Erreur: {videoError}</div>
                      <button 
                        className="retry-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManualRetry();
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '8px 16px',
                          background: '#ff4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RefreshCw size={16} />
                        Réessayer
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Volume Controls */}
              <div className="volume-controls">
                <button className="volume-btn" onClick={handleMuteToggle}>
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={videoVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="volume-slider"
                />
                <span className="volume-label">{Math.round(videoVolume * 100)}%</span>
              </div>

              {/* Description Field */}
              <div className="publish-fields">
                <div className="field-group">
                  <label htmlFor="description">Description (optionnelle)</label>
                  <textarea
                    id="description"
                    value={publishDescription}
                    onChange={(e) => setPublishDescription(e.target.value)}
                    placeholder="Ajoutez une description à votre vidéo..."
                    rows={3}
                    className="publish-textarea"
                  />
                </div>
              </div>
            </div>
            
            <div className="preview-actions">
              <motion.button
                onClick={handleReject}
                className="action-button reject-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isRejecting}
              >
                <Trash2 size={16} />
                {isRejecting ? 'Suppression...' : 'Supprimer'}
              </motion.button>
              
              <motion.button
                onClick={handleDownload}
                className="action-button download-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Télécharger la vidéo"
              >
                <Download size={16} />
                Télécharger
              </motion.button>
              
              <motion.button
                onClick={handlePublish}
                className="action-button publish-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isPublishing || !videoLoaded}
              >
                {isPublishing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Share size={16} />
                    </motion.div>
                    Publication...
                  </>
                ) : (
                  <>
                    <Share size={16} />
                    Publier
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoPreviewModal; 
 