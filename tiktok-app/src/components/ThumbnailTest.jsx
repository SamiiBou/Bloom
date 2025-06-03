import React, { useState, useEffect } from 'react';
import apiService from '../services/api';

const ThumbnailTest = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        console.log('🚀 Test: Loading videos...');
        const response = await apiService.getLongVideos(1, 5);
        console.log('🚀 Test: API response:', response);
        
        if (response.status === 'success') {
          setVideos(response.data.videos);
          console.log('🚀 Test: Videos loaded:', response.data.videos);
        }
      } catch (error) {
        console.error('🚀 Test: Error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px' }}>🔄 Loading test...</div>;
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
      <h1 style={{ color: 'black', marginBottom: '20px' }}>🧪 TEST DE MINIATURE</h1>
      
      {videos.map((video, index) => (
        <div key={video._id} style={{ 
          border: '3px solid red', 
          margin: '20px 0', 
          padding: '20px',
          backgroundColor: 'white'
        }}>
          <h3 style={{ color: 'black' }}>Video {index + 1}: {video.title}</h3>
          <p style={{ color: 'black' }}>Thumbnail URL: {video.thumbnailUrl}</p>
          
          {/* Test 1: Direct img tag */}
          <div style={{ margin: '10px 0' }}>
            <p style={{ color: 'blue', fontWeight: 'bold' }}>Test 1: Direct IMG tag</p>
            <img 
              src={video.thumbnailUrl} 
              alt="Test direct"
              style={{ 
                width: '300px', 
                height: '200px', 
                border: '5px solid blue',
                backgroundColor: 'yellow'
              }}
              onLoad={() => console.log('✅ Direct img loaded:', video.thumbnailUrl)}
              onError={(e) => console.log('❌ Direct img error:', e, video.thumbnailUrl)}
            />
          </div>

          {/* Test 2: With crossOrigin */}
          <div style={{ margin: '10px 0' }}>
            <p style={{ color: 'green', fontWeight: 'bold' }}>Test 2: IMG with crossOrigin</p>
            <img 
              src={video.thumbnailUrl} 
              alt="Test CrossOrigin"
              crossOrigin="anonymous"
              style={{ 
                width: '300px', 
                height: '200px', 
                border: '5px solid green',
                backgroundColor: 'orange'
              }}
              onLoad={() => console.log('✅ CrossOrigin img loaded:', video.thumbnailUrl)}
              onError={(e) => console.log('❌ CrossOrigin img error:', e, video.thumbnailUrl)}
            />
          </div>

          {/* Test 3: As background image */}
          <div style={{ margin: '10px 0' }}>
            <p style={{ color: 'purple', fontWeight: 'bold' }}>Test 3: Image de fond</p>
            <div 
              style={{ 
                width: '300px', 
                height: '200px', 
                border: '5px solid purple',
                backgroundColor: 'pink',
                backgroundImage: `url(${video.thumbnailUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              <div style={{ padding: '10px', color: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                Test de Fond
              </div>
            </div>
          </div>

          {/* Test 4: Link to open in new tab */}
          <div style={{ margin: '10px 0' }}>
            <a 
              href={video.thumbnailUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'red', fontWeight: 'bold' }}
            >
              🔗 Ouvrir l'URL de miniature dans un nouvel onglet
            </a>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ThumbnailTest; 