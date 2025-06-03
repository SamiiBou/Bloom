import React, { useState, useEffect, useRef } from 'react';
import { Play, Clock, Eye, Heart, MessageCircle, Share2, User, Upload, Plus, Camera, Search, Sparkles, X, Volume2, VolumeX, Maximize, Pause, Check, MoreHorizontal, Flag, UserPlus, UserMinus, ChevronDown, Film, Download } from 'lucide-react';
import apiService from '../services/api';
import LoadingSpinner from './LoadingSpinner';
// import VeoGenerator from './VeoGenerator'; // Temporarily disabled
import BloomLogo from '../assets/Bloom_LOGO.jpg';
import './VideoCatalog.css';

// Component for thumbnail with ROBUST error handling
const VideoThumbnail = ({ src, alt }) => (
  <img
    src={src}
    alt={alt}
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      background: '#444',
      border: '2px solid orange'
    }}
    onLoad={() => console.log('[VideoThumbnail SIMPLE] ✅ loaded', src)}
    onError={() => console.log('[VideoThumbnail SIMPLE] ❌ error', src)}
  />
);

// New modern VideoCard component - Apple Design
const VideoCard = ({ video, index, onClick, formatDuration, formatViews, formatTimeAgo }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleImageLoad = () => {
    console.log(`✅ [VideoCard] Image loaded for ${video.title}:`, video.thumbnail);
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = (e) => {
    console.error(`❌ [VideoCard] Image error for ${video.title}:`, video.thumbnail, e);
    setImageError(true);
    setImageLoaded(false);
  };

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '18px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
    width: '100%',
    maxWidth: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
    fontSmoothing: 'antialiased',
    transform: isHovered ? 'translateY(-4px) scale(1.01)' : 'translateY(0) scale(1)',
    boxShadow: isHovered 
      ? '0 12px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)' 
      : '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
    borderColor: isHovered ? 'rgba(0, 0, 0, 0.06)' : 'rgba(0, 0, 0, 0.04)'
  };

  const thumbnailContainerStyle = {
    position: 'relative',
    width: '100%',
    height: '200px',
    backgroundColor: imageError ? '#ff6b6b' : '#f5f5f7',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    display: imageLoaded && !imageError ? 'block' : 'none'
  };

  const overlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.4) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isHovered ? 1 : 0,
    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  const playIconStyle = {
    color: '#ffffff',
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '50%',
    padding: '16px',
    width: '56px',
    height: '56px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const durationStyle = {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: '#ffffff',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Mono", monospace',
    letterSpacing: '0.02em'
  };

  const infoStyle = {
    padding: '16px',
    display: 'flex',
    gap: '12px'
  };

  const avatarStyle = {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #ffffff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    flexShrink: 0
  };

  const contentStyle = {
    flex: 1,
    minWidth: 0
  };

  const titleStyle = {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1d1d1f',
    lineHeight: '1.3',
    letterSpacing: '-0.2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  };

  const authorStyle = {
    fontSize: '14px',
    color: '#8e8e93',
    fontWeight: '500',
    margin: '0 0 4px 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const statsStyle = {
    fontSize: '12px',
    color: '#8e8e93',
    fontWeight: '400',
    letterSpacing: '0.1px',
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  };

  const placeholderStyle = {
    textAlign: 'center',
    color: imageError ? 'white' : '#666',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  };

  const loadingStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#8e8e93',
    textAlign: 'center'
  };

  const spinnerStyle = {
    width: '24px',
    height: '24px',
    border: '2px solid #e5e5ea',
    borderTop: '2px solid #007AFF',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 8px'
  };

  return (
    <div 
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail container */}
      <div style={thumbnailContainerStyle}>
        {/* Main image */}
        {video.thumbnail && !imageError && (
          <img
            src={video.thumbnail}
            alt={video.title || 'Video thumbnail'}
            style={imageStyle}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {/* Loading indicator */}
        {!imageLoaded && !imageError && video.thumbnail && (
          <div style={loadingStyle}>
            <div style={spinnerStyle}></div>
            <div style={{ fontSize: '12px', fontWeight: '500' }}>Loading...</div>
          </div>
        )}

        {/* Error or missing image placeholder */}
        {(imageError || !video.thumbnail) && (
          <div style={placeholderStyle}>
            <Film size={48} />
            <div style={{ fontSize: '14px', fontWeight: '500' }}>
              {imageError ? 'Loading error' : 'No thumbnail'}
            </div>
            {video.thumbnail && (
              <div style={{ fontSize: '10px', opacity: 0.7, wordBreak: 'break-all', maxWidth: '200px' }}>
                {video.thumbnail.substring(0, 50)}...
              </div>
            )}
          </div>
        )}

        {/* Play overlay */}
        <div style={overlayStyle}>
          <div style={playIconStyle}>
            <Play size={24} />
          </div>
        </div>

        {/* Duration */}
        {video.duration && (
          <div style={durationStyle}>
            {formatDuration ? formatDuration(video.duration) : video.duration}
          </div>
        )}
      </div>

      {/* Video information */}
      <div style={infoStyle}>
        {/* User avatar */}
        <img 
          src={video.user?.avatar || video.author?.avatar || 'https://via.placeholder.com/42x42.png?text=👤'} 
          alt={video.user?.username || video.author?.name || 'User'}
          style={avatarStyle}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/42x42.png?text=👤';
          }}
        />

        {/* Text content */}
        <div style={contentStyle}>
          <h3 style={titleStyle}>
            {video.title || 'Untitled video'}
          </h3>
          
          <div style={authorStyle}>
            {video.user?.username || video.author?.name || 'Unknown user'}
          </div>

          <div style={statsStyle}>
            <span>{formatViews ? formatViews(video.views || video.viewsCount || 0) : (video.views || video.viewsCount || 0)} views</span>
            <span>•</span>
            <span>{formatTimeAgo ? formatTimeAgo(video.createdAt || video.uploadDate) : 'Recently'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoCatalog = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // States for upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);
  
  // New states for upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    file: null,
    videoPreview: null,
    thumbnail: null,
    thumbnailPreview: null
  });

  // States for Veo modal
  const [showVeoModal, setShowVeoModal] = useState(false);

  // Load videos from API
  const loadVideos = async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      console.log('🔄 Loading long videos from API...');
      
      // Load only long videos for catalog
      const response = await apiService.getLongVideos(pageNum, 20);
      console.log('📡 Complete API response:', response);
      
      if (response.status === 'success') {
        const apiVideos = response.data.videos;
        console.log('📹 Long videos loaded from API:', apiVideos.length);
        console.log('📊 First video from API:', apiVideos[0]);
        
        // Transform data for catalog SIMPLIFIED
        const transformedVideos = apiVideos.map(video => {
          // Correction: fallback if no thumbnail
          let thumbnail = video.thumbnailUrl;
          if (thumbnail && !thumbnail.match(/\.(jpg|jpeg|png|webp)$/i)) {
            thumbnail = thumbnail + '.jpg';
            console.warn('🟡 Patch: Adding .jpg to thumbnail', video._id, '->', thumbnail);
          }
          if (!thumbnail || thumbnail.includes('undefined') || thumbnail.includes('null')) {
            thumbnail = generateThumbnail(video.videoUrl, video._id);
            console.warn('⚠️ Missing or invalid thumbnail for video', video._id, '-> fallback:', thumbnail);
          }
          return {
            id: video._id,
            title: video.title || 'Untitled video',
            description: video.description || '',
            category: video.category || 'other',
            videoUrl: video.videoUrl,
            thumbnail, // Always a value
            duration: video.duration || '0:30',
            views: video.viewsCount || 0,
            likes: video.likesCount || 0,
            comments: video.commentsCount || 0,
            shares: video.sharesCount || 0,
            user: {
              username: video.user?.username || 'Unknown user',
              avatar: video.user?.avatar || 'https://via.placeholder.com/32x32.png?text=👤',
              verified: video.user?.verified || false
            },
            uploadDate: new Date(video.createdAt).toLocaleDateString('en-US'),
            createdAt: video.createdAt,
            music: video.music,
            isLiked: video.isLiked || false,
            isFollowing: video.user?.isFollowing || false
          };
        });

        console.log('🔄 Videos transformed for front-end:', transformedVideos.length);
        console.log('🖼️ First transformed video:', transformedVideos[0]);
        console.log('📊 All thumbnail URLs:', transformedVideos.map(v => ({ id: v.id, thumbnail: v.thumbnail })));

        if (append) {
          setVideos(prev => [...prev, ...transformedVideos]);
        } else {
          setVideos(transformedVideos);
        }
        
        setHasMore(response.data.pagination.hasMore);
        setError(null);
      }
    } catch (err) {
      console.error('❌ Error loading videos:', err);
      setError('Error loading videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate thumbnail from video URL
  const generateThumbnail = (videoUrl, videoId) => {
    // Create varied thumbnails based on video ID
    const thumbnailVariants = [
      'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1551817958-d9d86fb29431?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1496715976403-7e36dc43f17b?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=320&h=180&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&h=180&fit=crop&crop=center'
    ];
    
    // Use video ID to select thumbnail deterministically
    const index = videoId ? videoId.length % thumbnailVariants.length : Math.floor(Math.random() * thumbnailVariants.length);
    return thumbnailVariants[index];
  };

  // Filter videos by search and category
  useEffect(() => {
    let filtered = videos;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(video => video.category === selectedCategory);
    }
    
    // Filter by search
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(video =>
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.user.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredVideos(filtered);
  }, [videos, searchQuery, selectedCategory]);

  // Load videos on mount
  useEffect(() => {
    loadVideos(1, false);
  }, []);

  // Load more videos
  const loadMoreVideos = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadVideos(nextPage, true);
    }
  };

  // Open video player
  const openVideoPlayer = (video) => {
    setSelectedVideo(video);
  };

  // Close video player
  const closeVideoPlayer = () => {
    setSelectedVideo(null);
  };

  // Format view count
  const formatViews = (views) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  // Format duration
  const formatDuration = (duration) => {
    if (typeof duration === 'string') return duration;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format relative date (X days/weeks/months ago)
  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now - date;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return "today";
    } else if (diffInDays === 1) {
      return "1 day ago";
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return months === 1 ? "1 month ago" : `${months} months ago`;
    } else {
      const years = Math.floor(diffInDays / 365);
      return years === 1 ? "1 year ago" : `${years} years ago`;
    }
  };

  // Format categories
  const formatCategory = (category) => {
    const categoryNames = {
      'education': 'Education',
      'entertainment': 'Entertainment',
      'music': 'Music',
      'gaming': 'Gaming',
      'sports': 'Sports',
      'technology': 'Technology',
      'lifestyle': 'Lifestyle',
      'travel': 'Travel',
      'food': 'Food',
      'fashion': 'Fashion',
      'news': 'News',
      'comedy': 'Comedy',
      'art': 'Art',
      'science': 'Science',
      'health': 'Health',
      'business': 'Business',
      'other': 'Other'
    };
    return categoryNames[category] || category;
  };

  const categoryOptions = [
    { value: 'all', label: 'All' },
    { value: 'education', label: 'Education' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'music', label: 'Music' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'sports', label: 'Sports' },
    { value: 'technology', label: 'Technology' },
    { value: 'lifestyle', label: 'Lifestyle' },
    { value: 'travel', label: 'Travel' },
    { value: 'food', label: 'Food' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'news', label: 'News' },
    { value: 'comedy', label: 'Comedy' },
    { value: 'art', label: 'Art' },
    { value: 'science', label: 'Science' },
    { value: 'health', label: 'Health' },
    { value: 'business', label: 'Business' },
    { value: 'other', label: 'Other' }
  ];

  // Upload function for long videos
  const handleUploadClick = () => {
    if (!isUploading) {
      setShowUploadModal(true);
    }
  };

  const handleFileSelectInModal = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // File validation
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      alert('Video is too large (max 500MB)');
      return;
    }

    // Create preview URL
    const videoPreview = URL.createObjectURL(file);
    
    setUploadFormData(prev => ({
      ...prev,
      file: file,
      videoPreview: videoPreview
    }));
  };

  const handleThumbnailSelectInModal = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // File validation
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('Image is too large (max 5MB)');
      return;
    }

    // Create preview URL
    const thumbnailPreview = URL.createObjectURL(file);
    
    setUploadFormData(prev => ({
      ...prev,
      thumbnail: file,
      thumbnailPreview: thumbnailPreview
    }));
  };

  const handleUploadSubmit = async () => {
    console.log('[UPLOAD] handleUploadSubmit called');
    if (!uploadFormData.file || !uploadFormData.title.trim() || !uploadFormData.description.trim() || !uploadFormData.thumbnail) {
      console.warn('[UPLOAD] Missing required fields:', uploadFormData);
      alert('Please fill in all required fields and add a poster image');
      return;
    }

    try {
      setIsUploading(true);
      setUploadStatus('⏳ Upload in progress...');
      console.log('[UPLOAD] Preparing to get video duration...');
      // Get video duration
      const duration = await getVideoDuration(uploadFormData.file);
      console.log(`[UPLOAD] Detected duration: ${duration}s`);

      const formData = new FormData();
      formData.append('video', uploadFormData.file);
      formData.append('title', uploadFormData.title.trim());
      formData.append('description', uploadFormData.description.trim());
      formData.append('category', uploadFormData.category);
      formData.append('type', 'long');
      formData.append('duration', duration.toString());
      formData.append('thumbnail', uploadFormData.thumbnail);

      // Debug: log FormData keys
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`[UPLOAD] FormData: ${key} = File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else {
          console.log(`[UPLOAD] FormData: ${key} = ${value}`);
        }
      }

      console.log('[UPLOAD] Calling apiService.uploadVideo...');
      const response = await apiService.uploadVideo(formData);
      console.log('[UPLOAD] API response:', response);

      if (response.status === 'success') {
        setUploadStatus('✅ Video uploaded successfully!');
        setShowUploadModal(false);
        console.log('[UPLOAD] Upload success, resetting form and reloading videos');
        // Reset form
        setUploadFormData({
          title: '',
          description: '',
          category: 'other',
          file: null,
          videoPreview: null,
          thumbnail: null,
          thumbnailPreview: null
        });
        // Reload videos
        setTimeout(() => {
          loadVideos(1, false);
          setUploadStatus('');
        }, 2000);
      } else {
        console.error('[UPLOAD] Upload failed:', response);
        throw new Error(response.message || 'Upload failed');
      }
    } catch (error) {
      console.error('[UPLOAD] Upload error:', error);
      setUploadStatus(`❌ ${error.message}`);
      setTimeout(() => setUploadStatus(''), 4000);
      alert('Upload error: ' + (error.message || error));
    } finally {
      setIsUploading(false);
      console.log('[UPLOAD] handleUploadSubmit finished, isUploading:', false);
    }
  };

  const handleCloseUploadModal = () => {
    if (uploadFormData.videoPreview) {
      URL.revokeObjectURL(uploadFormData.videoPreview);
    }
    if (uploadFormData.thumbnailPreview) {
      URL.revokeObjectURL(uploadFormData.thumbnailPreview);
    }
    setShowUploadModal(false);
    setUploadFormData({
      title: '',
      description: '',
      category: 'other',
      file: null,
      videoPreview: null,
      thumbnail: null,
      thumbnailPreview: null
    });
  };

  // Function to get video duration
  const getVideoDuration = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Unable to read video file'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  // Veo Generator functions
  const handleVeoVideoGenerated = (video) => {
    console.log('✅ Veo video generated:', video);
    // Reload videos to display the new generated video
    loadVideos(1, false);
  };

  const handleCloseVeoModal = () => {
    setShowVeoModal(false);
  };

  if (loading && videos.length === 0) {
    return (
      <div className="video-catalog loading video-catalog-loading">
        <LoadingSpinner 
          text="Loading catalog..." 
          size="medium" 
          variant="pulse"
        />
      </div>
    );
  }

  if (error && videos.length === 0) {
    return (
      <div className="video-catalog error">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => loadVideos(1, false)} className="retry-button">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-catalog">
      <div className="catalog-inner">  
        {/* Header avec logo et bouton upload */}
        <div className="catalog-header">
          <div className="header-left">
            <img src={BloomLogo} alt="Bloom Logo" style={{ height: 50, maxWidth: 140, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>
          <div className="header-buttons">
            <button 
              className="upload-icon-btn"
              onClick={handleUploadClick}
              disabled={isUploading}
              title="Upload long video"
            >
              {isUploading ? (
                <div className="upload-spinner-small"></div>
              ) : (
                <Upload size={20} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {/* Category selector */}
        <div className="category-selector">
          <div className="category-tabs">
            {categoryOptions.map(option => (
              <button
                key={option.value}
                className={`category-tab ${selectedCategory === option.value ? 'active' : ''}`}
                onClick={() => setSelectedCategory(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {uploadStatus && (
          <div className="upload-status">
            {uploadStatus}
          </div>
        )}

        {/* Videos grid */}
        <div className="videos-grid">
          {filteredVideos.length === 0 && !loading ? (
            <div className="no-results">
              <div className="no-results-content">
                <h3>No videos found</h3>
                <p>
                  {searchQuery.trim() !== '' 
                    ? `No results for "${searchQuery}"`
                    : selectedCategory !== 'all'
                    ? `No videos in "${formatCategory(selectedCategory)}" category`
                    : 'No videos available at the moment'
                  }
                </p>
              </div>
            </div>
          ) : (
            filteredVideos.map((video, index) => (
              <VideoCard 
                key={video.id} 
                video={video} 
                index={index}
                onClick={() => openVideoPlayer(video)}
                formatDuration={formatDuration}
                formatViews={formatViews}
                formatTimeAgo={formatTimeAgo}
              />
            ))
          )}
        </div>

        {/* Load more button */}
        {hasMore && (
          <div className="load-more-container">
            <button 
              onClick={loadMoreVideos} 
              className="load-more-btn"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load more videos'}
            </button>
          </div>
        )}

        {/* Long video upload modal */}
        {showUploadModal && (
          <div className="upload-modal" onClick={handleCloseUploadModal}>
            <div className="upload-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="upload-modal-header">
                <h2>Upload a long video</h2>
                <button className="close-btn" onClick={handleCloseUploadModal}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              
              <div className="upload-modal-body">
                <div className="upload-form">
                  <div className="form-section">
                    <label className="form-label">
                      <strong>Video file *</strong>
                    </label>
                    <div className="file-upload-area">
                      {!uploadFormData.file ? (
                        <div className="file-drop-zone">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelectInModal}
                            className="file-input"
                          />
                          <div className="file-drop-content">
                            <Upload size={48} />
                            <p>Click to select or drag your video here</p>
                            <small>Supported formats: MP4, AVI, MOV, etc. (max 500MB)</small>
                          </div>
                        </div>
                      ) : (
                        <div className="file-preview">
                          <video
                            src={uploadFormData.videoPreview}
                            controls
                            className="video-preview"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(uploadFormData.videoPreview);
                              setUploadFormData(prev => ({ ...prev, file: null, videoPreview: null }));
                            }}
                            className="remove-file-btn"
                          >
                            ✕ Change file
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-section">
                    <label className="form-label">
                      <strong>Title *</strong>
                    </label>
                    <input
                      type="text"
                      value={uploadFormData.title}
                      onChange={(e) => setUploadFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Give your video an engaging title..."
                      maxLength="200"
                      className="form-input"
                    />
                    <small>{uploadFormData.title.length}/200 characters</small>
                  </div>

                  <div className="form-section">
                    <label className="form-label">
                      <strong>Description *</strong>
                    </label>
                    <textarea
                      value={uploadFormData.description}
                      onChange={(e) => setUploadFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your video, add keywords..."
                      maxLength="2000"
                      rows="4"
                      className="form-textarea"
                    />
                    <small>{uploadFormData.description.length}/2000 characters</small>
                  </div>

                  <div className="form-section">
                    <label className="form-label">
                      <strong>Category</strong>
                    </label>
                    <select
                      value={uploadFormData.category}
                      onChange={(e) => setUploadFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="form-select"
                    >
                      {categoryOptions.slice(1).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-section">
                    <label className="form-label">
                      <strong>Poster image *</strong>
                    </label>
                    <p className="form-help">Required image that will appear as thumbnail in the catalog</p>
                    <div className="file-upload-area">
                      {!uploadFormData.thumbnail ? (
                        <div className="file-drop-zone thumbnail-drop-zone">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleThumbnailSelectInModal}
                            className="file-input"
                          />
                          <div className="file-drop-content">
                            <Camera size={32} />
                            <p>Click to select a poster image</p>
                            <small>Supported formats: JPG, PNG, WebP (max 5MB)</small>
                          </div>
                        </div>
                      ) : (
                        <div className="thumbnail-preview">
                          <img
                            src={uploadFormData.thumbnailPreview}
                            alt="Poster preview"
                            className="thumbnail-preview-img"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(uploadFormData.thumbnailPreview);
                              setUploadFormData(prev => ({ ...prev, thumbnail: null, thumbnailPreview: null }));
                            }}
                            className="remove-thumbnail-btn"
                          >
                            ✕ Remove image
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="upload-modal-footer">
                <button 
                  type="button"
                  onClick={handleCloseUploadModal}
                  className="btn-secondary"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => { console.log('[UPLOAD] Publish button clicked'); handleUploadSubmit(); }}
                  className="btn-primary"
                  disabled={isUploading || !uploadFormData.file || !uploadFormData.title.trim() || !uploadFormData.description.trim() || !uploadFormData.thumbnail}
                >
                  {isUploading ? '⏳ Uploading...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Veo Generator Modal - temporarily disabled */}
        {/* 
        {showVeoModal && (
          <VeoGenerator
            isOpen={showVeoModal}
            onClose={() => setShowVeoModal(false)}
            onVideoGenerated={handleVeoVideoGenerated}
          />
        )}
        */}

        {/* Video player modal */}
        {selectedVideo && (
          <VideoPlayerModal 
            video={selectedVideo} 
            onClose={closeVideoPlayer}
            formatCategory={formatCategory}
            formatDuration={formatDuration}
          />
        )}
      </div>
    </div>
  );
};

// Video player modal - YouTube Mobile Style
const VideoPlayerModal = ({ video, onClose, formatCategory, formatDuration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [hasTrackedWatch, setHasTrackedWatch] = useState(false);
  const [watchStartTime, setWatchStartTime] = useState(null);
  const [isFollowing, setIsFollowing] = useState(video.isFollowing || false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(video.user.followersCount || 0);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const progressRef = useRef(null);
  const modalRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const touchStartY = useRef(null);

  // Load complete user data if needed
  useEffect(() => {
    const loadUserData = async () => {
      if (!userDataLoaded && video.user.username) {
        try {
          const response = await apiService.getUserProfile(video.user.username);
          if (response.status === 'success') {
            setFollowersCount(response.data.followersCount || 0);
            // Update follow status if available
            if (response.data.isFollowing !== undefined) {
              setIsFollowing(response.data.isFollowing);
            }
          }
        } catch (error) {
          console.error('❌ Error loading user data:', error);
          // Keep default value in case of error
        } finally {
          setUserDataLoaded(true);
        }
      }
    };

    loadUserData();
  }, [video.user.username, userDataLoaded]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!canFollow() || isFollowLoading) {
      if (!canFollow()) {
        alert("You cannot follow yourself!");
      }
      return;
    }

    try {
      setIsFollowLoading(true);
      console.log(`${isFollowing ? 'Unfollow' : 'Follow'} user:`, video.user.username);
      
      const response = await apiService.followUser(video.user.username);
      
      if (response.status === 'success') {
        const wasFollowing = isFollowing;
        setIsFollowing(!isFollowing);
        
        // Update local followers count
        setFollowersCount(prev => wasFollowing ? prev - 1 : prev + 1);
        
        console.log(`✅ ${wasFollowing ? 'Unfollowed' : 'Followed'} ${video.user.username} successfully`);
      } else {
        throw new Error(response.message || 'Failed to update follow status');
      }
    } catch (error) {
      console.error('❌ Error following/unfollowing user:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Handle swipe down to close
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (!touchStartY.current) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY.current;
      
      // If swipe down more than 100px, close modal
      if (deltaY > 100) {
        modalRef.current?.classList.add('closing');
        setTimeout(onClose, 300);
      }
    };

    const handleTouchEnd = () => {
      touchStartY.current = null;
    };

    const modal = modalRef.current;
    if (modal) {
      modal.addEventListener('touchstart', handleTouchStart);
      modal.addEventListener('touchmove', handleTouchMove);
      modal.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (modal) {
        modal.removeEventListener('touchstart', handleTouchStart);
        modal.removeEventListener('touchmove', handleTouchMove);
        modal.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [onClose]);

  // Handle native browser fullscreen events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      console.log('🎬 Fullscreen state changed:', isCurrentlyFullscreen);
      setIsFullscreen(isCurrentlyFullscreen);
    };

    const handleFullscreenError = (e) => {
      console.error('❌ Fullscreen error event:', e);
      setIsFullscreen(false);
    };

    // Add listeners for all prefixes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    document.addEventListener('fullscreenerror', handleFullscreenError);
    document.addEventListener('webkitfullscreenerror', handleFullscreenError);
    document.addEventListener('mozfullscreenerror', handleFullscreenError);
    document.addEventListener('MSFullscreenError', handleFullscreenError);

    return () => {
      // Clean up listeners
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      document.removeEventListener('fullscreenerror', handleFullscreenError);
      document.removeEventListener('webkitfullscreenerror', handleFullscreenError);
      document.removeEventListener('mozfullscreenerror', handleFullscreenError);
      document.removeEventListener('MSFullscreenError', handleFullscreenError);
    };
  }, []);

  // Hide controls after 3 seconds
  const hideControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Show controls
  const handleShowControls = () => {
    setShowControls(true);
    hideControlsTimeout();
  };

  // Trigger control hiding when video starts playing
  useEffect(() => {
    if (isPlaying) {
      hideControlsTimeout();
    } else {
      // Show controls when video is paused
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Play/Pause
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
        if (!watchStartTime) {
          setWatchStartTime(Date.now());
        }
      }
    }
  };

  // Update time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Update buffer
      if (videoRef.current.buffered.length > 0) {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBuffered((bufferedEnd / videoRef.current.duration) * 100);
      }
    }
  };

  // Handle metadata loading
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  // Handle video end
  const handleVideoEnded = async () => {
    setIsPlaying(false);
    
    // Track for rewards
    if (!hasTrackedWatch && watchStartTime) {
      const watchDuration = (Date.now() - watchStartTime) / 1000;
      const videoDuration = duration || 30;
      
      if (watchDuration >= videoDuration * 0.8) {
        try {
          const response = await apiService.trackVideoWatch(
            video.id, 
            'videos',
            watchDuration
          );
          
          if (response.status === 'success' && response.tokensEarned > 0) {
            setHasTrackedWatch(true);
            console.log(`✅ Earned ${response.tokensEarned} tokens`);
          }
        } catch (error) {
          console.error('❌ Error tracking video:', error);
        }
      }
    }
  };

  // Seek in video
  const handleProgressClick = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    
    if (videoRef.current) {
      videoRef.current.currentTime = pos * duration;
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Toggle fullscreen - Corrected version with fallback
  const toggleFullscreen = async () => {
    console.log('🎬 Toggle fullscreen clicked, current state:', isFullscreen);
    console.log('🔍 modalRef.current:', modalRef.current);
    console.log('🔍 document.fullscreenEnabled:', document.fullscreenEnabled);
    console.log('🔍 Available APIs:', {
      requestFullscreen: !!modalRef.current?.requestFullscreen,
      webkitRequestFullscreen: !!modalRef.current?.webkitRequestFullscreen,
      mozRequestFullScreen: !!modalRef.current?.mozRequestFullScreen,
      msRequestFullscreen: !!modalRef.current?.msRequestFullscreen
    });
    
    if (!modalRef.current) {
      console.error('❌ modalRef is null');
      return;
    }

    const element = modalRef.current;
    
    try {
      if (!isFullscreen) {
        // Enter fullscreen
        console.log('🎬 Entering fullscreen...');
        
        // Try all available APIs
        if (element.requestFullscreen) {
          console.log('✅ Using standard requestFullscreen');
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          console.log('✅ Using webkit requestFullscreen');
          await element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          console.log('✅ Using moz requestFullscreen');
          await element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          console.log('✅ Using ms requestFullscreen');
          await element.msRequestFullscreen();
        } else {
          console.warn('⚠️ Fullscreen API not supported, using CSS fallback');
          // CSS fallback: simulate fullscreen
          setIsFullscreen(true);
          return;
        }
      } else {
        // Exit fullscreen
        console.log('🎬 Exiting fullscreen...');
        
        if (document.exitFullscreen) {
          console.log('✅ Using standard exitFullscreen');
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          console.log('✅ Using webkit exitFullscreen');
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          console.log('✅ Using moz exitFullscreen');
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          console.log('✅ Using ms exitFullscreen');
          await document.msExitFullscreen();
        } else {
          console.warn('⚠️ Exit fullscreen API not supported, using CSS fallback');
          // CSS fallback: disable simulated fullscreen
          setIsFullscreen(false);
          return;
        }
      }
    } catch (error) {
      console.error('❌ Fullscreen error:', error);
      console.log('🔄 Falling back to CSS-only fullscreen simulation');
      // On error, use CSS fallback
      setIsFullscreen(!isFullscreen);
    }
  };

  // Format time
  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num?.toString() || '0';
  };

  // Check if user can follow this user
  const canFollow = () => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUsername = currentUser.username;
    
    // A user cannot follow themselves
    return currentUsername && currentUsername !== video.user.username;
  };

  return (
    <div 
      className={`video-player-modal ${isFullscreen ? 'fullscreen' : ''}`} 
      ref={modalRef}
    >
      {/* Container video with 16:9 ratio */}
      <div className="youtube-video-container" onClick={handleShowControls}>
        <video
          ref={videoRef}
          src={video.videoUrl}
          className="youtube-video"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleVideoEnded}
          onLoadStart={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          playsInline
          preload="metadata"
        />

        {/* Loading spinner */}
        {isLoading && (
          <div className="youtube-loading-overlay">
            <div className="youtube-loading-spinner"></div>
          </div>
        )}

        {/* Overlay with controls */}
        <div 
          className={`youtube-video-overlay ${showControls ? 'visible' : ''}`}
          ref={overlayRef}
        >
          {/* Player header */}
          <div className="youtube-player-header">
            <button className="youtube-close-btn" onClick={onClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            <h3 className="youtube-player-title">{video.title}</h3>
          </div>

          {/* Central controls */}
          <div className="youtube-center-controls">
            <button className="youtube-control-btn youtube-play-pause" onClick={togglePlayPause}>
              {isPlaying ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
          </div>

          {/* Bottom controls */}
          <div className="youtube-bottom-controls">
            {/* Progress bar */}
            <div className="youtube-progress-container" onClick={handleProgressClick}>
              <span className="youtube-time">{formatTime(currentTime)}</span>
              <div className="youtube-progress-bar" ref={progressRef}>
                <div 
                  className="youtube-progress-buffered" 
                  style={{ width: `${buffered}%` }}
                />
                <div 
                  className="youtube-progress-played" 
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                <div 
                  className="youtube-progress-handle" 
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <span className="youtube-time">{formatTime(duration)}</span>
            </div>

            {/* Additional controls */}
            <div className="youtube-extra-controls">
              <div className="youtube-left-controls">
                <button className="youtube-control-icon" onClick={toggleMute}>
                  {isMuted ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  )}
                </button>
              </div>

              <div className="youtube-right-controls">
                <button className="youtube-control-icon" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Container scrollable for details */}
      <div className="youtube-details-container">
        {/* Video information */}
        <div className="youtube-video-info">
          <h1 className="youtube-video-title">{video.title}</h1>
          <div className="youtube-video-meta">
            <span>{formatNumber(video.views)} views</span>
            <span>{video.user.username}</span>
            <span>{video.uploadDate}</span>
          </div>
        </div>

        {/* Video actions */}
        <div className="youtube-video-actions">
          <button className={`youtube-action-btn ${video.isLiked ? 'active' : ''}`}>
            <span className="youtube-action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
            </span>
            <span className="youtube-action-label">{formatNumber(video.likes)}</span>
          </button>
          
          <button className="youtube-action-btn">
            <span className="youtube-action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </span>
            <span className="youtube-action-label">Share</span>
          </button>
          
          <button className="youtube-action-btn">
            <span className="youtube-action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </span>
            <span className="youtube-action-label">Download</span>
          </button>
        </div>

        {/* Channel section */}
        <div className="youtube-channel-section">
          <div className="youtube-channel-header">
            <div className="youtube-channel-info">
              <img 
                src={video.user.avatar} 
                alt={video.user.username} 
                className="youtube-channel-avatar"
              />
              <div className="youtube-channel-details">
                <div className="youtube-channel-name">
                  {video.user.username}
                </div>
                <div className="youtube-channel-subs">
                  {formatNumber(followersCount)} subscribers
                </div>
              </div>
            </div>
            <button 
              className={`youtube-subscribe-btn ${isFollowing ? 'subscribed' : ''}`}
              onClick={handleFollow}
              disabled={!canFollow() || isFollowLoading}
              style={{ 
                opacity: !canFollow() ? 0.5 : 1,
                cursor: !canFollow() ? 'not-allowed' : 'pointer'
              }}
            >
              {isFollowLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid transparent',
                    borderTop: '2px solid currentColor',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  {isFollowing ? 'Unfollowing...' : 'Following...'}
                </span>
              ) : !canFollow() ? (
                'You'
              ) : (
                isFollowing ? 'Following' : 'Follow'
              )}
            </button>
          </div>
        </div>

        {/* Comments section */}
        <div className="youtube-comments-section">
          <div className="youtube-comments-header">
            <h2 className="youtube-comments-title">
              Comments
              <span className="youtube-comments-count">{formatNumber(video.comments)}</span>
            </h2>
          </div>
          <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
            Comments are temporarily disabled
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoCatalog;