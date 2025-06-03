import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, Download, Trash2, Volume2, VolumeX } from 'lucide-react';
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
  const videoRef = useRef(null);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [isOpen]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

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
          onClick={onClose}
        >
          <motion.div 
            className="video-preview-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="preview-header">
              <div className="preview-title">
                <h2>Preview of your video</h2>
                <p>Generated with AI • {videoData.duration}s</p>
              </div>
              <button className="preview-close" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            {/* Video Container */}
            <div className="preview-video-container">
              <div className="video-wrapper">
                <video
                  ref={videoRef}
                  src={videoData.videoUrl}
                  className="preview-video"
                  loop
                  muted={isMuted}
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                />
                
                {/* Video Controls Overlay */}
                <div className="video-controls-overlay" onClick={togglePlay}>
                  <motion.div 
                    className="play-button"
                    whileTap={{ scale: 0.9 }}
                    animate={{ opacity: isPlaying ? 0 : 1 }}
                  >
                    <Play size={48} fill="white" />
                  </motion.div>
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

            {/* Video Info */}
            <div className="preview-info">
              <div className="info-item">
                <span className="info-label">Prompt:</span>
                <span className="info-value">{videoData.promptText}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Duration:</span>
                <span className="info-value">{videoData.duration} seconds</span>
              </div>
              <div className="info-item">
                <span className="info-label">Cost:</span>
                <span className="info-value">{videoData.cost} credits</span>
              </div>
            </div>

            {/* Actions */}
            <div className="preview-actions">
              <motion.button 
                className="action-button reject-button"
                onClick={() => onReject(videoData.taskId)}
                disabled={isRejecting || isPublishing}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Trash2 size={18} />
                {isRejecting ? 'Deleting...' : 'Delete'}
              </motion.button>
              
              <motion.button 
                className="action-button publish-button"
                onClick={() => onPublish(videoData.taskId)}
                disabled={isPublishing || isRejecting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Download size={18} />
                {isPublishing ? 'Publishing...' : 'Publish'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoPreview; 