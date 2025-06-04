import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Comments from './Comments';
import apiService from '../services/api';
import { Heart, MessageCircle, Share, Volume2, VolumeX, Music, Plus, Check } from 'lucide-react';
import './VideoCard.css';

const VideoCard = ({ video, isActive, onUpdateVideo, section = 'home' }) => {
  const { user, isAuthenticated } = useAuth();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Global mute state persisted in localStorage
  const [isMuted, setIsMuted] = useState(() => {
    const savedMuteState = localStorage.getItem('videoMuteState');
    return savedMuteState !== null ? JSON.parse(savedMuteState) : true;
  });
  const [showComments, setShowComments] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasTrackedWatch, setHasTrackedWatch] = useState(false);
  const [watchStartTime, setWatchStartTime] = useState(null);

  // DEBUG: Track isMuted state changes
  useEffect(() => {
    console.log('🔊 [DEBUG] useEffect isMuted changed:', isMuted);
    if (videoRef.current) {
      console.log('🔊 [DEBUG] videoRef.current.muted in useEffect:', videoRef.current.muted);
    }
  }, [isMuted]);

  // NEW: Force apply mute state for each new video
  useEffect(() => {
    if (videoRef.current && video.videoUrl) {
      console.log('🔊 [DEBUG] New video detected, applying mute state:', isMuted);
      videoRef.current.muted = isMuted;
      // Small delay to ensure video is loaded
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.muted = isMuted;
          console.log('🔊 [DEBUG] Mute state forced after delay:', videoRef.current.muted);
        }
      }, 100);
    }
  }, [video.videoUrl, isMuted]); // Triggers on each new video

  // Handle autoplay
  useEffect(() => {
    if (videoRef.current) {
      // Apply global mute state to video
      videoRef.current.muted = isMuted;
      console.log('🔊 [DEBUG] Mute state applied to video:', isMuted);
      
      if (isActive) {
        // Start playback with small delay to ensure synchronization
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(error => {
            console.warn('Autoplay error:', error);
            setIsPlaying(false);
          });
        }
      } else {
        // Stop immediately if not active
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset to beginning
        setIsPlaying(false);
      }
    }
  }, [isActive, isMuted]);

  // Debug method to force tracking (for testing)
  const debugTrackVideo = async () => {
    console.log('🔧 [VideoCard] DEBUG: Force tracking video...');
    if (!isAuthenticated) {
      console.log('🔧 [VideoCard] DEBUG: User not authenticated');
      return;
    }
    
    const watchDuration = watchStartTime ? (Date.now() - watchStartTime) / 1000 : 10;
    console.log('🔧 [VideoCard] DEBUG: Calling trackVideoWatch with duration:', watchDuration);
    
    try {
      const response = await apiService.trackVideoWatch(
        video.id, 
        section, 
        watchDuration
      );
      
      console.log('🔧 [VideoCard] DEBUG: API Response:', response);
      
      if (response.status === 'success' && response.tokensEarned > 0) {
        setHasTrackedWatch(true);
        console.log(`🔧 [VideoCard] DEBUG: Successfully earned ${response.tokensEarned} tokens!`);
      }
    } catch (error) {
      console.error('🔧 [VideoCard] DEBUG: Error:', error);
    }
  };

  // Auto-trigger tracking after 10 seconds for debug
  useEffect(() => {
    if (isActive && isAuthenticated && !hasTrackedWatch && watchStartTime) {
      const timer = setTimeout(() => {
        console.log('🔧 [VideoCard] AUTO-DEBUG: Triggering auto-track after 10 seconds...');
        debugTrackVideo();
      }, 10000); // 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isActive, isAuthenticated, hasTrackedWatch, watchStartTime]);

  // Handle video click (play/pause)
  const handleVideoClick = (e) => {
    console.log('🎬 [DEBUG] handleVideoClick called');
    console.log('🎬 [DEBUG] Event target:', e?.target);
    console.log('🎬 [DEBUG] Event currentTarget:', e?.currentTarget);
    
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        console.log('🎬 [DEBUG] Video paused');
      } else {
        videoRef.current.play().catch(console.error);
        setIsPlaying(true);
        console.log('🎬 [DEBUG] Video started');
      }
    }
    
    // DEBUG: Double-click to force tracking
    if (!hasTrackedWatch && isAuthenticated) {
      console.log('🔧 [VideoCard] DEBUG: Double-click detected, you can call debugTrackVideo() manually in console');
      // Expose function for manual debug
      window.debugTrackVideo = debugTrackVideo;
    }
  };

  // Handle sound toggle
  const handleMuteToggle = (e) => {
    // console.log('🔊 [DEBUG] handleMuteToggle called');
    // console.log('🔊 [DEBUG] Event:', e);
    // console.log('🔊 [DEBUG] Event target:', e.target);
    // console.log('🔊 [DEBUG] Event currentTarget:', e.currentTarget);
    
    // Prevent propagation (not stopImmediatePropagation in React)
    e.stopPropagation();
    e.preventDefault();
    
    // console.log('🔊 [DEBUG] isMuted state before:', isMuted);
    
    const newMutedState = !isMuted;
    // console.log('🔊 [DEBUG] New newMutedState:', newMutedState);
    
    // Save global state in localStorage
    localStorage.setItem('videoMuteState', JSON.stringify(newMutedState));
    // console.log('🔊 [DEBUG] State saved in localStorage:', newMutedState);
    
    setIsMuted(newMutedState);
    // console.log('🔊 [DEBUG] setIsMuted called with:', newMutedState);
    
    if (videoRef.current) {
      // console.log('🔊 [DEBUG] videoRef.current exists');
      // console.log('🔊 [DEBUG] videoRef.current.muted before:', videoRef.current.muted);
      
      videoRef.current.muted = newMutedState;
      
      // console.log('🔊 [DEBUG] videoRef.current.muted after:', videoRef.current.muted);
      // console.log('🔊 [DEBUG] videoRef.current.volume:', videoRef.current.volume);
    } else {
      console.log('❌ [DEBUG] videoRef.current does not exist!');
    }
    
    // console.log('🔊 [DEBUG] handleMuteToggle finished');
    
    // Return false to be sure
    return false;
  };

  // Handle like - Improved version
  const handleLike = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!isAuthenticated) return;
    if (isLiking) return;
    setIsLiking(true);
    
    // Optimistic update via parent
    const newLikedState = !video.isLiked;
    const newLikesCount = newLikedState ? video.likes + 1 : video.likes - 1;
    if (onUpdateVideo) {
      onUpdateVideo(video.id, {
        isLiked: newLikedState,
        likes: newLikesCount
      });
    }
    try {
      await apiService.likeVideo(video.id);
    } catch (error) {
      // Revert via parent
      if (onUpdateVideo) {
        onUpdateVideo(video.id, {
          isLiked: video.isLiked,
          likes: video.likes
        });
      }
    } finally {
      setIsLiking(false);
    }
  };

  // Handle follow
  const handleFollow = async (e) => {
    e.stopPropagation();
    
    if (!isAuthenticated || isFollowing) {
      return;
    }

    setIsFollowing(true);
    
    const newFollowingState = !video.isFollowing;
    
    // Optimistic update
    const updatedVideo = {
      ...video,
      isFollowing: newFollowingState
    };
    if (onUpdateVideo) {
      onUpdateVideo(video.id, {
        isFollowing: newFollowingState
      });
    }
  };

  // Handle comments - Improved version  
  const handleCommentsClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('💬 [Comments] Button clicked');
    setShowComments(true);
  };

  // Close comments
  const handleCloseComments = () => {
    setShowComments(false);
  };

  // Callback when new comment is added
  const handleCommentAdded = (newComment) => {
    if (onUpdateVideo) {
      onUpdateVideo(video.id, {
        comments: video.comments + 1
      });
    }
  };

  // Effect to synchronize music with video
  useEffect(() => {
    if (isPlaying && audioRef.current && video.music?.url) {
      // Synchronize audio with video
      audioRef.current.currentTime = videoRef.current?.currentTime || 0;
      audioRef.current.play().catch(error => {
        console.warn('Music playback error:', error);
      });
    } else if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying, video.music]);

  // Effect to handle music volume
  useEffect(() => {
    if (audioRef.current && video.metadata?.musicMetadata?.volume) {
      audioRef.current.volume = video.metadata.musicMetadata.volume;
    }
  }, [video.metadata]);

  // Handle video events
  const handleVideoPlay = () => {
    setIsPlaying(true);
    // Mark start of viewing
    if (!watchStartTime) {
      setWatchStartTime(Date.now());
    }
    // Start music if it exists
    if (audioRef.current && video.music?.url) {
      audioRef.current.currentTime = videoRef.current.currentTime;
      audioRef.current.play().catch(error => {
        console.warn('Music sync error:', error);
      });
    }
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    // Stop music
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleVideoEnded = async () => {
    setIsPlaying(false);
    
    console.log('🎬 [VideoCard] Video ended, starting tracking check...');
    console.log('🎬 [VideoCard] isAuthenticated:', isAuthenticated);
    console.log('🎬 [VideoCard] hasTrackedWatch:', hasTrackedWatch);
    console.log('🎬 [VideoCard] watchStartTime:', watchStartTime);
    console.log('🎬 [VideoCard] section:', section);
    console.log('🎬 [VideoCard] video ID:', video.id);
    
    // Track fully watched video for rewards
    if (isAuthenticated && !hasTrackedWatch && watchStartTime) {
      const watchDuration = (Date.now() - watchStartTime) / 1000; // in seconds
      
      // Get real video duration from video element
      let videoDuration = video.duration || 30; // default duration if not defined
      if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        videoDuration = videoRef.current.duration;
      }
      
      console.log('🎬 [VideoCard] Watch duration:', watchDuration, 'seconds');
      console.log('🎬 [VideoCard] Video duration (from props):', video.duration, 'seconds');
      console.log('🎬 [VideoCard] Video duration (from element):', videoRef.current?.duration, 'seconds');
      console.log('🎬 [VideoCard] Final video duration used:', videoDuration, 'seconds');
      console.log('🎬 [VideoCard] 50% threshold:', videoDuration * 0.5, 'seconds');
      console.log('🎬 [VideoCard] Meets threshold?', watchDuration >= videoDuration * 0.5);
      
      // Consider as "fully watched" if at least 50% of duration has been viewed (reduced for debug)
      if (watchDuration >= videoDuration * 0.5) {
        console.log('🎬 [VideoCard] Calling trackVideoWatch API...');
        try {
          const response = await apiService.trackVideoWatch(
            video.id, 
            section, 
            watchDuration
          );
          
          console.log('🎬 [VideoCard] API Response:', response);
          
          if (response.status === 'success' && response.tokensEarned > 0) {
            setHasTrackedWatch(true);
            console.log(`✅ [VideoCard] Earned ${response.tokensEarned} tokens for watching video in ${section} section`);
            
            // Optional: show notification to user
            // You can add a toast/notification here
          } else {
            console.log('ℹ️ [VideoCard] No tokens earned:', response);
          }
        } catch (error) {
          console.error('❌ [VideoCard] Error during video tracking:', error);
        }
      } else {
        console.log('⏰ [VideoCard] Video not watched long enough for rewards');
      }
    } else {
      console.log('🚫 [VideoCard] Tracking skipped. Reasons:');
      console.log('   - isAuthenticated:', isAuthenticated);
      console.log('   - hasTrackedWatch:', hasTrackedWatch);
      console.log('   - watchStartTime:', watchStartTime);
    }
    
    // Stop music
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleVideoTimeUpdate = () => {
    // Synchronize music with video
    if (audioRef.current && video.music?.url && isPlaying) {
      const timeDiff = Math.abs(videoRef.current.currentTime - audioRef.current.currentTime);
      if (timeDiff > 0.5) {
        audioRef.current.currentTime = videoRef.current.currentTime;
      }
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // DEBUG: Log state at render time
  // console.log('🔊 [DEBUG RENDER] isMuted:', isMuted);
  // console.log('🔊 [DEBUG RENDER] videoRef.current?.muted:', videoRef.current?.muted);
  // console.log('🔊 [DEBUG RENDER] Icon displayed:', isMuted ? '🔇' : '🔊');

  return (
    <>
      <div className="video-card">
        <div className="video-container" onClick={handleVideoClick}>
          <video
            ref={videoRef}
            src={video.videoUrl}
            muted={isMuted}
            loop
            playsInline
            preload="auto"
            className="video-player"
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onEnded={handleVideoEnded}
            onTimeUpdate={handleVideoTimeUpdate}
            onLoadedMetadata={() => {
              // console.log('🔊 [DEBUG] Video metadata loaded, forcing mute state:', isMuted);
              if (videoRef.current) {
                videoRef.current.muted = isMuted;
                // console.log('🔊 [DEBUG] Mute state applied on metadata load:', videoRef.current.muted);
              }
            }}
          />
          
          {/* Controls overlay */}
          <div className="video-overlay">
            {/* Play/pause button in center */}
            {!isPlaying && (
              <div className="play-button-overlay">
                <button className="play-button">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            )}
            
            {/* Mute button bottom left - aesthetic position */}
            <button 
              className="mute-button-modern"
              onClick={handleMuteToggle}
              onMouseDown={(e) => {
                e.stopPropagation();
                console.log('🔊 [] Mute button clicked (mouseDown)');
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              aria-label={isMuted ? 'Enable sound' : 'Mute sound'}
              style={{
                position: 'absolute',
                bottom: '120px',
                left: '20px',
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(10px)',
                border: 'none',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: '1000',
                transition: 'all 0.2s ease',
                color: 'white',
                pointerEvents: 'all'
              }}
            >
              {isMuted ? 
                <VolumeX size={20} style={{ pointerEvents: 'none' }} /> : 
                <Volume2 size={20} style={{ pointerEvents: 'none' }} />
              }
            </button>
          </div>
        </div>

        {/* Sidebar with actions */}
        <div className="video-sidebar">
          {/* User avatar */}
          <div className="user-avatar-section">
            <div className="user-avatar">
              {video.user.avatar ? (
                <img 
                  src={video.user.avatar} 
                  alt={video.user.username}
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-placeholder">
                  {video.user.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            {/* Follow button with minimalist icon */}
            {isAuthenticated && user?.username !== video.user.username && (
              <button 
                className={`follow-button ${video.isFollowing ? 'following' : ''}`}
                onClick={handleFollow}
                disabled={isFollowing}
              >
                {video.isFollowing ? 
                  <Check size={16} style={{ pointerEvents: 'none' }} /> : 
                  <Plus size={16} style={{ pointerEvents: 'none' }} />
                }
              </button>
            )}
          </div>

          {/* Video actions with minimalist icons */}
          <div className="video-actions">
            {/* Like button - Recreated for better click handling */}
            <button
              type="button"
              className={`action-button like-button ${video.isLiked ? 'liked' : ''}`}
              onClick={handleLike}
              onTouchStart={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: !isAuthenticated || isLiking ? 'not-allowed' : 'pointer',
                padding: '8px',
                margin: '0',
                transition: 'transform 0.2s ease',
                opacity: !isAuthenticated || isLiking ? 0.6 : 1,
                pointerEvents: !isAuthenticated || isLiking ? 'none' : 'auto'
              }}
              disabled={!isAuthenticated || isLiking}
              tabIndex={0}
              aria-pressed={video.isLiked}
              aria-label={video.isLiked ? "Unlike" : "Like"}
            >
              <div className="action-icon" style={{ fontSize: '30px', marginBottom: '2px' }}>
                <Heart 
                  size={28} 
                  fill={video.isLiked ? '#ff0050' : 'none'} 
                  color={video.isLiked ? '#ff0050' : 'white'}
                  style={{ 
                    pointerEvents: 'none',
                    filter: video.isLiked ? 'drop-shadow(0 0 8px rgba(255, 0, 80, 0.5))' : 'none'
                  }}
                />
              </div>
              <span 
                className="action-count" 
                style={{ 
                  fontSize: '12px', 
                  fontWeight: '700', 
                  textAlign: 'center', 
                  lineHeight: '1', 
                  color: 'white',
                  pointerEvents: 'none'
                }}
              >
                {formatNumber(video.likes)}
              </span>
            </button>

            {/* Comments button - Recreated for better click handling */}
            <div 
              className="action-button comment-button"
              onClick={handleCommentsClick}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '8px',
                margin: '0',
                transition: 'transform 0.2s ease',
                pointerEvents: 'auto'
              }}
            >
              <div className="action-icon" style={{ fontSize: '30px', marginBottom: '2px' }}>
                <MessageCircle 
                  size={28} 
                  color="white" 
                  style={{ pointerEvents: 'none' }} 
                />
              </div>
              <span 
                className="action-count"
                style={{ 
                  fontSize: '12px', 
                  fontWeight: '700', 
                  textAlign: 'center', 
                  lineHeight: '1', 
                  color: 'white',
                  pointerEvents: 'none'
                }}
              >
                {formatNumber(video.comments)}
              </span>
            </div>
          </div>
        </div>

        {/* Video information */}
        <div className="video-info">
          <div className="user-info">
            <span className="username">
              @{video.user.username}
              {video.user.verified && <span className="verified-badge">✓</span>}
            </span>
          </div>
          
          <p className="video-description">
            {video.description}
          </p>
          
          <div className="video-music">
            <span className="music-note">
              <Music size={16} color="white" style={{ pointerEvents: 'none' }} />
            </span>
            <span className="music-title">
              {video.music?.title && video.music?.title !== 'AI Generated' 
                ? `${video.music.title} - ${video.music.artist}`
                : video.music?.title || 'Original sound'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Audio for background music */}
      {video.music?.url && (
        <audio
          ref={audioRef}
          src={video.music.url}
          loop
          preload="auto"
          volume={video.metadata?.musicMetadata?.volume || 0.3}
        />
      )}

      {/* Comments Component */}
      <Comments
        videoId={video.id}
        isOpen={showComments}
        onClose={handleCloseComments}
        commentsCount={video.comments}
        onCommentAdded={handleCommentAdded}
      />
    </>
  );
};

export default VideoCard;