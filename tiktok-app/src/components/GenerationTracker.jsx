import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Download, Trash2, RefreshCw } from 'lucide-react';
import './GenerationTracker.css';

const GenerationTracker = ({ 
  isGenerating, 
  progress, 
  status, 
  taskId, 
  onClose, 
  onPublish, 
  onReject,
  generatedVideo 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isGenerating) {
      setIsExpanded(true);
    }
  }, [isGenerating]);

  const getProgressColor = () => {
    if (progress < 30) return '#007AFF'; // Blue
    if (progress < 70) return '#FF9500'; // Orange
    return '#34C759'; // Green
  };

  const getStatusIcon = () => {
    if (generatedVideo) return <Sparkles size={16} />;
    if (isGenerating) return <RefreshCw size={16} className="spinning" />;
    return <Sparkles size={16} />;
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

  if (!isGenerating && !generatedVideo) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="generation-tracker"
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
                {generatedVideo ? 'Video generated!' : 'AI Generation'}
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
          {isGenerating && (
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

          {/* Actions for generated video */}
          {generatedVideo && isExpanded && (
            <motion.div 
              className="tracker-actions"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <button 
                className="action-btn publish-btn"
                onClick={() => onPublish(taskId)}
              >
                <Download size={16} />
                <span>Publish</span>
              </button>
              <button 
                className="action-btn reject-btn"
                onClick={() => onReject(taskId)}
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GenerationTracker; 