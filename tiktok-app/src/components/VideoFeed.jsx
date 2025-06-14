import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { Plus, Sparkles } from 'lucide-react';
import { FaTelegramPlane } from 'react-icons/fa';
import VideoCard from './VideoCard';
import apiService from '../services/api';
import UploadModal from './UploadModal';
import GenerationTracker from './GenerationTracker';
import LoadingSpinner from './LoadingSpinner';
import UploadTracker from './UploadTracker';
import './VideoFeed.css';

const VideoFeed = ({ feedType = 'forYou' }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Rewards banner visibility state
  const [showRewardsBanner, setShowRewardsBanner] = useState(true);
  
  // States for AI generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  
  // States for normal upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // States for upload tracking (persistent)
  const [currentUploadId, setCurrentUploadId] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const observerRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const uploadPollIntervalRef = useRef(null);

  // Fonction pour ouvrir le groupe Telegram
  const openTelegramGroup = () => {
    window.open('https://t.me/+X5ymk_jSYKk0Mjdk', '_blank');
  };

  // Function to load videos from API
  const loadVideos = async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      let response;
      
      // Choose endpoint based on feed type
      if (feedType === 'following') {
        response = await apiService.getFollowingVideos(pageNum, 10);
      } else {
        // For main feed, load only shorts
        response = await apiService.getShorts(pageNum, 10);
      }
      
      if (response.status === 'success') {
        const apiVideos = response.data.videos;
        
        // Transform API data to match expected format for VideoCard
        const transformedVideos = apiVideos.map(video => ({
          id: video._id,
          videoUrl: video.videoUrl,
          user: {
            username: video.user.username,
            avatar: video.user.avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
            verified: video.user.verified || false
          },
          description: video.description,
          music: video.music || { title: 'Original sound', artist: '' },
          likes: video.likesCount || 0,
          comments: video.commentsCount || 0,
          shares: video.sharesCount || 0,
          isLiked: video.isLiked || false,
          isFollowing: video.user.isFollowing || false
        }));

        if (append) {
          setVideos(prev => [...prev, ...transformedVideos]);
        } else {
          setVideos(transformedVideos);
        }
        
        setHasMore(response.data.pagination.hasMore);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading videos:', err);
      setError('Error loading videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load videos on component mount or when feedType changes
  useEffect(() => {
    setPage(1);
    setVideos([]);
    loadVideos(1, false);
  }, [feedType]);

  // Auto-hide rewards banner after 1 minute 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRewardsBanner(false);
    }, 90000); // 90 seconds = 1 minute 30 seconds

    return () => clearTimeout(timer);
  }, []);

  // Function to load more videos (pagination)
  const loadMoreVideos = async () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      await loadVideos(nextPage, true);
    }
  };

  const handleScroll = () => {
    if (containerRef.current) {
      setIsScrolling(true);
      
      // Clear previous timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      const scrollTop = containerRef.current.scrollTop;
      const videoHeight = containerRef.current.clientHeight;

      // Load more videos when approaching the end
      const scrollHeight = containerRef.current.scrollHeight;
      const clientHeight = containerRef.current.clientHeight;
      
      if (scrollTop + clientHeight >= scrollHeight - videoHeight * 2) { // 2 videos before the end
        loadMoreVideos();
      }
      
      // Set scrolling to false after scroll ends
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    }
  };

  const updateVideoData = async (videoId, updates) => {
    // Optimistic UI update
    setVideos(prevVideos =>
      prevVideos.map(video =>
        video.id === videoId ? { ...video, ...updates } : video
      )
    );

    // If it's a like/unlike, make API call
    if (updates.hasOwnProperty('isLiked')) {
      try {
        await apiService.likeVideo(videoId);
      } catch (err) {
        console.error('Error with like/unlike:', err);
        // Revert to previous state on error
        setVideos(prevVideos =>
          prevVideos.map(video =>
            video.id === videoId ? { 
              ...video, 
              isLiked: !updates.isLiked,
              likes: updates.isLiked ? video.likes - 1 : video.likes + 1
            } : video
          )
        );
      }
    }

    // If it's a follow/unfollow, make API call
    if (updates.hasOwnProperty('isFollowing')) {
      try {
        const video = videos.find(v => v.id === videoId);
        if (video) {
          await apiService.followUser(video.user.username);
        }
      } catch (err) {
        console.error('Error with follow/unfollow:', err);
        // Revert to previous state on error
        setVideos(prevVideos =>
          prevVideos.map(video =>
            video.id === videoId ? { ...video, isFollowing: !updates.isFollowing } : video
          )
        );
      }
    }
  };

  // Function to navigate to specific video
  const scrollToVideo = (index) => {
    if (containerRef.current && index >= 0 && index < videos.length) {
      const videoHeight = containerRef.current.clientHeight;
      containerRef.current.scrollTo({
        top: index * videoHeight,
        behavior: 'smooth'
      });
    }
  };

  // Function to go to next video
  const goToNextVideo = () => {
    if (currentVideoIndex < videos.length - 1) {
      scrollToVideo(currentVideoIndex + 1);
    }
  };

  // Function to go to previous video
  const goToPreviousVideo = () => {
    if (currentVideoIndex > 0) {
      scrollToVideo(currentVideoIndex - 1);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    // Do nothing if focus is in an input field
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.isContentEditable
    ) {
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        goToNextVideo();
        break;
      case 'ArrowUp':
        e.preventDefault();
        goToPreviousVideo();
        break;
      case ' ':
        e.preventDefault();
        // Allow VideoCard to handle pause/play
        break;
    }
  };

  // Add event listener for keys
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      container.setAttribute('tabindex', '0'); // Allow container to receive focus
      
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [currentVideoIndex, videos.length]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Upload modal handlers
  const handleFileUpload = async (file) => {
    try {
      console.log('[UPLOAD] File upload initiated:', file);
      setIsUploading(true);
      setUploadStatus('🔍 Validating file...');
      setUploadProgress(0);
      setUploadError(null);
      setUploadedVideo(null);

      const formData = new FormData();
      formData.append('video', file);
      const description = `New video uploaded on ${new Date().toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      formData.append('description', description);

      const token = localStorage.getItem('authToken');
      if (token && token !== apiService.token) {
        console.log('[UPLOAD] Setting API token from localStorage');
        apiService.setToken(token);
      }

      if (!apiService.token) {
        console.error('[UPLOAD] No API token found');
        throw new Error('Authentication required. Please log in again.');
      }

      setUploadStatus('📤 Starting upload...');
      setUploadProgress(10);
      console.log('[UPLOAD] Sending video to apiService.uploadVideo...');
      const uploadResponse = await apiService.uploadVideo(formData);
      console.log('[UPLOAD] uploadResponse:', uploadResponse);
      if (uploadResponse.status === 'accepted' && uploadResponse.data.uploadId) {
        const uploadId = uploadResponse.data.uploadId;
        setCurrentUploadId(uploadId);
        setUploadStatus('⚙️ Processing video...');
        setUploadProgress(20);
        setShowUploadModal(false);
        console.log('[UPLOAD] Starting polling for upload progress, uploadId:', uploadId);
        uploadPollIntervalRef.current = setInterval(async () => {
          try {
            const statusResponse = await apiService.checkUploadTaskStatus(uploadId);
            console.log('[UPLOAD] Polling statusResponse:', statusResponse);
            if (statusResponse.status === 'success') {
              const task = statusResponse.data;
              setUploadProgress(task.progress || 0);
              setUploadStatus(task.displayStatus || task.status);
              if (task.status === 'SUCCEEDED') {
                clearInterval(uploadPollIntervalRef.current);
                setIsUploading(false);
                setUploadedVideo(task.video);
                setUploadStatus('✅ Video uploaded successfully!');
                setUploadProgress(100);
                loadVideos(1, false);
                setTimeout(() => {
                  setCurrentUploadId(null);
                  setUploadedVideo(null);
                  setUploadStatus('');
                  setUploadProgress(0);
                }, 5000);
              } else if (task.status === 'FAILED') {
                clearInterval(uploadPollIntervalRef.current);
                setIsUploading(false);
                setUploadError(task.error || 'Upload failed');
                setUploadStatus('❌ Upload failed');
              }
            }
          } catch (pollError) {
            if (pollError.message?.includes('429')) {
              console.log('[UPLOAD] Rate limited during polling, will retry:', pollError);
              return;
            }
            console.error('[UPLOAD] Error polling upload status:', pollError);
          }
        }, 3000);
      } else {
        console.error('[UPLOAD] Upload response not accepted:', uploadResponse);
        throw new Error(uploadResponse.message || 'Upload failed');
      }
    } catch (error) {
      console.error('[UPLOAD] Upload error:', error);
      setIsUploading(false);
      setUploadError(error.message);
      setUploadStatus(`❌ ${error.message}`);
      setCurrentUploadId(null);
      setTimeout(() => {
        setUploadError(null);
        setUploadStatus('');
        setUploadProgress(0);
      }, 5000);
    }
  };

  const handleAIGenerate = async (promptText, options = {}) => {
    try {
      setIsGenerating(true);
      setGenerationProgress(5);
      setGenerationStatus('🚀 Initializing generation...');
      setShowUploadModal(false); // Close upload modal

      const token = localStorage.getItem('authToken');
      if (token && token !== apiService.token) {
        apiService.setToken(token);
      }

      if (!apiService.token) {
        throw new Error('You must be logged in to generate a video');
      }

      setGenerationProgress(10);
      setGenerationStatus('🎨 Generating base image...');

      const response = await apiService.generateVideoWithAI(promptText, {
        duration: options.duration || 5,
        ratio: options.ratio || '1280:720',
        model: options.model || 'gen4_turbo'
      });

      if (response.status === 'success') {
        const taskId = response.data.taskId;
        setCurrentTaskId(taskId);
        setGenerationProgress(25);
        setGenerationStatus('📹 Video generation in progress...');

        // Start polling to track progress
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusResponse = await apiService.checkAITaskStatus(taskId);
            
            if (statusResponse.status === 'success') {
              const task = statusResponse.data.task;
              
              if (task.status === 'SUCCEEDED') {
                clearInterval(pollIntervalRef.current);
                setGenerationProgress(100);
                setGenerationStatus('✅ Video generated successfully!');
                
                // Prepare generated video data
                setGeneratedVideo({
                  taskId: taskId,
                  videoUrl: task.videoUrl,
                  promptText: promptText,
                  duration: options.duration || 5,
                  cost: options.duration === 10 ? 42 : 21
                });
                
                setIsGenerating(false);
                
              } else if (task.status === 'FAILED') {
                clearInterval(pollIntervalRef.current);
                throw new Error('AI generation failed');
              } else {
                // Still processing - update progress
                const progressMap = {
                  'PENDING': 30,
                  'RUNNING': Math.min(85, 40 + Math.floor(Math.random() * 30))
                };
                setGenerationProgress(progressMap[task.status] || 50);
                
                const statusMap = {
                  'PENDING': '⏳ Waiting for processing...',
                  'RUNNING': '🎬 Generating video...'
                };
                setGenerationStatus(statusMap[task.status] || '🔄 Processing...');
              }
            }
          } catch (pollError) {
            clearInterval(pollIntervalRef.current);
            throw pollError;
          }
        }, 3000); // Poll every 3 seconds

        // Timeout after 5 minutes
        setTimeout(() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            setIsGenerating(false);
            setGenerationStatus('⏰ Timeout exceeded');
          }
        }, 300000);

      } else {
        throw new Error(response.message || 'AI generation failed');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      setGenerationStatus(`❌ ${error.message}`);
      setIsGenerating(false);
      
      // Clear after 4 seconds
      setTimeout(() => {
        setGenerationStatus('');
        setGenerationProgress(0);
        setCurrentTaskId(null);
      }, 4000);
      
      throw error; // Re-throw for UploadModal to handle
    }
  };

  // Preview action handlers
  const handlePublish = async (taskId) => {
    try {
      setIsPublishing(true);
      setGenerationStatus('📤 Publishing...');
      
      const response = await apiService.publishAIVideo(taskId, generatedVideo.promptText, []);
      
      if (response.status === 'success') {
        setGenerationStatus('✅ Video published successfully!');
        
        // Refresh videos to include the new one
        loadVideos(1, false);
        
        // Reset states
        setTimeout(() => {
          setGeneratedVideo(null);
          setCurrentTaskId(null);
          setGenerationProgress(0);
          setGenerationStatus('');
        }, 2000);
      } else {
        throw new Error('Error during publication');
      }
    } catch (error) {
      console.error('Publish error:', error);
      setGenerationStatus(`❌ ${error.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReject = async (taskId) => {
    try {
      setIsRejecting(true);
      setGenerationStatus('🗑️ Deleting...');
      
      const response = await apiService.rejectAIVideo(taskId);
      
      if (response.status === 'success') {
        setGenerationStatus('✅ Video deleted');
        
        // Reset states
        setTimeout(() => {
          setGeneratedVideo(null);
          setCurrentTaskId(null);
          setGenerationProgress(0);
          setGenerationStatus('');
        }, 1500);
      } else {
        throw new Error('Error during deletion');
      }
    } catch (error) {
      console.error('Reject error:', error);
      setGenerationStatus(`❌ ${error.message}`);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleCloseTracker = () => {
    // Only close if generation is complete
    if (!isGenerating) {
      setGeneratedVideo(null);
      setCurrentTaskId(null);
      setGenerationProgress(0);
      setGenerationStatus('');
    }
  };

  // Upload tracker handlers
  const handleCloseUploadTracker = () => {
    // Only close if upload is complete or failed
    if (!isUploading) {
      setCurrentUploadId(null);
      setUploadedVideo(null);
      setUploadError(null);
      setUploadStatus('');
      setUploadProgress(0);
    }
  };

  const handlePreviewUploaded = (videoData) => {
    // For now, just scroll to the video in the feed
    // In a more advanced implementation, you could open a preview modal
    console.log('Preview uploaded video:', videoData);
    // Refresh videos to ensure it's in the feed
    loadVideos(1, false);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (uploadPollIntervalRef.current) {
        clearInterval(uploadPollIntervalRef.current);
      }
    };
  }, []);

  // Loading state display
  if (loading && videos.length === 0) {
    return (
      <div className="video-catalog loading video-catalog-loading">
        <LoadingSpinner text="Loading videos..." size="medium" variant="pulse" />
      </div>
    );
  }

  // Error display
  if (error && videos.length === 0) {
    return (
      <div className="video-feed error">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => loadVideos(1, false)} className="retry-button">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Display when no videos are available
  if (!loading && videos.length === 0) {
    const emptyMessage = feedType === 'following' 
      ? 'No videos from your subscriptions at the moment.'
      : 'No videos available at the moment.';
    
    const emptySubMessage = feedType === 'following'
      ? 'Follow creators to see their videos here!'
      : 'Be the first to share a video!';

    return (
      <div className="video-feed empty">
        <div className="empty-message">
          <p>{emptyMessage}</p>
          <p>{emptySubMessage}</p>
          <button 
            className="create-first-video-btn"
            onClick={() => setShowUploadModal(true)}
          >
            <Sparkles size={20} />
            Create my first video
          </button>
        </div>
        
        {/* Floating create button - Also visible when empty */}
        <div className="create-video-fab">
          <button 
            className="fab-button"
            onClick={() => setShowUploadModal(true)}
            aria-label="Create a video"
          >
            <Plus size={28} strokeWidth={2} />
            <div className="fab-shine"></div>
          </button>
          <div className="fab-label">New short</div>
        </div>

        {/* Upload Modal */}
        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onFileUpload={handleFileUpload}
          onAIGenerate={handleAIGenerate}
          isUploading={isUploading}
          uploadStatus={uploadStatus}
          uploadProgress={uploadProgress}
        />

        {/* Generation Tracker */}
        <GenerationTracker
          isGenerating={isGenerating}
          progress={generationProgress}
          status={generationStatus}
          taskId={currentTaskId}
          onClose={handleCloseTracker}
          onPublish={handlePublish}
          onReject={handleReject}
          generatedVideo={generatedVideo}
        />

        {/* Upload Tracker */}
        <UploadTracker
          isUploading={isUploading}
          progress={uploadProgress}
          status={uploadStatus}
          uploadId={currentUploadId}
          onClose={handleCloseUploadTracker}
          onPreview={handlePreviewUploaded}
          uploadedVideo={uploadedVideo}
          error={uploadError}
        />
      </div>
    );
  }

  const ObservedVideoCard = ({ video, index }) => {
    const { ref, inView } = useInView({ threshold: 0.6 });

    useEffect(() => {
      if (inView) {
        setCurrentVideoIndex(index);
      }
    }, [inView, index]);

    return (
      <div ref={ref}>
        <VideoCard
          key={video.id}
          video={video}
          isActive={index === currentVideoIndex}
          onUpdateVideo={updateVideoData}
          section="home"
        />
      </div>
    );
  };

  return (
    <div 
      className="video-feed" 
      ref={containerRef}
      onScroll={handleScroll}
    >
      {/* Join Us button - Transparent theme for home page */}
      <div className="join-us-home-button">
        <div className="social-btn telegram-btn-home" onClick={openTelegramGroup}>
          <FaTelegramPlane size={18} />
          <span>Join Us</span>
        </div>
      </div>

      {/* Rewards info banner */}
      {showRewardsBanner && (
        <div className="rewards-info-banner">
          <span className="rewards-text">
            For each video watched you receive 0.1 BLOOM (0.2 for verified human) — Go to profile section to claim your BLOOM
          </span>
        </div>
      )}

      {videos.map((video, index) => (
        <ObservedVideoCard key={video.id} video={video} index={index} />
      ))}
      
      {/* Loading indicator for pagination */}
      {loading && videos.length > 0 && (
        <div className="loading-more">
          <LoadingSpinner 
            text="" 
            size="small" 
            variant="circle"
          />
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onFileUpload={handleFileUpload}
        onAIGenerate={handleAIGenerate}
        isUploading={isUploading}
        uploadStatus={uploadStatus}
        uploadProgress={uploadProgress}
      />

      {/* Generation Tracker */}
      <GenerationTracker
        isGenerating={isGenerating}
        progress={generationProgress}
        status={generationStatus}
        taskId={currentTaskId}
        onClose={handleCloseTracker}
        onPublish={handlePublish}
        onReject={handleReject}
        generatedVideo={generatedVideo}
      />

      {/* Upload Tracker */}
      <UploadTracker
        isUploading={isUploading}
        progress={uploadProgress}
        status={uploadStatus}
        uploadId={currentUploadId}
        onClose={handleCloseUploadTracker}
        onPreview={handlePreviewUploaded}
        uploadedVideo={uploadedVideo}
        error={uploadError}
      />

      {/* Floating create button - Always visible */}
      <div className="create-video-fab">
        <button 
          className="fab-button"
          onClick={() => setShowUploadModal(true)}
          aria-label="Create a video"
        >
          <Plus size={28} strokeWidth={2} />
          <div className="fab-shine"></div>
        </button>
        <div className="fab-label">New short</div>
      </div>
    </div>
  );
};

export default VideoFeed;