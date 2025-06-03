import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Pause, Volume2, VolumeX, Music, Upload
} from 'lucide-react';
import './SimpleVideoEditor.css';

const SimpleVideoEditor = ({ 
  isOpen, 
  onClose, 
  initialVideo,
  onPublish 
}) => {
  // États principaux
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(1);
  
  // États musique
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  
  // Références
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Gestion de la lecture vidéo
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      videoRef.current.play().then(() => {
        // Synchroniser la musique avec la vidéo
        if (audioRef.current && backgroundMusic) {
          audioRef.current.currentTime = videoRef.current.currentTime;
          audioRef.current.play().catch(error => {
            console.warn('Erreur lecture audio:', error);
          });
        }
      }).catch(error => {
        console.warn('Erreur lecture vidéo:', error);
      });
    }
  };

  // Synchroniser l'audio quand la vidéo change de temps
  const handleVideoTimeUpdate = () => {
    if (audioRef.current && backgroundMusic && isPlaying) {
      const timeDiff = Math.abs(videoRef.current.currentTime - audioRef.current.currentTime);
      // Resynchroniser si la différence est trop grande (> 0.5s)
      if (timeDiff > 0.5) {
        audioRef.current.currentTime = videoRef.current.currentTime;
      }
    }
  };

  // Gérer la fin de la vidéo
  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Redémarrer la vidéo pour la lecture en boucle
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  // Gérer les événements de pause/play de la vidéo
  const handleVideoPlay = () => {
    setIsPlaying(true);
    if (audioRef.current && backgroundMusic) {
      audioRef.current.currentTime = videoRef.current.currentTime;
      audioRef.current.play().catch(error => {
        console.warn('Erreur sync audio on play:', error);
      });
    }
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVideoVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  };

  // Gestion de la musique
  const musicLibrary = [
    { 
      id: 1, 
      title: 'Pop Entraînant', 
      artist: 'Tendances', 
      url: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3' // URL de test
    },
    { 
      id: 2, 
      title: 'Vibes Chill', 
      artist: 'Tendances', 
      url: 'https://file-examples.com/storage/fe68c9b7c4bb3b7b7b9c9b1/2017/11/file_example_MP3_700KB.mp3' // URL de test
    },
    { 
      id: 3, 
      title: 'Rythme Épique', 
      artist: 'Tendances', 
      url: 'https://sample-videos.com/zip/10/mp3/mp3-15s.mp3' // URL de test
    },
    { 
      id: 4, 
      title: 'Vibes d\'Été', 
      artist: 'Populaire', 
      url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' // URL de test
    }
  ];

  const addBackgroundMusic = (musicData) => {
    setBackgroundMusic(musicData);
    setShowMusicLibrary(false);
    console.log('🎵 Musique ajoutée:', musicData.title);
    
    // Redémarrer la lecture si elle était en cours
    if (isPlaying && videoRef.current && audioRef.current) {
      setTimeout(() => {
        audioRef.current.currentTime = videoRef.current.currentTime;
        audioRef.current.play().catch(error => {
          console.warn('Erreur lecture audio après ajout:', error);
        });
      }, 100);
    }
  };

  const addCustomMusic = (musicFile) => {
    const musicUrl = URL.createObjectURL(musicFile);
    const customMusic = {
      id: 'custom',
      title: musicFile.name.replace(/\.[^/.]+$/, ""),
      artist: 'Votre musique',
      url: musicUrl,
      file: musicFile
    };
    setBackgroundMusic(customMusic);
    console.log('🎵 Musique personnalisée ajoutée:', customMusic.title);
    
    // Redémarrer la lecture si elle était en cours
    if (isPlaying && videoRef.current) {
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = videoRef.current.currentTime;
          audioRef.current.play().catch(error => {
            console.warn('Erreur lecture audio personnalisé:', error);
          });
        }
      }, 100);
    }
  };

  const handleMusicVolumeChange = (newVolume) => {
    setMusicVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Effet pour gérer le chargement de la musique
  useEffect(() => {
    if (audioRef.current && backgroundMusic) {
      const audio = audioRef.current;
      
      const handleAudioLoaded = () => {
        console.log('🎵 Audio chargé:', backgroundMusic.title);
        audio.volume = musicVolume;
        audio.loop = true;
        
        // Si la vidéo est en cours de lecture, démarrer l'audio
        if (isPlaying && videoRef.current) {
          audio.currentTime = videoRef.current.currentTime;
          audio.play().catch(error => {
            console.warn('Erreur auto-play audio:', error);
          });
        }
      };

      const handleAudioError = (error) => {
        console.error('Erreur chargement audio:', error);
        alert('Erreur lors du chargement de la musique. Veuillez réessayer.');
      };

      audio.addEventListener('loadeddata', handleAudioLoaded);
      audio.addEventListener('error', handleAudioError);
      
      return () => {
        audio.removeEventListener('loadeddata', handleAudioLoaded);
        audio.removeEventListener('error', handleAudioError);
      };
    }
  }, [backgroundMusic, musicVolume, isPlaying]);

  // Fonction de publication
  const handlePublish = async () => {
    try {
      console.log('🎬 Publication de la vidéo...');
      
      // Arrêter la lecture avant publication
      if (isPlaying) {
        if (videoRef.current) videoRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
      }
      
      if (!initialVideo || !initialVideo.url) {
        alert('Aucune vidéo à publier');
        return;
      }

      // Vérifier si c'est une vidéo AI avec taskId
      if (initialVideo.taskId) {
        console.log('📤 Publication via AI endpoint, taskId:', initialVideo.taskId);
        
        // Utiliser l'endpoint AI existant
        const description = `Vidéo${backgroundMusic ? ' avec musique' : ''}`;
        const hashtags = backgroundMusic ? ['musique', 'édité'] : ['vidéo'];
        
        // Préparer les métadonnées de musique
        const musicMetadata = backgroundMusic ? {
          title: backgroundMusic.title,
          artist: backgroundMusic.artist,
          url: backgroundMusic.url,
          volume: musicVolume,
          videoVolume: videoVolume
        } : null;
        
        // Importer le service API
        const { default: apiService } = await import('../services/api.js');
        
        const result = await apiService.publishAIVideo(
          initialVideo.taskId,
          description,
          hashtags,
          musicMetadata // Ajouter les métadonnées de musique
        );
        
        if (result.status === 'success') {
          console.log('✅ Vidéo AI publiée avec succès');
          alert('Vidéo publiée avec succès !');
          onPublish(result.data.video);
          handleClose();
        } else {
          throw new Error(result.message || 'Erreur lors de la publication');
        }
      } else {
        // Fallback pour les vidéos non-AI
        console.log('📤 Publication via endpoint videos standard');
        
        const videoData = {
          videoUrl: initialVideo.url,
          description: `Vidéo${backgroundMusic ? ' avec musique' : ''}`,
          hashtags: backgroundMusic ? ['musique', 'édité'] : ['vidéo'],
          metadata: {
            hasMusic: !!backgroundMusic,
            musicTitle: backgroundMusic?.title,
            musicVolume: musicVolume,
            videoVolume: videoVolume,
            editedAt: new Date().toISOString()
          }
        };

        console.log('📤 Données de publication:', videoData);

        // Obtenir le token d'authentification
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
          throw new Error('Token d\'authentification manquant. Veuillez vous reconnecter.');
        }

        // Appel API pour publier
        const response = await fetch('/api/videos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(videoData)
        });

        // Vérifier si la réponse est OK
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        if (result.status === 'success') {
          console.log('✅ Vidéo publiée avec succès');
          alert('Vidéo publiée avec succès !');
          onPublish(result.data.video);
          handleClose();
        } else {
          throw new Error(result.message || 'Erreur lors de la publication');
        }
      }

    } catch (error) {
      console.error('❌ Erreur publication:', error);
      
      // Messages d'erreur plus spécifiques
      let errorMessage = 'Erreur lors de la publication';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Session expirée. Veuillez vous reconnecter.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Accès refusé. Vérifiez vos permissions.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  // Fonction de fermeture
  const handleClose = () => {
    console.log('🔄 Fermeture de l\'éditeur...');
    
    // Arrêter la lecture
    setIsPlaying(false);
    
    // Arrêter la vidéo
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    // Arrêter l'audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Nettoyer les blob URLs
    if (backgroundMusic && backgroundMusic.url && backgroundMusic.url.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundMusic.url);
      console.log('🧹 Blob URL nettoyée');
    }
    
    // Réinitialiser les états
    setBackgroundMusic(null);
    setShowMusicLibrary(false);
    
    console.log('✅ Éditeur fermé et nettoyé');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="simple-editor-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="simple-editor-minimal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Header */}
            <div className="editor-header-minimal">
              <h2>Ajouter de la musique</h2>
              <button className="btn-close" onClick={handleClose}>
                <X size={20} />
              </button>
            </div>

            {/* Video Preview */}
            <div className="video-preview-minimal">
              {initialVideo && initialVideo.url ? (
                <video
                  ref={videoRef}
                  src={initialVideo.url}
                  className="preview-video-minimal"
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                  muted={isMuted}
                  volume={videoVolume}
                  loop
                />
              ) : (
                <div className="no-video-minimal">
                  <p>Aucune vidéo chargée</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="controls-minimal">
              <button className="play-btn-minimal" onClick={handlePlayPause}>
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              
              <div className="volume-control-minimal">
                <button className="mute-btn-minimal" onClick={handleMuteToggle}>
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={videoVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="volume-slider-minimal"
                />
              </div>
            </div>

            {/* Music Section */}
            <div className="music-section-minimal">
              <h3>
                <Music size={20} />
                Musique de fond
              </h3>
              
              {backgroundMusic ? (
                <div className="current-music-minimal">
                  <div className="music-info-minimal">
                    <strong>{backgroundMusic.title}</strong>
                    <span>{backgroundMusic.artist}</span>
                  </div>
                  <div className="music-volume-minimal">
                    <label>Volume musique:</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={musicVolume}
                      onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
                      className="volume-slider-minimal"
                    />
                    <span>{Math.round(musicVolume * 100)}%</span>
                  </div>
                  <button 
                    className="remove-music-btn-minimal"
                    onClick={() => setBackgroundMusic(null)}
                  >
                    Supprimer
                  </button>
                </div>
              ) : (
                <div className="no-music-minimal">
                  <p>Aucune musique sélectionnée</p>
                  <button 
                    className="add-music-btn-minimal"
                    onClick={() => setShowMusicLibrary(true)}
                  >
                    <Music size={16} />
                    Ajouter de la musique
                  </button>
                </div>
              )}

              {showMusicLibrary && (
                <div className="music-library-minimal">
                  <h4>Choisir une musique</h4>
                  
                  <div className="music-list-minimal">
                    {musicLibrary.map(track => (
                      <div key={track.id} className="music-item-minimal">
                        <div className="music-details-minimal">
                          <strong>{track.title}</strong>
                          <span>{track.artist}</span>
                        </div>
                        <button 
                          className="use-music-btn-minimal"
                          onClick={() => addBackgroundMusic(track)}
                        >
                          Utiliser
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="custom-music-minimal">
                    <label className="upload-music-btn-minimal">
                      <Upload size={16} />
                      Importer votre musique
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => e.target.files[0] && addCustomMusic(e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  
                  <button 
                    className="cancel-music-btn-minimal"
                    onClick={() => setShowMusicLibrary(false)}
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="actions-minimal">
              <button className="btn-cancel-minimal" onClick={handleClose}>
                Annuler
              </button>
              <button className="btn-publish-minimal" onClick={handlePublish}>
                Publier
              </button>
            </div>

            {/* Background Music Audio */}
            {backgroundMusic && (
              <audio
                ref={audioRef}
                src={backgroundMusic.url}
                loop
                volume={musicVolume}
                preload="auto"
                onLoadedData={() => console.log('🎵 Audio prêt:', backgroundMusic.title)}
                onError={(e) => console.error('❌ Erreur audio:', e)}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SimpleVideoEditor; 
 