import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Hash, Sparkles } from 'lucide-react';
import './PublishModal.css';

const PublishModal = ({ 
  isOpen, 
  onClose, 
  onPublish, 
  imagePreview,
  isPublishing,
  initialText = '',
  error = ''
}) => {
  console.log('🎭 [PUBLISHMODAL] Component rendered with props:', {
    isOpen,
    hasOnClose: !!onClose,
    hasOnPublish: !!onPublish,
    hasImagePreview: !!imagePreview,
    isPublishing,
    initialText,
    error
  });

  const [caption, setCaption] = useState(initialText);
  const [hashtags, setHashtags] = useState('');

  const handlePublish = () => {
    console.log('🎭 [PUBLISHMODAL] handlePublish called');
    console.log('🎭 [PUBLISHMODAL] Caption:', caption);
    console.log('🎭 [PUBLISHMODAL] Hashtags:', hashtags);
    
    if (onPublish) {
      const publishData = {
        caption: caption.trim(),
        hashtags: hashtags.split('#').filter(tag => tag.trim()).map(tag => tag.trim())
      };
      console.log('🎭 [PUBLISHMODAL] Calling onPublish with data:', publishData);
      onPublish(publishData);
    } else {
      console.log('🎭 [PUBLISHMODAL] No onPublish function provided');
    }
  };

  const handleClose = () => {
    console.log('🎭 [PUBLISHMODAL] handleClose called');
    setCaption('');
    setHashtags('');
    if (onClose) {
      console.log('🎭 [PUBLISHMODAL] Calling onClose');
      onClose();
    } else {
      console.log('🎭 [PUBLISHMODAL] No onClose function provided');
    }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      y: 50
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      y: 50,
      transition: {
        duration: 0.2
      }
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="publish-modal-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
        >
          <motion.div 
            className="publish-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="publish-modal-header">
              <h3>Publish your image</h3>
              <button className="close-button" onClick={handleClose}>
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="publish-modal-content">
              {/* Error display */}
              {error && (
                <div className="error-message" style={{
                  background: 'rgba(255, 107, 107, 0.1)',
                  border: '1px solid rgba(255, 107, 107, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  color: '#ff6b6b',
                  fontSize: '0.9rem',
                  textAlign: 'center'
                }}>
                  {error}
                </div>
              )}

              {/* Image Preview */}
              {imagePreview && (
                <div className="image-preview-container">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="image-preview"
                  />
                </div>
              )}

              {/* Caption Input */}
              <div className="input-group">
                <label htmlFor="caption">
                  <Sparkles size={16} />
                  Caption
                </label>
                <textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption for your image..."
                  rows={4}
                  maxLength={2000}
                  className="caption-input"
                />
                <div className="character-count">
                  {caption.length}/2000
                </div>
              </div>

              {/* Hashtags Input */}
              <div className="input-group">
                <label htmlFor="hashtags">
                  <Hash size={16} />
                  Hashtags (optional)
                </label>
                <input
                  id="hashtags"
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#art #nature #photography"
                  className="hashtags-input"
                />
                <div className="hashtags-help">
                  Separate your hashtags with spaces
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="publish-modal-footer">
              <button 
                className="cancel-button" 
                onClick={handleClose}
                disabled={false}
              >
                {isPublishing ? 'Cancel Upload' : 'Cancel'}
              </button>
              <button 
                className="publish-button" 
                onClick={handlePublish}
                disabled={isPublishing || !caption.trim()}
              >
                {isPublishing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles size={16} />
                    </motion.div>
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Publish
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PublishModal; 