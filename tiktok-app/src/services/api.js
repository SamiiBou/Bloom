const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('authToken');
  }

  // Helper method to make HTTP requests
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    console.log(`🌐 [API] Making request to: ${url}`);
    console.log(`🌐 [API] Method: ${options.method || 'GET'}`);
    console.log(`🌐 [API] Has body: ${!!options.body}`);
    console.log(`🌐 [API] Body type: ${options.body ? (options.body instanceof FormData ? 'FormData' : typeof options.body) : 'none'}`);
    
    const headers = { ...options.headers };

    // Add default Content-Type only if not FormData and not already set by options
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Add authorization header if token exists
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      console.log(`🌐 [API] Added auth header: Bearer ${this.token.substring(0, 20)}...`);
    } else {
      console.log(`🌐 [API] No auth token available`);
    }

    console.log(`🌐 [API] Headers:`, headers);

    const config = {
      ...options, // Spread options first
      headers,    // Then override with the constructed headers
    };

    try {
      console.log(`🌐 [API] Sending fetch request...`);
      const response = await fetch(url, config);
      
      console.log(`🌐 [API] Response received:`);
      console.log(`🌐 [API] - Status: ${response.status}`);
      console.log(`🌐 [API] - Status Text: ${response.statusText}`);
      console.log(`🌐 [API] - OK: ${response.ok}`);
      console.log(`🌐 [API] - Headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.log(`🌐 [API] Response not OK, attempting to parse error...`);
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        console.log(`🌐 [API] Error data:`, errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // For 204 No Content or similar, response.json() might fail or return null
      if (response.status === 204) {
        console.log(`🌐 [API] 204 No Content response`);
        return null; 
      }
      
      console.log(`🌐 [API] Parsing JSON response...`);
      const jsonResponse = await response.json();
      console.log(`🌐 [API] Parsed JSON:`, jsonResponse);
      return jsonResponse;
    } catch (error) {
      console.error('🌐 [API] Request failed:', error);
      console.error('🌐 [API] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Authentication methods
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    // Assuming response.data.token based on backend structure from test script
    if (response.data && response.data.token) {
      this.token = response.data.token;
      localStorage.setItem('authToken', response.data.token);
    }
    
    return response;
  }

  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    // Assuming response.data.token based on backend structure from test script
    if (response.data && response.data.token) {
      this.token = response.data.token;
      localStorage.setItem('authToken', response.data.token);
    }
    
    return response;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
    // Potentially notify other parts of the app or redirect
  }

  // Method to update token if it changes elsewhere (e.g., after login/register)
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  // Nouvelle méthode pour la vérification World ID
  async verifyWorldID(proofData) {
    // Le backend devra avoir un endpoint comme /auth/worldcoin-verify
    // Il s'attendra à recevoir: merkle_root, nullifier_hash, proof, action, signal (optionnel), app_id
    return await this.request('/auth/worldcoin-verify', {
      method: 'POST',
      body: JSON.stringify(proofData), // proofData vient directement de IDKit
    });
  }

  // Mettre à jour le statut de vérification humaine
  async updateHumanVerification(data) {
    return await this.request('/auth/update-human-verification', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Video methods
  async getVideos(page = 1, limit = 10, type = null) {
    let url = `/videos?page=${page}&limit=${limit}`;
    if (type) {
      url += `&type=${type}`;
    }
    return await this.request(url);
  }

  // Méthodes spécifiques pour les types de vidéos
  async getShorts(page = 1, limit = 10) {
    return await this.getVideos(page, limit, 'short');
  }

  async getLongVideos(page = 1, limit = 20) {
    return await this.getVideos(page, limit, 'long');
  }

  // AJOUT DE LA MÉTHODE MANQUANTE
  async getFollowingVideos(page = 1, limit = 10) {
    return await this.request(`/videos/following?page=${page}&limit=${limit}`);
  }

  async getVideoById(id) {
    return await this.request(`/videos/${id}`);
  }

  async likeVideo(id) {
    return await this.request(`/videos/${id}/like`, {
      method: 'POST',
    });
  }

  // MÉTHODES POUR LES COMMENTAIRES - CORRIGÉES
  async addComment(videoId, content) {
    return await this.request(`/videos/${videoId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async getComments(videoId, page = 1, limit = 20) {
    return await this.request(`/videos/${videoId}/comments?page=${page}&limit=${limit}`);
  }

  // NOUVELLE MÉTHODE: Delete comment
  async deleteComment(videoId, commentId) {
    return await this.request(`/videos/${videoId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // NOUVELLE MÉTHODE: Like comment
  async likeComment(videoId, commentId) {
    return await this.request(`/videos/${videoId}/comments/${commentId}/like`, {
      method: 'POST',
    });
  }

  // NOUVELLE MÉTHODE: Get user's videos
  async getUserVideos(username, page = 1, limit = 12) {
    return await this.request(`/users/${username}/videos?page=${page}&limit=${limit}`);
  }

  // NOUVELLE MÉTHODE: Delete video
  async deleteVideo(videoId) {
    return await this.request(`/videos/${videoId}`, {
      method: 'DELETE',
    });
  }

  // NOUVELLE MÉTHODE: Track video watch for rewards
  async trackVideoWatch(videoId, section, duration) {
    console.log('🌐 [API] trackVideoWatch called with:', { videoId, section, duration });
    console.log('🌐 [API] Auth token present:', !!this.token);
    console.log('🌐 [API] API base URL:', this.baseURL);
    
    try {
      const response = await this.request('/videos/track-watch', {
        method: 'POST',
        body: JSON.stringify({ videoId, section, duration }),
      });
      
      console.log('🌐 [API] trackVideoWatch response:', response);
      return response;
    } catch (error) {
      console.error('🌐 [API] trackVideoWatch error:', error);
      throw error;
    }
  }

  // NOUVELLE MÉTHODE: Get grab balance and rewards status
  async getRewardsStatus() {
    return await this.request('/airdrop/status');
  }

  // Upload methods
  async uploadVideo(formData) {
    console.log('🎬 [API] uploadVideo called');
    console.log('🎬 [API] FormData entries:');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`🎬 [API]   ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
      } else {
        console.log(`🎬 [API]   ${key}: ${value}`);
      }
    }
    console.log('🎬 [API] Base URL:', this.baseURL);
    console.log('🎬 [API] Has auth token:', !!this.token);
    
    try {
      console.log('🎬 [API] Making request to /upload/video...');
      // The upload now returns a task ID for tracking instead of waiting for completion
      const response = await this.request('/upload/video', {
        method: 'POST',
        body: formData,
      });
      console.log('🎬 [API] uploadVideo response:', response);
      console.log('🎬 [API] Response type:', typeof response);
      console.log('🎬 [API] Response status:', response?.status);
      console.log('🎬 [API] Response success:', response?.success);
      console.log('🎬 [API] Response data exists:', !!response?.data);
      console.log('🎬 [API] Upload ID:', response?.data?.uploadId);
      return response;
    } catch (error) {
      console.error('🎬 [API] uploadVideo error:', error);
      console.error('🎬 [API] Error type:', typeof error);
      console.error('🎬 [API] Error message:', error.message);
      console.error('🎬 [API] Error stack:', error.stack);
      if (error.response) {
        console.error('🎬 [API] Error response:', error.response);
        console.error('🎬 [API] Error response status:', error.response.status);
        console.error('🎬 [API] Error response data:', error.response.data);
      }
      throw error;
    }
  }

  async checkUploadTaskStatus(uploadId) {
    console.log('📊 [API] checkUploadTaskStatus called with uploadId:', uploadId);
    try {
      const response = await this.request(`/upload/progress/${uploadId}`);
      console.log('📊 [API] checkUploadTaskStatus response:', response);
      return response;
    } catch (error) {
      console.error('📊 [API] checkUploadTaskStatus error:', error);
      throw error;
    }
  }

  // AI Video Generation
  async generateVideoWithAI(promptText, options = {}) {
    const response = await this.request('/ai/generate-video', {
      method: 'POST',
      body: JSON.stringify({
        promptText,
        model: options.model || 'gen4_turbo',
        duration: options.duration || 5,
        ratio: options.ratio || '1280:720'
      })
    });
    return response;
  }

  // Check AI generation task status
  async checkAITaskStatus(taskId) {
    const response = await this.request(`/ai/task/${taskId}`, {
      method: 'GET'
    });
    return response;
  }

  // Publish AI Video
  async publishAIVideo(taskId, description, hashtags, musicMetadata = null) {
    const requestBody = {
      description,
      hashtags
    };
    
    // Ajouter les métadonnées de musique si présentes
    if (musicMetadata) {
      requestBody.music = musicMetadata;
    }
    
    const response = await this.request(`/ai/task/${taskId}/publish`, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    return response;
  }

  // Reject AI Video
  async rejectAIVideo(taskId) {
    const response = await this.request(`/ai/task/${taskId}/reject`, {
      method: 'POST'
    });
    return response;
  }

  // Get AI Configuration
  async getAIConfig() {
    // Implementation needed
  }

  // User methods
  async getUserByUsername(username) {
    return await this.request(`/users/${username}`);
  }

  // Get current user profile
  async getUserProfile() {
    return await this.request('/auth/me');
  }

  async followUser(username) {
    return await this.request(`/users/${username}/follow`, {
      method: 'POST',
    });
  }

  async searchUsers(query) {
    return await this.request(`/users/search/${encodeURIComponent(query)}`);
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  // Veo AI Video Generation methods
  async generateVeoVideo(params) {
    return await this.request('/ai/veo/generate-video', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async generateVeoVideoFromImage(params) {
    return await this.request('/ai/veo/generate-video-from-image', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async checkVeoTaskStatus(taskId) {
    return await this.request(`/ai/veo/task/${taskId}`, {
      method: 'GET'
    });
  }

  async getVeoConfig() {
    return await this.request('/ai/veo/config', {
      method: 'GET'
    });
  }

  async generateFluxImage(params) {
    console.log('🎨 [API] generateFluxImage called with:', params);
    try {
      const response = await this.request('/ai/flux/generate-image', {
        method: 'POST',
        body: JSON.stringify(params)
      });
      console.log('🎨 [API] generateFluxImage response:', response);
      return response;
    } catch (error) {
      console.error('🎨 [API] generateFluxImage error:', error);
      throw error;
    }
  }

  // Edit image using FLUX Kontext (image-to-image)
  async editFluxImage(params) {
    console.log('✨ [API] editFluxImage called with:', params);
    try {
      const response = await this.request('/ai/flux/edit-image', {
        method: 'POST',
        body: JSON.stringify(params)
      });
      console.log('✨ [API] editFluxImage response:', response);
      return response;
    } catch (error) {
      console.error('✨ [API] editFluxImage error:', error);
      throw error;
    }
  }

  // Check FLUX task status
  async checkFluxTaskStatus(taskId) {
    console.log('📊 [API] checkFluxTaskStatus called with:', taskId);
    try {
      const response = await this.request(`/ai/flux/task/${taskId}`, {
        method: 'GET'
      });
      console.log('📊 [API] checkFluxTaskStatus response:', response);
      return response;
    } catch (error) {
      console.error('📊 [API] checkFluxTaskStatus error:', error);
      throw error;
    }
  }

  // Publish FLUX generated image
  async publishFluxImage(taskId, imageData) {
    console.log('📤 [API] publishFluxImage called with:', { taskId, imageData });
    try {
      const response = await this.request(`/ai/flux/task/${taskId}/publish`, {
        method: 'POST',
        body: JSON.stringify(imageData)
      });
      console.log('📤 [API] publishFluxImage response:', response);
      return response;
    } catch (error) {
      console.error('📤 [API] publishFluxImage error:', error);
      throw error;
    }
  }

  // Reject FLUX generated image
  async rejectFluxImage(taskId) {
    console.log('🗑️ [API] rejectFluxImage called with:', taskId);
    try {
      const response = await this.request(`/ai/flux/task/${taskId}/reject`, {
        method: 'POST'
      });
      console.log('🗑️ [API] rejectFluxImage response:', response);
      return response;
    } catch (error) {
      console.error('🗑️ [API] rejectFluxImage error:', error);
      throw error;
    }
  }

  // Download FLUX generated image
  async downloadFluxImage(taskId) {
    console.log('📥 [API] downloadFluxImage called with:', taskId);
    try {
      const response = await this.request(`/ai/flux/task/${taskId}/download`, {
        method: 'POST'
      });
      console.log('📥 [API] downloadFluxImage response:', response);
      return response;
    } catch (error) {
      console.error('📥 [API] downloadFluxImage error:', error);
      throw error;
    }
  }

  // Get user's FLUX image generation history
  async getFluxTasks(params = {}) {
    console.log('📋 [API] getFluxTasks called with:', params);
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 10,
        ...(params.status && { status: params.status }),
        ...(params.model && { model: params.model })
      });
      
      const response = await this.request(`/ai/flux/tasks?${queryParams.toString()}`, {
        method: 'GET'
      });
      console.log('📋 [API] getFluxTasks response:', response);
      return response;
    } catch (error) {
      console.error('📋 [API] getFluxTasks error:', error);
      throw error;
    }
  }

  // Get FLUX configuration and available models
  async getFluxConfig() {
    console.log('⚙️ [API] getFluxConfig called');
    try {
      const response = await this.request('/ai/flux/config', {
        method: 'GET'
      });
      console.log('⚙️ [API] getFluxConfig response:', response);
      return response;
    } catch (error) {
      console.error('⚙️ [API] getFluxConfig error:', error);
      throw error;
    }
  }

  // Get user's FLUX generation statistics
  async getFluxStats(timeframe = 'month') {
    console.log('📈 [API] getFluxStats called with timeframe:', timeframe);
    try {
      const response = await this.request(`/ai/flux/stats?timeframe=${timeframe}`, {
        method: 'GET'
      });
      console.log('📈 [API] getFluxStats response:', response);
      return response;
    } catch (error) {
      console.error('📈 [API] getFluxStats error:', error);
      throw error;
    }
  }

  // Delete FLUX task
  async deleteFluxTask(taskId) {
    console.log('🗑️ [API] deleteFluxTask called with:', taskId);
    try {
      const response = await this.request(`/ai/flux/task/${taskId}`, {
        method: 'DELETE'
      });
      console.log('🗑️ [API] deleteFluxTask response:', response);
      return response;
    } catch (error) {
      console.error('🗑️ [API] deleteFluxTask error:', error);
      throw error;
    }
  }

  // Get published images (all users)
  async getPublishedImages(params = {}) {
    console.log('🖼️ [API] getPublishedImages called with:', params);
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      
      const response = await this.request(`/images?${queryParams.toString()}`);
      console.log('🖼️ [API] getPublishedImages response:', response);
      return response;
    } catch (error) {
      console.error('🖼️ [API] getPublishedImages error:', error);
      throw error;
    }
  }

  // Get images for a specific user
  async getUserImages(userId, params = {}) {
    console.log('🖼️ [API] getUserImages called with:', { userId, params });
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      const response = await this.request(`/images/user/${userId}?${queryParams.toString()}`);
      console.log('🖼️ [API] getUserImages response:', response);
      return response;
    } catch (error) {
      console.error('🖼️ [API] getUserImages error:', error);
      throw error;
    }
  }

  // Get images for a specific user by username
  async getUserImagesByUsername(username, params = {}) {
    console.log('🖼️ [API] getUserImagesByUsername called with:', { username, params });
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      // First get user profile to get the user ID
      const userProfile = await this.getUserProfile(username);
      if (userProfile.status === 'success' && userProfile.data?.user?._id) {
        const userId = userProfile.data.user._id;
        console.log('🖼️ [API] Found user ID for username:', userId);
        return await this.getUserImages(userId, params);
      } else {
        throw new Error('User not found');
      }
    } catch (error) {
      console.error('🖼️ [API] getUserImagesByUsername error:', error);
      throw error;
    }
  }

  // Like/unlike an image
  async likeImage(imageId) {
    console.log('❤️ [API] likeImage called with:', imageId);
    try {
      const response = await this.request(`/images/${imageId}/like`, {
        method: 'POST'
      });
      console.log('❤️ [API] likeImage response:', response);
      return response;
    } catch (error) {
      console.error('❤️ [API] likeImage error:', error);
      throw error;
    }
  }

  // Get current user ID (helper method)
  getCurrentUserId() {
    try {
      if (!this.token) return null;
      
      // Decode JWT token to get user ID
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      return payload.userId || payload.id || null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }

  // Image comments methods
  async getImageComments(imageId, params = {}) {
    console.log('💬 [API] getImageComments called with:', { imageId, params });
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      const response = await this.request(`/images/${imageId}/comments?${queryParams.toString()}`);
      console.log('💬 [API] getImageComments response:', response);
      return response;
    } catch (error) {
      console.error('💬 [API] getImageComments error:', error);
      throw error;
    }
  }

  async addImageComment(imageId, content, parentComment = null) {
    console.log('✍️ [API] addImageComment called with:', { imageId, content, parentComment });
    try {
      const response = await this.request(`/images/${imageId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, parentComment })
      });
      console.log('✍️ [API] addImageComment response:', response);
      return response;
    } catch (error) {
      console.error('✍️ [API] addImageComment error:', error);
      throw error;
    }
  }

  async likeImageComment(imageId, commentId) {
    console.log('❤️ [API] likeImageComment called with:', { imageId, commentId });
    try {
      const response = await this.request(`/images/${imageId}/comments/${commentId}/like`, {
        method: 'POST'
      });
      console.log('❤️ [API] likeImageComment response:', response);
      return response;
    } catch (error) {
      console.error('❤️ [API] likeImageComment error:', error);
      throw error;
    }
  }

  // Upload image from device
  async uploadImage(formData) {
    console.log('🖼️ [API] uploadImage called');
    console.log('🖼️ [API] FormData entries:');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`🖼️ [API]   ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
      } else {
        console.log(`🖼️ [API]   ${key}: ${value}`);
      }
    }
    console.log('🖼️ [API] Base URL:', this.baseURL);
    console.log('🖼️ [API] Has auth token:', !!this.token);
    
    try {
      console.log('🖼️ [API] Making request to /upload/image...');
      const response = await this.request('/upload/image', {
        method: 'POST',
        body: formData
      });
      console.log('🖼️ [API] uploadImage response:', response);
      console.log('🖼️ [API] Response type:', typeof response);
      console.log('🖼️ [API] Response status:', response?.status);
      console.log('🖼️ [API] Response success:', response?.success);
      console.log('🖼️ [API] Response data exists:', !!response?.data);
      return response;
    } catch (error) {
      console.error('🖼️ [API] uploadImage error:', error);
      console.error('🖼️ [API] Error type:', typeof error);
      console.error('🖼️ [API] Error message:', error.message);
      console.error('🖼️ [API] Error stack:', error.stack);
      if (error.response) {
        console.error('🖼️ [API] Error response:', error.response);
        console.error('🖼️ [API] Error response status:', error.response.status);
        console.error('🖼️ [API] Error response data:', error.response.data);
      }
      throw error;
    }
  }
}




// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;