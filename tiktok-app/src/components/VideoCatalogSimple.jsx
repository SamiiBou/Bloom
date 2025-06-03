import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import apiService from '../services/api';

// Ultra-simple version of video catalog
const VideoCatalogSimple = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        console.log('🎬 Loading long videos...');
        const response = await apiService.getLongVideos(1, 20);
        
        if (response.status === 'success') {
          console.log('✅ Videos loaded:', response.data.videos);
          setVideos(response.data.videos);
        } else {
          throw new Error('Failed to load videos');
        }
      } catch (err) {
        console.error('❌ Error loading videos:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f8f9f4'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '50px', 
            height: '50px', 
            border: '3px solid #ddd',
            borderTop: '3px solid #007AFF',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading videos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f8f9f4'
      }}>
        <div style={{ textAlign: 'center', color: 'red' }}>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: '#f8f9f4', 
      minHeight: '100vh', 
      padding: '20px' 
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        color: '#1d1d1f', 
        marginBottom: '30px',
        fontSize: '28px',
        fontWeight: 'bold'
      }}>
        🎬 Video Catalog ({videos.length} videos)
      </h1>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {videos.map((video, index) => (
          <VideoCardSimple key={video._id} video={video} index={index} />
        ))}
      </div>
    </div>
  );
};

// Simple video card component
const VideoCardSimple = ({ video, index }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  console.log(`🔍 Rendering video ${index + 1}:`, {
    id: video._id,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl
  });

  const handleImageLoad = () => {
    console.log(`✅ Image loaded for video ${index + 1}:`, video.thumbnailUrl);
    setImageLoaded(true);
  };

  const handleImageError = (e) => {
    console.log(`❌ Image error for video ${index + 1}:`, video.thumbnailUrl, e);
    setImageError(true);
  };

  const handleCardClick = () => {
    alert(`Video: ${video.title}\nURL: ${video.videoUrl}`);
  };

  return (
    <div 
      onClick={handleCardClick}
      style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        overflow: 'hidden',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        border: '2px solid #e0e0e0'
      }}
      onMouseEnter={(e) => e.target.style.transform = 'translateY(-4px)'}
      onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
    >
      {/* Thumbnail container */}
      <div style={{ 
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        backgroundColor: imageError ? '#ff6b6b' : '#f0f0f0',
        border: '3px solid ' + (imageError ? 'red' : imageLoaded ? 'green' : 'orange'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {!imageError && video.thumbnailUrl ? (
          <>
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                display: imageLoaded ? 'block' : 'none'
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            {!imageLoaded && (
              <div style={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#666',
                textAlign: 'center'
              }}>
                <div style={{ 
                  width: '30px', 
                  height: '30px', 
                  border: '3px solid #ddd',
                  borderTop: '3px solid #007AFF',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 10px'
                }}></div>
                Loading...
              </div>
            )}
          </>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            color: imageError ? 'white' : '#666',
            padding: '20px'
          }}>
            <Play size={48} />
            <p style={{ margin: '10px 0', fontSize: '14px' }}>
              {imageError ? 'Loading error' : 'No thumbnail'}
            </p>
            <small style={{ fontSize: '10px', opacity: 0.7 }}>
              {video.thumbnailUrl?.substring(0, 50)}...
            </small>
          </div>
        )}

        {/* Play overlay */}
        <div style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '1'}
        onMouseLeave={(e) => e.target.style.opacity = '0'}
        >
          <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: '50%',
            padding: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Play size={24} color="#000" />
          </div>
        </div>
      </div>

      {/* Video info */}
      <div style={{ padding: '15px' }}>
        <h3 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '16px', 
          fontWeight: '600',
          color: '#1d1d1f',
          lineHeight: '1.3'
        }}>
          {video.title || 'Untitled video'}
        </h3>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          marginBottom: '8px'
        }}>
          <img 
            src={video.user?.avatar || 'https://via.placeholder.com/32x32.png?text=👤'} 
            alt={video.user?.username}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%',
              objectFit: 'cover'
            }}
          />
          <span style={{ 
            fontSize: '14px', 
            color: '#666', 
            fontWeight: '500'
          }}>
            {video.user?.username || 'Unknown user'}
          </span>
        </div>

        <div style={{ 
          fontSize: '12px', 
          color: '#999',
          display: 'flex',
          gap: '15px'
        }}>
          <span>{video.viewsCount || 0} views</span>
          <span>{video.likesCount || 0} likes</span>
          <span>{new Date(video.createdAt).toLocaleDateString('en-US')}</span>
        </div>

        {/* Debug info */}
        <details style={{ marginTop: '10px' }}>
          <summary style={{ fontSize: '10px', color: '#999', cursor: 'pointer' }}>
            🔍 Debug info
          </summary>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
            <p>ID: {video._id}</p>
            <p>Type: {video.type}</p>
            <p>ThumbnailUrl: {video.thumbnailUrl ? '✅ Present' : '❌ Missing'}</p>
            <p>VideoUrl: {video.videoUrl ? '✅ Present' : '❌ Missing'}</p>
          </div>
        </details>
      </div>
    </div>
  );
};

export default VideoCatalogSimple; 