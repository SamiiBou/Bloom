const axios = require('axios');

class FluxService {
  constructor() {
    this.baseURL = 'https://api.bfl.ml/v1';
    this.apiKey = process.env.BFL_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️ BFL_API_KEY not found in environment variables');
    }
  }

  /**
   * Generate image from text using FLUX models
   * @param {string} prompt - Text prompt for image generation
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Task result with ID
   */
  async generateImageFromText(prompt, options = {}) {
    try {
      const {
        model = 'flux-pro-1.1',
        width = 1024,
        height = 1024,
        steps = 30,
        guidance = 3.5,
        safety_tolerance = 2,
        seed = null,
        prompt_upsampling = false
      } = options;

      console.log(`🎨 Starting FLUX image generation with model: ${model}`);
      console.log(`📝 Prompt: "${prompt}"`);

      const payload = {
        prompt: prompt.trim(),
        width,
        height,
        steps,
        guidance,
        safety_tolerance,
        prompt_upsampling
      };

      // Add seed if provided
      if (seed !== null && seed !== undefined) {
        payload.seed = seed;
      }

      const response = await axios.post(`${this.baseURL}/${model}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Key': this.apiKey,
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.id) {
        console.log(`✅ FLUX task created: ${response.data.id}`);
        return {
          taskId: response.data.id,
          status: 'pending',
          model: model
        };
      } else {
        throw new Error('Invalid response from FLUX API');
      }

    } catch (error) {
      console.error('❌ FLUX generation error:', error.response?.data || error.message);
      throw new Error(`FLUX generation failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Generate/edit image using FLUX Kontext (image-to-image)
   * @param {string} imageBase64 - Base64 encoded input image
   * @param {string} prompt - Text prompt for editing
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Task result with ID
   */
  async generateImageFromImage(imageBase64, prompt, options = {}) {
    try {
      const {
        model = 'flux-pro-1.1-kontext',
        aspect_ratio = '1:1',
        safety_tolerance = 2,
        seed = null,
        prompt_upsampling = false
      } = options;

      console.log(`🎨 Starting FLUX Kontext image editing with model: ${model}`);
      console.log(`📝 Prompt: "${prompt}"`);

      const payload = {
        prompt: prompt.trim(),
        image: imageBase64,
        aspect_ratio,
        safety_tolerance,
        prompt_upsampling
      };

      // Add seed if provided
      if (seed !== null && seed !== undefined) {
        payload.seed = seed;
      }

      const response = await axios.post(`${this.baseURL}/${model}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Key': this.apiKey,
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.id) {
        console.log(`✅ FLUX Kontext task created: ${response.data.id}`);
        return {
          taskId: response.data.id,
          status: 'pending',
          model: model
        };
      } else {
        throw new Error('Invalid response from FLUX Kontext API');
      }

    } catch (error) {
      console.error('❌ FLUX Kontext generation error:', error.response?.data || error.message);
      throw new Error(`FLUX Kontext generation failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Check task status and get result
   * @param {string} taskId - Task ID to check
   * @returns {Promise<Object>} Task status and result
   */
  async checkTaskStatus(taskId) {
    try {
      const response = await axios.get(`${this.baseURL}/get_result`, {
        headers: {
          'X-Key': this.apiKey,
          'Accept': 'application/json'
        },
        params: {
          id: taskId
        },
        timeout: 15000
      });

      const result = response.data;

      // Map FLUX status to our standard format
      let status = 'PENDING';
      if (result.status === 'Ready') {
        status = 'SUCCEEDED';
      } else if (result.status === 'Error' || result.status === 'Content Moderated' || result.status === 'Request Moderated') {
        status = 'FAILED';
      } else if (result.status === 'Task not found') {
        status = 'FAILED';
      }

      const taskResult = {
        status: status,
        progress: result.progress || null,
        output: null,
        error: null
      };

      if (status === 'SUCCEEDED' && result.result) {
        taskResult.output = [result.result.sample]; // FLUX returns single image URL
      } else if (status === 'FAILED') {
        taskResult.error = result.status || 'Unknown error';
      }

      console.log(`📊 FLUX task ${taskId} status: ${status}`);
      return taskResult;

    } catch (error) {
      console.error('❌ Error checking FLUX task status:', error.response?.data || error.message);
      throw new Error(`Failed to check task status: ${error.message}`);
    }
  }

  /**
   * Cancel a running task
   * @param {string} taskId - Task ID to cancel
   * @returns {Promise<boolean>} Success status
   */
  async cancelTask(taskId) {
    try {
      // Note: FLUX API might not support task cancellation
      // This is a placeholder for compatibility with the existing structure
      console.log(`🚫 Attempting to cancel FLUX task: ${taskId}`);
      console.warn('⚠️ FLUX API does not support task cancellation');
      return true;
    } catch (error) {
      console.error('❌ Error cancelling FLUX task:', error.message);
      return false;
    }
  }

  /**
   * Get available FLUX models and their capabilities
   * @returns {Array} List of available models
   */
  getSupportedModels() {
    return [
      {
        id: 'flux-pro-1.1',
        name: 'FLUX.1.1 [pro]',
        description: 'Latest and fastest FLUX model with improved quality',
        type: 'text-to-image',
        maxWidth: 2048,
        maxHeight: 2048,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        pricing: {
          'standard': 0.03,
          'high_res': 0.06
        }
      },
      {
        id: 'flux-pro',
        name: 'FLUX.1 [pro]',
        description: 'Professional model with high quality output',
        type: 'text-to-image',
        maxWidth: 1440,
        maxHeight: 1440,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        pricing: {
          'standard': 0.05
        }
      },
      {
        id: 'flux-dev',
        name: 'FLUX.1 [dev]',
        description: 'Development model for non-commercial use',
        type: 'text-to-image',
        maxWidth: 1024,
        maxHeight: 1024,
        aspectRatios: ['1:1', '16:9', '9:16'],
        pricing: {
          'standard': 0.025
        }
      },
      {
        id: 'flux-pro-1.1-kontext',
        name: 'FLUX.1 Kontext [pro]',
        description: 'Context-aware image editing and generation',
        type: 'image-to-image',
        maxWidth: 1440,
        maxHeight: 1440,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        features: ['character_consistency', 'local_editing', 'style_transfer'],
        pricing: {
          'standard': 0.06
        }
      }
    ];
  }

  /**
   * Calculate aspect ratio dimensions
   * @param {string} aspectRatio - Aspect ratio (e.g., '16:9')
   * @param {number} baseSize - Base size for calculation
   * @returns {Object} Width and height
   */
  calculateDimensions(aspectRatio, baseSize = 1024) {
    const ratios = {
      '1:1': { width: baseSize, height: baseSize },
      '16:9': { width: Math.round(baseSize * 1.33), height: baseSize },
      '9:16': { width: baseSize, height: Math.round(baseSize * 1.33) },
      '4:3': { width: Math.round(baseSize * 1.33), height: baseSize },
      '3:4': { width: baseSize, height: Math.round(baseSize * 1.33) },
      '3:2': { width: Math.round(baseSize * 1.5), height: baseSize },
      '2:3': { width: baseSize, height: Math.round(baseSize * 1.5) }
    };

    return ratios[aspectRatio] || ratios['1:1'];
  }

  /**
   * Validate prompt and parameters
   * @param {string} prompt - Text prompt
   * @param {Object} options - Generation options
   * @returns {Object} Validation result
   */
  validateParameters(prompt, options = {}) {
    const errors = [];

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      errors.push('Prompt is required and must be a string');
    } else if (prompt.trim().length === 0) {
      errors.push('Prompt cannot be empty');
    } else if (prompt.length > 1000) {
      errors.push('Prompt cannot exceed 1000 characters');
    }

    // Validate dimensions
    const { width = 1024, height = 1024, steps = 30 } = options;
    
    if (width < 256 || width > 2048) {
      errors.push('Width must be between 256 and 2048 pixels');
    }
    
    if (height < 256 || height > 2048) {
      errors.push('Height must be between 256 and 2048 pixels');
    }

    if (steps < 1 || steps > 50) {
      errors.push('Steps must be between 1 and 50');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new FluxService();