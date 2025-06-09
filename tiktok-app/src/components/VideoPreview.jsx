import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, Download, Trash2, Volume2, VolumeX, RefreshCw, AlertCircle } from 'lucide-react';
import './VideoPreview.css';

const VideoPreview = ({ 
  isOpen, 
  onClose, 
  videoData, 
  onPublish, 
  onReject, 
  isPublishing, 
  isRejecting 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [loadingAttempts, setLoadingAttempts] = useState(0);
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

  // Enhanced video loading
  const loadVideo = useCallback(async () => {
    if (!videoRef.current || !videoData?.videoUrl) return;

    console.log('🎬 VideoPreview: Starting enhanced video loading...', { 
      url: videoData.videoUrl, 
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
      videoElement.preload = 'auto';
      videoElement.muted = isMuted;
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
      }, 15000);
      
      // Force video source reload
      if (videoElement.src !== videoData.videoUrl) {
        videoElement.src = videoData.videoUrl;
      }
      
      // Try to load video data
      videoElement.load();
      
      setLoadingAttempts(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ Error during video loading setup:', error);
      setVideoError(`Loading setup error: ${error.message}`);
    }
  }, [videoData?.videoUrl, isMuted, loadingAttempts]);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      console.log('🎬 VideoPreview: Modal opened, resetting states...');
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      setVideoLoaded(false);
      setVideoError(null);
      setVideoReady(false);
      setUserInteracted(false);
      setLoadingAttempts(0);
      setRetryCount(0);
      
      // Start loading with a small delay
      setTimeout(() => {
        loadVideo();
      }, 100);
    }
  }, [isOpen, loadVideo]);

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
    }, 2000);
  }, [retryCount, loadVideo]);

  // Enhanced playback control
  const togglePlay = useCallback(async () => {
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
        
        try {
          const playPromise = videoElement.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            setIsPlaying(true);
            console.log('✅ Video playback started successfully');
          }
        } catch (playError) {
          console.error('❌ Play error:', playError);
          
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

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      console.log('📊 Video metadata loaded, duration:', videoRef.current.duration);
    }
  }, []);

  const handleVideoLoadedData = useCallback(() => {
    console.log('✅ Video loaded and ready to play');
    setVideoLoaded(true);
    setVideoError(null);
    
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

  const handleVideoCanPlay = useCallback(() => {
    console.log('✅ Video can start playing');
    setVideoReady(true);
    setVideoLoaded(true);
    
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  // Manual retry function
  const handleManualRetry = useCallback(() => {
    console.log('🔄 Manual retry initiated...');
    setRetryCount(0);
    setLoadingAttempts(0);
    loadVideo();
  }, [loadVideo]);

  // Enhanced close handler
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

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9,
      y: 20
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9,
      y: 20,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.3 }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  if (!videoData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="video-preview-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
        >
          <motion.div 
            className="video-preview-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video Container */}
            <div className="preview-video-container">
              <div className="video-wrapper">
                <video
                  key={`${videoData.videoUrl}-${loadingAttempts}`}
                  ref={videoRef}
                  src={videoData.videoUrl}
                  className="preview-video"
                  loop
                  muted={isMuted}
                  playsInline
                  crossOrigin="anonymous"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedData={handleVideoLoadedData}
                  onError={handleVideoError}
                  onCanPlay={handleVideoCanPlay}
                  onWaiting={() => {
                    console.log('⏳ Video waiting for data...');
                  }}
                  onSeeking={() => {
                    console.log('🔍 Video seeking...');
                  }}
                  preload="auto"
                />
                
                {/* Enhanced Video Controls Overlay */}
                <div className="video-controls-overlay" onClick={togglePlay} style={{ cursor: 'pointer' }}>
                  <motion.div 
                    className="play-button"
                    whileTap={{ scale: 0.9 }}
                    animate={{ opacity: isPlaying ? 0 : 1 }}
                  >
                    <Play size={48} fill="white" />
                  </motion.div>
                  
                  {!isPlaying && !videoError && (
                    <motion.div 
                      className="play-instruction"
                      animate={{ opacity: isPlaying ? 0 : 0.9 }}
                      transition={{ duration: 0.3 }}
                    >
                      {videoLoaded && videoReady ? 
                        'Cliquez pour lire la vidéo' : 
                        loadingAttempts > 0 ? 
                          `Chargement de la vidéo... (tentative ${loadingAttempts})` :
                          'Chargement de la vidéo...'
                      }
                    </motion.div>
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
                          background: 'rgba(255, 255, 255, 0.9)',
                          color: '#ff3b30',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600',
                          fontSize: '0.85rem'
                        }}
                      >
                        <RefreshCw size={16} />
                        Réessayer
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Controls */}
                <div className="video-controls">
                  <div className="controls-left">
                    <button className="control-btn" onClick={togglePlay}>
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <span className="time-display">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                  <div className="controls-right">
                    <button className="control-btn" onClick={toggleMute}>
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button className="control-btn preview-close-btn" onClick={handleClose}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="video-progress">
                  <div 
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="preview-actions">
              <motion.button 
                className="action-button reject-button compact"
                onClick={() => onReject(videoData.taskId)}
                disabled={isRejecting || isPublishing}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Trash2 size={14} />
                {isRejecting ? 'Suppression...' : 'Supprimer'}
              </motion.button>
              
              <motion.button 
                className="action-button publish-button compact"
                onClick={() => onPublish(videoData.taskId)}
                disabled={isPublishing || isRejecting || !videoLoaded}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Download size={14} />
                {isPublishing ? 'Publication...' : 'Publier'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoPreview; 