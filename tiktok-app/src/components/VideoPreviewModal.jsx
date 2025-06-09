import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Pause, Volume2, VolumeX, 
  Trash2, Share, Download
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
  
  const videoRef = useRef(null);

  // Playback management
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
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

  // Video download
  const handleDownload = () => {
    if (video.url) {
      const link = document.createElement('a');
      link.href = video.url;
      link.download = `ai-video-${video.taskId || 'generated'}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
      const confirmed = window.confirm('Are you sure you want to delete this video?');
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
              <h3>Generated video preview</h3>
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
                <div 
                  className={`video-controls-overlay ${isPlaying ? 'playing' : ''}`} 
                  onClick={handlePlayPause}
                >
                  <div className="play-pause-btn">
                    {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                  </div>
                  {!isPlaying && (
                    <div className="play-instruction">
                      Cliquez pour lire la vidéo
                    </div>
                  )}
                </div>
              </div>

              {/* Volume Controls */}
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
                  <label htmlFor="description">Description (optional)</label>
                  <textarea
                    id="description"
                    value={publishDescription}
                    onChange={(e) => setPublishDescription(e.target.value)}
                    placeholder="Add a description for your video..."
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
                {isRejecting ? 'Deleting...' : 'Delete'}
              </motion.button>
              
              <motion.button
                onClick={handleDownload}
                className="action-button download-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Download video"
              >
                <Download size={16} />
                Download
              </motion.button>
              
              <motion.button
                onClick={handlePublish}
                className="action-button publish-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Share size={16} />
                    </motion.div>
                    Publishing...
                  </>
                ) : (
                  <>
                    <Share size={16} />
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

export default VideoPreviewModal; 
 