import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Eye, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import './UploadTracker.css';

const UploadTracker = ({ 
  isUploading, 
  progress, 
  status, 
  uploadId, 
  onClose, 
  onPreview, 
  uploadedVideo,
  error 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isUploading) {
      setIsExpanded(true);
    }
  }, [isUploading]);

  const getProgressColor = () => {
    if (error) return '#FF453A'; // Red for errors
    if (progress < 30) return '#007AFF'; // Blue
    if (progress < 70) return '#FF9500'; // Orange
    return '#34C759'; // Green
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle size={16} className="error-icon" />;
    if (uploadedVideo) return <CheckCircle size={16} className="success-icon" />;
    if (isUploading) return <RefreshCw size={16} className="spinning" />;
    return <Upload size={16} />;
  };

  const trackerVariants = {
    hidden: { 
      opacity: 0, 
      y: 100,
      scale: 0.8
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25
      }
    },
    exit: { 
      opacity: 0, 
      y: 100,
      scale: 0.8,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  // Don't display if nothing is in progress
  if (!isUploading && !uploadedVideo && !error) return null;

  const getTrackerTitle = () => {
    if (error) return 'Upload failed';
    if (uploadedVideo) return 'Video uploaded!';
    return 'Uploading...';
  };

  const getTrackerClass = () => {
    let baseClass = 'upload-tracker';
    if (error) baseClass += ' error';
    else if (uploadedVideo) baseClass += ' success';
    else if (isUploading) baseClass += ' uploading';
    return baseClass;
  };

  return (
    <AnimatePresence>
      <motion.div 
        className={getTrackerClass()}
        variants={trackerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <div className="tracker-content">
          {/* Header */}
          <div className="tracker-header" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="tracker-icon">
              {getStatusIcon()}
            </div>
            <div className="tracker-info">
              <div className="tracker-title">
                {getTrackerTitle()}
              </div>
              <div className="tracker-status">{status}</div>
            </div>
            <button 
              className="tracker-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Progress Bar */}
          {isUploading && !error && (
            <div className="tracker-progress">
              <div className="progress-bar">
                <motion.div 
                  className="progress-fill"
                  style={{ backgroundColor: getProgressColor() }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="progress-text">{progress}%</div>
            </div>
          )}

          {/* Actions for uploaded video */}
          {uploadedVideo && !error && (
            <div className="tracker-actions">
              <button 
                className="tracker-preview-btn"
                onClick={() => onPreview(uploadedVideo)}
              >
                <Eye size={14} />
                <span>View video</span>
              </button>
            </div>
          )}

          {/* Actions for error */}
          {error && isExpanded && (
            <motion.div 
              className="tracker-actions error-actions"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="error-message">
                {error}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UploadTracker; 