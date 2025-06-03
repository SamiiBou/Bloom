import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Pause, Volume2, VolumeX, 
  Trash2, CheckCircle 
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
  
  const videoRef = useRef(null);

  // Playback management
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.error);
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVideoVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  };

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
        `AI generated video`, // Default description
        ['ai', 'generated'] // Default hashtags
      );
      
      if (result.status === 'success') {
        console.log('✅ Video published successfully');
        alert('Video published successfully!');
        onPublish(result.data.video);
        onClose();
      } else {
        throw new Error(result.message || 'Error during publication');
      }
      
    } catch (error) {
      console.error('❌ Publication error:', error);
      alert(`Error during publication: ${error.message}`);
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
      const confirmed = window.confirm('Are you sure you want to reject this video?');
      if (!confirmed) {
        setIsRejecting(false);
        return;
      }
      
      // Reject via API
      const { default: apiService } = await import('../services/api.js');
      
      const result = await apiService.rejectAIVideo(video.taskId);
      
      if (result.status === 'success') {
        console.log('✅ Video rejected');
        alert('Video rejected');
        onReject(video.taskId);
        onClose();
      } else {
        throw new Error(result.message || 'Error during rejection');
      }
      
    } catch (error) {
      console.error('❌ Rejection error:', error);
      alert(`Error during rejection: ${error.message}`);
    } finally {
      setIsRejecting(false);
    }
  };

  // Modal closure
  const handleClose = () => {
    // Stop playback
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    onClose();
  };

  if (!video || !video.url) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="video-preview-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="video-preview-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Header */}
            <div className="preview-header">
              <h2>Video preview</h2>
              <button className="btn-close" onClick={handleClose}>
                <X size={20} />
              </button>
            </div>

            {/* Video Container */}
            <div className="preview-video-container">
              <video
                ref={videoRef}
                src={video.url}
                className="preview-video"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                muted={isMuted}
                volume={videoVolume}
                loop
                playsInline
              />
              
              {/* Video Controls Overlay */}
              <div className="video-controls-overlay">
                <button className="play-pause-btn" onClick={handlePlayPause}>
                  {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="preview-controls">
              <div className="volume-controls">
                <button className="mute-btn" onClick={handleMuteToggle}>
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
            </div>

            {/* Video Info - Removed to simplify interface */}
            {/* 
            <div className="video-info">
              <div className="info-item">
                <strong>Duration:</strong> {video.duration || 'N/A'}s
              </div>
              <div className="info-item">
                <strong>Resolution:</strong> {video.resolution || 'HD'}
              </div>
              <div className="info-item">
                <strong>Format:</strong> MP4
              </div>
              {video.promptText && (
                <div className="info-item">
                  <strong>Prompt:</strong> {video.promptText}
                </div>
              )}
            </div>
            */}

            {/* Action Buttons */}
            <div className="preview-actions">
              <button 
                className="btn-primary"
                onClick={handlePublish}
                disabled={isPublishing}
                title="Publish to feed"
              >
                <CheckCircle size={18} />
                {isPublishing ? 'Publishing...' : 'Publish'}
              </button>
              
              <button 
                className="btn-danger"
                onClick={handleReject}
                disabled={isRejecting}
                title="Reject this video"
              >
                <Trash2 size={18} />
                {isRejecting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoPreviewModal; 
 