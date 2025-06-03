import React, { useState, useRef } from 'react';
import { Wand2, Upload, X, Eye, EyeOff, Settings, Sparkles, Image as ImageIcon, Video } from 'lucide-react';
import apiService from '../services/api';
import './VeoGenerator.css';

const VeoGenerator = ({ isOpen, onClose, onVideoGenerated }) => {
  const [activeTab, setActiveTab] = useState('text-to-video'); // 'text-to-video' or 'image-to-video'
  const [formData, setFormData] = useState({
    promptText: '',
    negativePrompt: '',
    model: 'veo-3.0-generate-preview',
    aspectRatio: '16:9',
    enhancePrompt: true,
    generateAudio: true,
    seed: '',
    // For image-to-video
    sourceImage: null,
    sourceImagePreview: null
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  
  const fileInputRef = useRef(null);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle image upload for image-to-video
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image cannot exceed 10MB');
      return;
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setFormData(prev => ({
      ...prev,
      sourceImage: file,
      sourceImagePreview: previewUrl
    }));
  };

  // Remove uploaded image
  const removeImage = () => {
    if (formData.sourceImagePreview) {
      URL.revokeObjectURL(formData.sourceImagePreview);
    }
    setFormData(prev => ({
      ...prev,
      sourceImage: null,
      sourceImagePreview: null
    }));
  };

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Start video generation
  const handleGenerate = async () => {
    if (!formData.promptText.trim()) {
      alert('Please enter a description for your video');
      return;
    }

    if (activeTab === 'image-to-video' && !formData.sourceImage) {
      alert('Please select an image for image-to-video generation');
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationStatus('Starting generation...');
      
      let response;
      
      if (activeTab === 'text-to-video') {
        // Text-to-video generation
        response = await apiService.generateVeoVideo({
          promptText: formData.promptText,
          model: formData.model,
          aspectRatio: formData.aspectRatio,
          negativePrompt: formData.negativePrompt || undefined,
          enhancePrompt: formData.enhancePrompt,
          generateAudio: formData.generateAudio,
          seed: formData.seed ? parseInt(formData.seed) : undefined
        });
      } else {
        // Image-to-video generation
        const imageBase64 = await fileToBase64(formData.sourceImage);
        response = await apiService.generateVeoVideoFromImage({
          promptText: formData.promptText,
          imageBase64: imageBase64,
          mimeType: formData.sourceImage.type,
          model: formData.model,
          aspectRatio: formData.aspectRatio,
          negativePrompt: formData.negativePrompt || undefined,
          enhancePrompt: formData.enhancePrompt,
          generateAudio: formData.generateAudio,
          seed: formData.seed ? parseInt(formData.seed) : undefined
        });
      }

      if (response.status === 'success') {
        const taskId = response.data.taskId;
        setCurrentTask(taskId);
        setGenerationStatus('Generation in progress... This may take 1-3 minutes.');
        
        // Start polling for status
        const interval = setInterval(() => pollTaskStatus(taskId), 5000);
        setPollingInterval(interval);
      } else {
        throw new Error(response.message || 'Error starting generation');
      }
      
    } catch (error) {
      console.error('❌ Error starting generation:', error);
      setGenerationStatus(`Error: ${error.message}`);
      setIsGenerating(false);
    }
  };

  // Poll task status
  const pollTaskStatus = async (taskId) => {
    try {
      const response = await apiService.checkVeoTaskStatus(taskId);
      
      if (response.status === 'success') {
        const task = response.data.task;
        
        switch (task.status) {
          case 'PENDING':
            setGenerationStatus('Generation in progress... Please wait.');
            break;
          case 'SUCCEEDED':
            setGenerationStatus('✅ Video generated successfully!');
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            setIsGenerating(false);
            
            // Notify parent component
            if (onVideoGenerated && task.video) {
              onVideoGenerated(task.video);
            }
            
            // Close modal after a short delay
            setTimeout(() => {
              handleClose();
            }, 2000);
            break;
          case 'FAILED':
            setGenerationStatus(`❌ Generation error: ${task.error || 'Unknown error'}`);
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            setIsGenerating(false);
            break;
          default:
            setGenerationStatus('Unknown status...');
        }
      }
    } catch (error) {
      console.error('❌ Error polling task status:', error);
      setGenerationStatus('Error checking status');
    }
  };

  // Close modal and cleanup
  const handleClose = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    if (formData.sourceImagePreview) {
      URL.revokeObjectURL(formData.sourceImagePreview);
    }
    
    // Reset form
    setFormData({
      promptText: '',
      negativePrompt: '',
      model: 'veo-3.0-generate-preview',
      aspectRatio: '16:9',
      enhancePrompt: true,
      generateAudio: true,
      seed: '',
      sourceImage: null,
      sourceImagePreview: null
    });
    
    setActiveTab('text-to-video');
    setIsGenerating(false);
    setGenerationStatus('');
    setShowAdvanced(false);
    setCurrentTask(null);
    
    onClose();
  };

  // Predefined prompts for inspiration
  const examplePrompts = [
    "A futuristic car driving through a neon-lit cyberpunk city at night",
    "A majestic eagle soaring over snow-capped mountains at sunrise",
    "Ocean waves crashing against rocky cliffs during a storm",
    "A time-lapse of a flower blooming in a magical garden",
    "A spaceship landing on an alien planet with purple skies",
    "A bustling medieval marketplace with merchants and knights"
  ];

  if (!isOpen) return null;

  return (
    <div className="veo-modal" onClick={handleClose}>
      <div className="veo-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="veo-modal-header">
          <div className="veo-title">
            <Sparkles className="veo-icon" size={24} />
            <h2>Generate a video with Veo AI</h2>
          </div>
          <button className="veo-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="veo-modal-body">
          {/* Tab selector */}
          <div className="veo-tabs">
            <button
              className={`veo-tab ${activeTab === 'text-to-video' ? 'active' : ''}`}
              onClick={() => setActiveTab('text-to-video')}
            >
              <Wand2 size={16} />
              Text to Video
            </button>
            <button
              className={`veo-tab ${activeTab === 'image-to-video' ? 'active' : ''}`}
              onClick={() => setActiveTab('image-to-video')}
            >
              <ImageIcon size={16} />
              Image to Video
            </button>
          </div>

          {/* Image upload for image-to-video */}
          {activeTab === 'image-to-video' && (
            <div className="veo-form-section">
              <label className="veo-form-label">
                <strong>Source image *</strong>
              </label>
              <div className="veo-image-upload">
                {!formData.sourceImage ? (
                  <div className="veo-image-drop-zone" onClick={() => fileInputRef.current?.click()}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <ImageIcon size={48} />
                    <p>Click to select an image</p>
                    <small>JPG, PNG - Max 10MB - Recommended: 1280x720 or 720x1280</small>
                  </div>
                ) : (
                  <div className="veo-image-preview">
                    <img src={formData.sourceImagePreview} alt="Source image" />
                    <button className="veo-remove-image" onClick={removeImage}>
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt input */}
          <div className="veo-form-section">
            <label className="veo-form-label">
              <strong>Video description *</strong>
            </label>
            <textarea
              value={formData.promptText}
              onChange={(e) => handleInputChange('promptText', e.target.value)}
              placeholder={activeTab === 'text-to-video' 
                ? "Describe the video you want to create... Ex: A black cat walking in a blooming garden in the rain"
                : "Describe how this image should animate... Ex: Water flowing gently, leaves moving in the wind"
              }
              className="veo-textarea"
              rows="4"
              maxLength="1000"
            />
            <div className="veo-char-count">{formData.promptText.length}/1000</div>
          </div>

          {/* Example prompts */}
          {activeTab === 'text-to-video' && !formData.promptText && (
            <div className="veo-examples">
              <p className="veo-examples-title">💡 Inspiration ideas:</p>
              <div className="veo-example-prompts">
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    className="veo-example-prompt"
                    onClick={() => handleInputChange('promptText', prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced options */}
          <div className="veo-advanced-section">
            <button
              className="veo-advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings size={16} />
              Advanced options
              {showAdvanced ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

            {showAdvanced && (
              <div className="veo-advanced-options">
                <div className="veo-form-row">
                  <div className="veo-form-col">
                    <label className="veo-form-label">Model</label>
                    <select
                      value={formData.model}
                      onChange={(e) => handleInputChange('model', e.target.value)}
                      className="veo-select"
                    >
                      <option value="veo-3.0-generate-preview">Veo 3.0 (Recommended)</option>
                      <option value="veo-2.0-generate-001">Veo 2.0</option>
                    </select>
                  </div>
                  
                  <div className="veo-form-col">
                    <label className="veo-form-label">Format</label>
                    <select
                      value={formData.aspectRatio}
                      onChange={(e) => handleInputChange('aspectRatio', e.target.value)}
                      className="veo-select"
                    >
                      <option value="16:9">16:9 (Landscape)</option>
                      {formData.model === 'veo-2.0-generate-001' && (
                        <option value="9:16">9:16 (Portrait)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="veo-form-section">
                  <label className="veo-form-label">Negative prompt (optional)</label>
                  <input
                    type="text"
                    value={formData.negativePrompt}
                    onChange={(e) => handleInputChange('negativePrompt', e.target.value)}
                    placeholder="What you DON'T want to see in the video... Ex: blurry, low quality"
                    className="veo-input"
                  />
                </div>

                <div className="veo-form-row">
                  <div className="veo-form-col">
                    <label className="veo-form-label">Seed (optional)</label>
                    <input
                      type="number"
                      value={formData.seed}
                      onChange={(e) => handleInputChange('seed', e.target.value)}
                      placeholder="Number for reproducibility"
                      className="veo-input"
                      min="0"
                      max="4294967295"
                    />
                  </div>
                </div>

                <div className="veo-checkboxes">
                  <label className="veo-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.enhancePrompt}
                      onChange={(e) => handleInputChange('enhancePrompt', e.target.checked)}
                    />
                    Automatically enhance description with Gemini
                  </label>
                  
                  {formData.model === 'veo-3.0-generate-preview' && (
                    <label className="veo-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.generateAudio}
                        onChange={(e) => handleInputChange('generateAudio', e.target.checked)}
                      />
                      Generate audio with video
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Generation status */}
          {generationStatus && (
            <div className={`veo-status ${isGenerating ? 'generating' : 'complete'}`}>
              {isGenerating && <div className="veo-spinner"></div>}
              <p>{generationStatus}</p>
            </div>
          )}
        </div>

        <div className="veo-modal-footer">
          <button
            className="veo-btn-secondary"
            onClick={handleClose}
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            className="veo-btn-primary"
            onClick={handleGenerate}
            disabled={!formData.promptText.trim() || isGenerating || (activeTab === 'image-to-video' && !formData.sourceImage)}
          >
            {isGenerating ? (
              <>
                <div className="veo-btn-spinner"></div>
                Generating...
              </>
            ) : (
              <>
                <Video size={16} />
                Generate video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VeoGenerator; 