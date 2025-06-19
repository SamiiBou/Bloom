import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Camera, 
  Sparkles, 
  Check, 
  AlertCircle, 
  RefreshCw,
  Crop,
  Edit3,
  Download,
  Trash2,
  Eye,
  Plus,
  CloudUpload
} from 'lucide-react';
import './ImageUploadModal.css';

const ImageUploadModal = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  onImageSelect,
  allowMultiple = false,
  maxFiles = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  title = "Upload Images"
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  // Animation variants
  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9,
      y: 50
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.8
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9,
      y: 50,
      transition: {
        duration: 0.2,
        ease: "easeInOut"
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

  const dropZoneVariants = {
    inactive: { 
      borderColor: "rgba(255, 255, 255, 0.1)",
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      scale: 1
    },
    active: { 
      borderColor: "#6366f1",
      backgroundColor: "rgba(99, 102, 241, 0.05)",
      scale: 1.02,
      boxShadow: "0 0 20px rgba(99, 102, 241, 0.3)"
    }
  };

  const fileItemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
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
      scale: 0.8, 
      y: -20,
      transition: { duration: 0.2 }
    }
  };

  // File validation
  const validateFile = (file) => {
    const errors = [];
    
    if (!acceptedFormats.includes(file.type)) {
      errors.push(`Format ${file.type} non supporté`);
    }
    
    if (file.size > maxFileSize) {
      errors.push(`Fichier trop volumineux (max ${Math.round(maxFileSize / 1024 / 1024)}MB)`);
    }
    
    return errors;
  };

  // Handle file selection
  const handleFiles = useCallback((files) => {
    const fileArray = Array.from(files);
    const newErrors = [];
    const validFiles = [];
    const newPreviews = [];

    // Check total files limit
    if (!allowMultiple && fileArray.length > 1) {
      newErrors.push("Sélectionnez un seul fichier");
      setErrors(newErrors);
      return;
    }

    if (selectedFiles.length + fileArray.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} fichiers autorisés`);
      setErrors(newErrors);
      return;
    }

    fileArray.forEach((file, index) => {
      const fileErrors = validateFile(file);
      
      if (fileErrors.length === 0) {
        validFiles.push(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push({
            id: Date.now() + index,
            file: file,
            preview: e.target.result,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'ready'
          });
          
          // Update previews when all files are processed
          if (newPreviews.length === validFiles.length) {
            if (allowMultiple) {
              setSelectedFiles(prev => [...prev, ...validFiles]);
              setPreviews(prev => [...prev, ...newPreviews]);
            } else {
              setSelectedFiles(validFiles);
              setPreviews(newPreviews);
            }
          }
        };
        reader.readAsDataURL(file);
      } else {
        newErrors.push(`${file.name}: ${fileErrors.join(', ')}`);
      }
    });

    setErrors(newErrors);
  }, [selectedFiles, allowMultiple, maxFiles, maxFileSize, acceptedFormats]);

  // Drag and drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // File input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  // Remove file
  const removeFile = (fileId) => {
    setPreviews(prev => prev.filter(p => p.id !== fileId));
    setSelectedFiles(prev => prev.filter((_, index) => 
      previews.find(p => p.id === fileId)?.file !== prev[index]
    ));
  };

  // Upload files
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadStatus('Préparation de l\'upload...');

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const preview = previews[i];
        
        setUploadStatus(`Upload ${i + 1}/${selectedFiles.length}...`);
        
        // Update progress
        setUploadProgress(prev => ({
          ...prev,
          [preview.id]: 0
        }));

        // Simulate upload progress
        const uploadPromise = new Promise((resolve) => {
          let progress = 0;
          const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress >= 100) {
              progress = 100;
              clearInterval(interval);
              resolve();
            }
            setUploadProgress(prev => ({
              ...prev,
              [preview.id]: Math.round(progress)
            }));
          }, 100);
        });

        await uploadPromise;
        
        // Update preview status
        setPreviews(prev => prev.map(p => 
          p.id === preview.id ? { ...p, status: 'uploaded' } : p
        ));
      }

      setUploadStatus('Upload terminé avec succès !');
      
      // Call parent callback
      if (onUpload) {
        onUpload(selectedFiles);
      }
      
      // Close modal after success
      setTimeout(() => {
        onClose();
        resetModal();
      }, 1500);

    } catch (error) {
      setUploadStatus('Erreur lors de l\'upload');
      setErrors([error.message || 'Erreur inconnue']);
    } finally {
      setIsUploading(false);
    }
  };

  // Reset modal state
  const resetModal = () => {
    setSelectedFiles([]);
    setPreviews([]);
    setUploadProgress({});
    setUploadStatus('');
    setErrors([]);
    setDragActive(false);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      previews.forEach(preview => {
        if (preview.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(preview.preview);
        }
      });
    };
  }, [previews]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="image-upload-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div 
            className="image-upload-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="image-upload-header">
              <div className="header-content">
                <h2 className="modal-title">{title}</h2>
                <p className="modal-subtitle">
                  {allowMultiple 
                    ? `Sélectionnez jusqu'à ${maxFiles} images` 
                    : 'Sélectionnez une image'
                  }
                </p>
              </div>
              <button 
                className="close-button"
                onClick={onClose}
                disabled={isUploading}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="image-upload-content">
              {/* Drop Zone */}
              {previews.length === 0 && (
                <motion.div
                  className="drop-zone"
                  variants={dropZoneVariants}
                  animate={dragActive ? "active" : "inactive"}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="drop-zone-content">
                    <motion.div 
                      className="upload-icon"
                      animate={dragActive ? { scale: 1.1 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                      <CloudUpload size={48} />
                    </motion.div>
                    
                    <div className="drop-zone-text">
                      <h3>
                        {dragActive 
                          ? "Déposez vos images ici" 
                          : "Glissez vos images ici"
                        }
                      </h3>
                      <p>ou cliquez pour parcourir</p>
                    </div>
                    
                    <div className="format-info">
                      <span>JPG, PNG, GIF, WebP</span>
                      <span>•</span>
                      <span>Max {Math.round(maxFileSize / 1024 / 1024)}MB</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* File Previews */}
              {previews.length > 0 && (
                <div className="preview-section">
                  <div className="preview-header">
                    <h3>Images sélectionnées</h3>
                    {allowMultiple && previews.length < maxFiles && (
                      <button 
                        className="add-more-button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Plus size={16} />
                        Ajouter plus
                      </button>
                    )}
                  </div>
                  
                  <div className="preview-grid">
                    <AnimatePresence>
                      {previews.map((preview) => (
                        <motion.div
                          key={preview.id}
                          className="preview-item"
                          variants={fileItemVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <div className="preview-image-container">
                            <img 
                              src={preview.preview} 
                              alt={preview.name}
                              className="preview-image"
                            />
                            
                            {/* Status Overlay */}
                            <div className="status-overlay">
                              {preview.status === 'uploading' && (
                                <div className="upload-progress">
                                  <RefreshCw size={16} className="spinning" />
                                  <span>{uploadProgress[preview.id] || 0}%</span>
                                </div>
                              )}
                              {preview.status === 'uploaded' && (
                                <div className="upload-success">
                                  <Check size={16} />
                                </div>
                              )}
                            </div>
                            
                            {/* Actions */}
                            {!isUploading && (
                              <div className="preview-actions">
                                <button 
                                  className="action-button remove"
                                  onClick={() => removeFile(preview.id)}
                                  title="Supprimer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className="preview-info">
                            <span className="file-name">{preview.name}</span>
                            <span className="file-size">{formatFileSize(preview.size)}</span>
                          </div>
                          
                          {/* Progress Bar */}
                          {isUploading && uploadProgress[preview.id] !== undefined && (
                            <div className="progress-bar">
                              <motion.div 
                                className="progress-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${uploadProgress[preview.id]}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Error Messages */}
              <AnimatePresence>
                {errors.length > 0 && (
                  <motion.div 
                    className="error-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {errors.map((error, index) => (
                      <div key={index} className="error-message">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Upload Status */}
              <AnimatePresence>
                {uploadStatus && (
                  <motion.div 
                    className="upload-status"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="status-content">
                      {isUploading && <RefreshCw size={16} className="spinning" />}
                      <span>{uploadStatus}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="image-upload-footer">
              <button 
                className="cancel-button"
                onClick={onClose}
                disabled={isUploading}
              >
                Annuler
              </button>
              
              <button 
                className="upload-button"
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isUploading}
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={16} className="spinning" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Uploader {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                  </>
                )}
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept={acceptedFormats.join(',')}
              multiple={allowMultiple}
              style={{ display: 'none' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageUploadModal;