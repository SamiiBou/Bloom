const axios = require('axios');

class VeoService {
  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    this.apiEndpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models`;
  }

  /**
   * Get access token for Google Cloud authentication
   * @returns {Promise<string>} - Access token
   */
  async getAccessToken() {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('gcloud auth print-access-token');
      return stdout.trim();
    } catch (error) {
      console.error('❌ Error getting access token:', error);
      throw new Error('Failed to get Google Cloud access token');
    }
  }

  /**
   * Generate a video from text prompt using Veo 3.0
   * @param {string} promptText - The text description for the video
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Operation information
   */
  async generateVideoFromText(promptText, options = {}) {
    try {
      const {
        model = 'veo-3.0-generate-preview',
        durationSeconds = 8,
        aspectRatio = '16:9',
        negativePrompt,
        enhancePrompt = true,
        sampleCount = 1,
        seed,
        storageUri,
        generateAudio = true
      } = options;

      console.log(`🤖 Starting Veo video generation with prompt: "${promptText}"`);

      const accessToken = await this.getAccessToken();
      
      const requestBody = {
        instances: [
          {
            prompt: promptText
          }
        ],
        parameters: {
          durationSeconds,
          aspectRatio,
          sampleCount,
          enhancePrompt,
          generateAudio
        }
      };

      // Add optional parameters
      if (negativePrompt) requestBody.parameters.negativePrompt = negativePrompt;
      if (seed) requestBody.parameters.seed = seed;
      if (storageUri) requestBody.parameters.storageUri = storageUri;

      const response = await axios.post(
        `${this.apiEndpoint}/${model}:predictLongRunning`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const operationName = response.data.name;
      const operationId = operationName.split('/').pop();

      console.log(`📹 Veo video generation operation created: ${operationId}`);

      return {
        operationName,
        operationId,
        status: 'PENDING'
      };

    } catch (error) {
      console.error('❌ Veo generation error:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      throw new Error(`Veo video generation failed: ${error.message}`);
    }
  }

  /**
   * Generate video from image using Veo 3.0
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} mimeType - Image MIME type
   * @param {string} promptText - Text description for the animation
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Operation information
   */
  async generateVideoFromImage(imageBase64, mimeType, promptText, options = {}) {
    try {
      const {
        model = 'veo-3.0-generate-preview',
        durationSeconds = 8,
        aspectRatio = '16:9',
        negativePrompt,
        enhancePrompt = true,
        sampleCount = 1,
        seed,
        storageUri,
        generateAudio = true
      } = options;

      console.log(`🤖 Starting Veo image-to-video generation`);

      const accessToken = await this.getAccessToken();
      
      const requestBody = {
        instances: [
          {
            prompt: promptText,
            image: {
              bytesBase64Encoded: imageBase64,
              mimeType: mimeType
            }
          }
        ],
        parameters: {
          durationSeconds,
          aspectRatio,
          sampleCount,
          enhancePrompt,
          generateAudio
        }
      };

      // Add optional parameters
      if (negativePrompt) requestBody.parameters.negativePrompt = negativePrompt;
      if (seed) requestBody.parameters.seed = seed;
      if (storageUri) requestBody.parameters.storageUri = storageUri;

      const response = await axios.post(
        `${this.apiEndpoint}/${model}:predictLongRunning`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const operationName = response.data.name;
      const operationId = operationName.split('/').pop();

      console.log(`📹 Veo image-to-video operation created: ${operationId}`);

      return {
        operationName,
        operationId,
        status: 'PENDING'
      };

    } catch (error) {
      console.error('❌ Veo image-to-video generation error:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      throw new Error(`Veo image-to-video generation failed: ${error.message}`);
    }
  }

  /**
   * Check the status of a Veo operation
   * @param {string} operationName - The full operation name
   * @returns {Promise<Object>} - Operation status and result
   */
  async checkOperationStatus(operationName) {
    try {
      const accessToken = await this.getAccessToken();
      
      // Extract model and operation ID from operation name
      const operationId = operationName.split('/').pop();
      const modelMatch = operationName.match(/models\/([^\/]+)\//);
      const model = modelMatch ? modelMatch[1] : 'veo-3.0-generate-preview';

      const response = await axios.post(
        `${this.apiEndpoint}/${model}:fetchPredictOperation`,
        {
          operationName: operationName
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const operation = response.data;
      
      console.log(`📊 Veo operation ${operationId} status: ${operation.done ? 'DONE' : 'RUNNING'}`);

      let status = 'PENDING';
      let output = null;
      let error = null;

      if (operation.done) {
        if (operation.response) {
          status = 'SUCCEEDED';
          output = operation.response.generatedSamples;
        } else if (operation.error) {
          status = 'FAILED';
          error = operation.error;
        }
      }

      return {
        operationName,
        operationId,
        status,
        done: operation.done,
        output,
        error
      };

    } catch (error) {
      console.error('❌ Error checking Veo operation status:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      throw new Error(`Failed to check operation status: ${error.message}`);
    }
  }

  /**
   * Validate Veo API configuration
   * @returns {Promise<boolean>} - Configuration validity
   */
  async validateConfiguration() {
    try {
      if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
        throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
      }

      // Test access token
      await this.getAccessToken();
      
      console.log('✅ Veo API configuration is valid');
      return true;
    } catch (error) {
      console.error('❌ Veo API configuration error:', error);
      throw error;
    }
  }

  /**
   * Get supported models
   * @returns {Array} - List of supported models
   */
  getSupportedModels() {
    return [
      {
        id: 'veo-2.0-generate-001',
        name: 'Veo 2.0 (GA)',
        durationRange: [5, 8],
        defaultDuration: 8,
        supportsAudio: false,
        aspectRatios: ['16:9', '9:16']
      },
      {
        id: 'veo-3.0-generate-preview',
        name: 'Veo 3.0 (Preview)',
        durationRange: [8, 8],
        defaultDuration: 8,
        supportsAudio: true,
        aspectRatios: ['16:9']
      }
    ];
  }
}

module.exports = new VeoService(); 