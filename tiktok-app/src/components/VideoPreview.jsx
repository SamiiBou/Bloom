import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, Download, Trash2, Volume2, VolumeX, RefreshCw } from 'lucide-react';
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

  if (!videoData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="preview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div 
            className="preview-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-header">
              <h3>Generated video preview</h3>
              <button 
                className="close-button"
                onClick={onClose}
              >
                ×
              </button>
            </div>
            
            <div className="preview-content">
              <div className="video-container">
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

                {/* Video Controls */}
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
            
            <div className="preview-actions">
              <motion.button
                onClick={onReject}
                className="action-button reject-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isRejecting || isPublishing}
              >
                <Trash2 size={16} />
                {isRejecting ? 'Deleting...' : 'Delete'}
              </motion.button>
              
              <motion.a
                href={videoData.videoUrl}
                download={`ai-video-${videoData.taskId}.mp4`}
                className="action-button download-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Download video"
              >
                <Download size={16} />
                Download
              </motion.a>
              
              <motion.button
                onClick={onPublish}
                className="action-button publish-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isPublishing || isRejecting}
              >
                {isPublishing ? (
                  <>
                    <RefreshCw size={16} className="spinning" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Publish
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

export default VideoPreview; 