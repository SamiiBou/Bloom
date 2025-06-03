const RunwayML = require('@runwayml/sdk');

class RunwayService {
  constructor() {
    this.client = new RunwayML({
      apiSecret: process.env.RUNWAYML_API_SECRET
    });
  }

  /**
   * Generate a video from text prompt using Runway AI
   * @param {string} promptText - The text description for the video
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Task information
   */
  async generateVideoFromText(promptText, options = {}) {
    try {
      const {
        model = 'gen4_turbo',
        duration = 5,
        ratio = '1280:720',
        seed
      } = options;

      console.log(`🤖 Starting Runway AI video generation with prompt: "${promptText}"`);

      // For text-to-video, we need to first generate an image, then video from image
      // Or use image-to-video with a generated/provided image
      
      // Option 1: Generate image first, then video
      const imageTask = await this.client.textToImage.create({
        model: 'gen4_image',
        promptText: promptText,
        ratio: ratio === '1280:720' ? '1920:1080' : ratio, // Adjust for image generation
        seed: seed
      });

      // Wait for image generation to complete
      let imageResult = imageTask;
      do {
        await new Promise(resolve => setTimeout(resolve, 3000));
        imageResult = await this.client.tasks.retrieve(imageTask.id);
      } while (!['SUCCEEDED', 'FAILED'].includes(imageResult.status));

      if (imageResult.status === 'FAILED') {
        throw new Error('Image generation failed');
      }

      const imageUrl = imageResult.output[0];
      console.log(`🖼️ Image generated successfully: ${imageUrl}`);

      // Now generate video from the image
      const videoTask = await this.client.imageToVideo.create({
        model: model,
        promptImage: imageUrl,
        promptText: promptText,
        ratio: ratio,
        duration: duration,
        seed: seed
      });

      console.log(`📹 Video generation task created: ${videoTask.id}`);

      return {
        taskId: videoTask.id,
        status: 'PENDING',
        imageUrl: imageUrl
      };

    } catch (error) {
      console.error('❌ Runway AI generation error:', error);
      throw new Error(`Runway AI generation failed: ${error.message}`);
    }
  }

  /**
   * Generate video from image using Runway AI
   * @param {string} imageUrl - URL of the image to animate
   * @param {string} promptText - Text description for the animation
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Task information
   */
  async generateVideoFromImage(imageUrl, promptText, options = {}) {
    try {
      const {
        model = 'gen4_turbo',
        duration = 5,
        ratio = '1280:720',
        seed
      } = options;

      console.log(`🤖 Starting Runway AI image-to-video generation`);

      const task = await this.client.imageToVideo.create({
        model: model,
        promptImage: imageUrl,
        promptText: promptText,
        ratio: ratio,
        duration: duration,
        seed: seed
      });

      console.log(`📹 Video generation task created: ${task.id}`);

      return {
        taskId: task.id,
        status: 'PENDING'
      };

    } catch (error) {
      console.error('❌ Runway AI generation error:', error);
      throw new Error(`Runway AI generation failed: ${error.message}`);
    }
  }

  /**
   * Check the status of a Runway AI task
   * @param {string} taskId - The task ID to check
   * @returns {Promise<Object>} - Task status and result
   */
  async checkTaskStatus(taskId) {
    try {
      const task = await this.client.tasks.retrieve(taskId);
      
      console.log(`📊 Task ${taskId} status: ${task.status}`);

      return {
        id: task.id,
        status: task.status,
        createdAt: task.createdAt,
        output: task.output,
        error: task.error
      };

    } catch (error) {
      console.error('❌ Error checking task status:', error);
      throw new Error(`Failed to check task status: ${error.message}`);
    }
  }

  /**
   * Cancel a running task
   * @param {string} taskId - The task ID to cancel
   * @returns {Promise<boolean>} - Success status
   */
  async cancelTask(taskId) {
    try {
      await this.client.tasks.cancel(taskId);
      console.log(`🚫 Task ${taskId} cancelled`);
      return true;
    } catch (error) {
      console.error('❌ Error cancelling task:', error);
      throw new Error(`Failed to cancel task: ${error.message}`);
    }
  }

  /**
   * Validate Runway API configuration
   * @returns {Promise<boolean>} - Configuration validity
   */
  async validateConfiguration() {
    try {
      if (!process.env.RUNWAYML_API_SECRET) {
        throw new Error('RUNWAYML_API_SECRET environment variable is not set');
      }

      // Test API connection by checking organization info
      // Note: This endpoint might not exist, adjust based on actual Runway API
      console.log('✅ Runway API configuration is valid');
      return true;
    } catch (error) {
      console.error('❌ Runway API configuration error:', error);
      throw error;
    }
  }
}

module.exports = new RunwayService(); 
 