import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Play, Pause, Volume2, VolumeX, Save, Download, 
  Plus, Scissors, Type, Music, Image, Video, 
  RotateCcw, RotateCw, ZoomIn, ZoomOut, Layers,
  Settings, Palette, Sparkles, Upload, Trash2
} from 'lucide-react';
import './VideoEditor.css';

const VideoEditor = ({ 
  isOpen, 
  onClose, 
  initialVideo,
  onSave,
  onPublish 
}) => {
  // Main states
  const [project, setProject] = useState({
    clips: [],
    duration: 0,
    resolution: { width: 1280, height: 720 },
    fps: 30
  });
  
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [zoom, setZoom] = useState(1);
  
  // References
  const previewRef = useRef(null);
  const timelineRef = useRef(null);
  
  // Tool states
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [showEffects, setShowEffects] = useState(false);

  // Initialize with base video
  useEffect(() => {
    if (initialVideo && project.clips.length === 0) {
      const initialClip = {
        id: Date.now(),
        type: 'video',
        source: initialVideo.url,
        startTime: 0,
        duration: initialVideo.duration || 5,
        position: { x: 0, y: 0 },
        scale: 1,
        rotation: 0,
        opacity: 1,
        volume: 1,
        effects: [],
        metadata: {
          prompt: initialVideo.prompt,
          isAI: true
        }
      };
      
      setProject(prev => ({
        ...prev,
        clips: [initialClip],
        duration: initialClip.duration
      }));
    }
  }, [initialVideo]);

  // Playback functions
  const handlePlayPause = () => {
    if (previewRef.current) {
      if (isPlaying) {
        previewRef.current.pause();
      } else {
        previewRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (previewRef.current) {
      setCurrentTime(previewRef.current.currentTime);
    }
  };

  const handleSeek = (time) => {
    if (previewRef.current) {
      previewRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Editing functions
  const addClip = (clipData) => {
    const newClip = {
      id: Date.now(),
      type: clipData.type,
      source: clipData.source,
      startTime: project.duration,
      duration: clipData.duration || 5,
      position: { x: 0, y: 0 },
      scale: 1,
      rotation: 0,
      opacity: 1,
      volume: clipData.type === 'audio' ? 1 : 0.5,
      effects: [],
      metadata: clipData.metadata || {}
    };

    setProject(prev => ({
      ...prev,
      clips: [...prev.clips, newClip],
      duration: prev.duration + newClip.duration
    }));
  };

  const removeClip = (clipId) => {
    setProject(prev => {
      const newClips = prev.clips.filter(clip => clip.id !== clipId);
      const newDuration = newClips.reduce((total, clip) => total + clip.duration, 0);
      return {
        ...prev,
        clips: newClips,
        duration: newDuration
      };
    });
    setSelectedClip(null);
  };

  const updateClip = (clipId, updates) => {
    setProject(prev => ({
      ...prev,
      clips: prev.clips.map(clip => 
        clip.id === clipId ? { ...clip, ...updates } : clip
      )
    }));
  };

  const addTextOverlay = (textData) => {
    const textClip = {
      id: Date.now(),
      type: 'text',
      content: textData.text,
      startTime: currentTime,
      duration: textData.duration || 3,
      position: { x: 50, y: 50 },
      style: {
        fontSize: textData.fontSize || 24,
        color: textData.color || '#ffffff',
        fontFamily: textData.fontFamily || 'Arial',
        fontWeight: textData.fontWeight || 'bold',
        textAlign: textData.textAlign || 'center',
        backgroundColor: textData.backgroundColor || 'transparent',
        borderRadius: textData.borderRadius || 0,
        padding: textData.padding || 10
      },
      animation: textData.animation || 'none'
    };

    setProject(prev => ({
      ...prev,
      clips: [...prev.clips, textClip]
    }));
  };

  const addMusicTrack = (musicData) => {
    const musicClip = {
      id: Date.now(),
      type: 'audio',
      source: musicData.url,
      startTime: 0,
      duration: musicData.duration || project.duration,
      volume: musicData.volume || 0.3,
      fadeIn: musicData.fadeIn || 0,
      fadeOut: musicData.fadeOut || 0,
      metadata: {
        title: musicData.title,
        artist: musicData.artist
      }
    };

    setProject(prev => ({
      ...prev,
      clips: [...prev.clips, musicClip]
    }));
  };

  // AI generation functions
  const generateAIVideo = async (prompt, options) => {
    try {
      // API call to generate new video
      const response = await fetch('/api/ai/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          promptText: prompt,
          ...options
        })
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        // Add to timeline once generated
        return result.data.taskId;
      }
    } catch (error) {
      console.error('AI generation error:', error);
    }
  };

  // Export functions
  const handleSave = () => {
    const projectData = {
      ...project,
      lastModified: new Date().toISOString()
    };
    onSave(projectData);
  };

  const handleExport = async () => {
    try {
      // API call to assemble final video
      const response = await fetch('/api/video/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(project)
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        onPublish(result.data.video);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="video-editor-overlay"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="video-editor">
            {/* Header */}
            <div className="editor-header">
              <div className="header-left">
                <h2>Video Editor</h2>
                <div className="project-info">
                  <span>{project.clips.length} clips</span>
                  <span>•</span>
                  <span>{Math.round(project.duration)}s</span>
                </div>
              </div>
              
              <div className="header-actions">
                <button className="btn-secondary" onClick={handleSave}>
                  <Save size={16} />
                  Save
                </button>
                <button className="btn-primary" onClick={handleExport}>
                  <Download size={16} />
                  Export
                </button>
                <button className="btn-close" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="editor-content">
              {/* Left Sidebar - Tools */}
              <div className="editor-sidebar">
                <div className="tool-tabs">
                  <button 
                    className={`tool-tab ${activeTab === 'media' ? 'active' : ''}`}
                    onClick={() => setActiveTab('media')}
                  >
                    <Video size={20} />
                    <span>Media</span>
                  </button>
                  
                  <button 
                    className={`tool-tab ${activeTab === 'text' ? 'active' : ''}`}
                    onClick={() => setActiveTab('text')}
                  >
                    <Type size={20} />
                    <span>Text</span>
                  </button>
                  
                  <button 
                    className={`tool-tab ${activeTab === 'music' ? 'active' : ''}`}
                    onClick={() => setActiveTab('music')}
                  >
                    <Music size={20} />
                    <span>Music</span>
                  </button>
                  
                  <button 
                    className={`tool-tab ${activeTab === 'effects' ? 'active' : ''}`}
                    onClick={() => setActiveTab('effects')}
                  >
                    <Sparkles size={20} />
                    <span>Effects</span>
                  </button>
                </div>

                <div className="tool-content">
                  {activeTab === 'media' && <MediaPanel onAddClip={addClip} />}
                  {activeTab === 'text' && <TextPanel onAddText={addTextOverlay} />}
                  {activeTab === 'music' && <MusicPanel onAddMusic={addMusicTrack} />}
                  {activeTab === 'effects' && <EffectsPanel selectedClip={selectedClip} onUpdateClip={updateClip} />}
                </div>
              </div>

              {/* Center - Preview */}
              <div className="editor-preview">
                <div className="preview-container">
                  <video
                    ref={previewRef}
                    className="preview-video"
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  
                  {/* Overlays for text and effects */}
                  <div className="preview-overlays">
                    {project.clips
                      .filter(clip => clip.type === 'text' && 
                        currentTime >= clip.startTime && 
                        currentTime <= clip.startTime + clip.duration)
                      .map(textClip => (
                        <div
                          key={textClip.id}
                          className="text-overlay"
                          style={{
                            left: `${textClip.position.x}%`,
                            top: `${textClip.position.y}%`,
                            ...textClip.style
                          }}
                        >
                          {textClip.content}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Controls */}
                <div className="preview-controls">
                  <button onClick={handlePlayPause}>
                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                  </button>
                  
                  <div className="time-display">
                    {Math.round(currentTime)}s / {Math.round(project.duration)}s
                  </div>
                  
                  <div className="zoom-controls">
                    <button onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}>
                      <ZoomOut size={16} />
                    </button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(4, zoom + 0.25))}>
                      <ZoomIn size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Sidebar - Properties */}
              <div className="editor-properties">
                {selectedClip ? (
                  <ClipProperties 
                    clip={selectedClip} 
                    onUpdate={(updates) => updateClip(selectedClip.id, updates)}
                    onRemove={() => removeClip(selectedClip.id)}
                  />
                ) : (
                  <div className="no-selection">
                    <Layers size={48} />
                    <p>Select an element to edit its properties</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom - Timeline */}
            <div className="editor-timeline">
              <Timeline
                project={project}
                currentTime={currentTime}
                zoom={zoom}
                selectedClip={selectedClip}
                onSeek={handleSeek}
                onSelectClip={setSelectedClip}
                onUpdateClip={updateClip}
                onRemoveClip={removeClip}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Auxiliary components
const MediaPanel = ({ onAddClip }) => {
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  
  return (
    <div className="media-panel">
      <div className="panel-section">
        <h3>Add media</h3>
        
        <button className="media-btn" onClick={() => setShowAIGenerator(true)}>
          <Sparkles size={20} />
          Generate with AI
        </button>
        
        <button className="media-btn">
          <Upload size={20} />
          Import video
        </button>
        
        <button className="media-btn">
          <Image size={20} />
          Import image
        </button>
      </div>

      {showAIGenerator && (
        <div className="ai-generator">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe the video to generate..."
            rows={3}
          />
          <div className="ai-options">
            <select>
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
            </select>
            <button onClick={() => {/* Generate */}}>
              Generate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const TextPanel = ({ onAddText }) => {
  const [textData, setTextData] = useState({
    text: '',
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Arial',
    duration: 3
  });

  const handleAddText = () => {
    if (textData.text.trim()) {
      onAddText(textData);
      setTextData({ ...textData, text: '' });
    }
  };

  return (
    <div className="text-panel">
      <div className="panel-section">
        <h3>Add text</h3>
        
        <textarea
          value={textData.text}
          onChange={(e) => setTextData({ ...textData, text: e.target.value })}
          placeholder="Your text..."
          rows={3}
        />
        
        <div className="text-options">
          <div className="option-group">
            <label>Size</label>
            <input
              type="range"
              min="12"
              max="72"
              value={textData.fontSize}
              onChange={(e) => setTextData({ ...textData, fontSize: parseInt(e.target.value) })}
            />
          </div>
          
          <div className="option-group">
            <label>Color</label>
            <input
              type="color"
              value={textData.color}
              onChange={(e) => setTextData({ ...textData, color: e.target.value })}
            />
          </div>
          
          <div className="option-group">
            <label>Duration (s)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={textData.duration}
              onChange={(e) => setTextData({ ...textData, duration: parseInt(e.target.value) })}
            />
          </div>
        </div>
        
        <button className="btn-primary" onClick={handleAddText}>
          Add text
        </button>
      </div>
    </div>
  );
};

const MusicPanel = ({ onAddMusic }) => {
  const musicLibrary = [
    { id: 1, title: 'Upbeat Pop', artist: 'Library', duration: 30, url: '/music/upbeat.mp3' },
    { id: 2, title: 'Chill Vibes', artist: 'Library', duration: 45, url: '/music/chill.mp3' },
    { id: 3, title: 'Epic Cinematic', artist: 'Library', duration: 60, url: '/music/epic.mp3' }
  ];

  return (
    <div className="music-panel">
      <div className="panel-section">
        <h3>Music library</h3>
        
        <div className="music-list">
          {musicLibrary.map(track => (
            <div key={track.id} className="music-item">
              <div className="music-info">
                <div className="music-title">{track.title}</div>
                <div className="music-artist">{track.artist}</div>
              </div>
              <button 
                className="btn-small"
                onClick={() => onAddMusic(track)}
              >
                <Plus size={16} />
              </button>
            </div>
          ))}
        </div>
        
        <button className="media-btn">
          <Upload size={20} />
          Import music
        </button>
      </div>
    </div>
  );
};

const EffectsPanel = ({ selectedClip, onUpdateClip }) => {
  if (!selectedClip) {
    return (
      <div className="effects-panel">
        <p>Select a clip to apply effects</p>
      </div>
    );
  }

  const effects = [
    { id: 'blur', name: 'Blur', icon: '🌫️' },
    { id: 'sepia', name: 'Sepia', icon: '🟤' },
    { id: 'grayscale', name: 'Black & White', icon: '⚫' },
    { id: 'brightness', name: 'Brightness', icon: '☀️' },
    { id: 'contrast', name: 'Contrast', icon: '🔳' }
  ];

  return (
    <div className="effects-panel">
      <div className="panel-section">
        <h3>Visual effects</h3>
        
        <div className="effects-grid">
          {effects.map(effect => (
            <button
              key={effect.id}
              className="effect-btn"
              onClick={() => {
                const newEffects = selectedClip.effects.includes(effect.id)
                  ? selectedClip.effects.filter(e => e !== effect.id)
                  : [...selectedClip.effects, effect.id];
                onUpdateClip({ effects: newEffects });
              }}
            >
              <span className="effect-icon">{effect.icon}</span>
              <span className="effect-name">{effect.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const ClipProperties = ({ clip, onUpdate, onRemove }) => {
  return (
    <div className="clip-properties">
      <div className="properties-header">
        <h3>Properties</h3>
        <button className="btn-danger" onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="property-group">
        <label>Position X</label>
        <input
          type="range"
          min="0"
          max="100"
          value={clip.position?.x || 0}
          onChange={(e) => onUpdate({ 
            position: { ...clip.position, x: parseInt(e.target.value) }
          })}
        />
      </div>
      
      <div className="property-group">
        <label>Position Y</label>
        <input
          type="range"
          min="0"
          max="100"
          value={clip.position?.y || 0}
          onChange={(e) => onUpdate({ 
            position: { ...clip.position, y: parseInt(e.target.value) }
          })}
        />
      </div>
      
      <div className="property-group">
        <label>Scale</label>
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.1"
          value={clip.scale || 1}
          onChange={(e) => onUpdate({ scale: parseFloat(e.target.value) })}
        />
      </div>
      
      <div className="property-group">
        <label>Opacity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={clip.opacity || 1}
          onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
        />
      </div>
      
      {clip.type === 'video' && (
        <div className="property-group">
          <label>Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={clip.volume || 1}
            onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
          />
        </div>
      )}
    </div>
  );
};

const Timeline = ({ 
  project, 
  currentTime, 
  zoom, 
  selectedClip, 
  onSeek, 
  onSelectClip, 
  onUpdateClip,
  onRemoveClip 
}) => {
  const timelineRef = useRef(null);
  
  const handleTimelineClick = (e) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x / rect.width) * project.duration;
      onSeek(time);
    }
  };

  return (
    <div className="timeline">
      <div className="timeline-header">
        <h3>Timeline</h3>
        <div className="timeline-controls">
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>
      </div>
      
      <div 
        className="timeline-container"
        ref={timelineRef}
        onClick={handleTimelineClick}
      >
        {/* Ruler */}
        <div className="timeline-ruler">
          {Array.from({ length: Math.ceil(project.duration) + 1 }, (_, i) => (
            <div key={i} className="ruler-mark" style={{ left: `${(i / project.duration) * 100}%` }}>
              {i}s
            </div>
          ))}
        </div>
        
        {/* Playhead */}
        <div 
          className="timeline-playhead"
          style={{ left: `${(currentTime / project.duration) * 100}%` }}
        />
        
        {/* Tracks */}
        <div className="timeline-tracks">
          {/* Video Track */}
          <div className="timeline-track video-track">
            <div className="track-label">Video</div>
            <div className="track-content">
              {project.clips
                .filter(clip => clip.type === 'video')
                .map(clip => (
                  <div
                    key={clip.id}
                    className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''}`}
                    style={{
                      left: `${(clip.startTime / project.duration) * 100}%`,
                      width: `${(clip.duration / project.duration) * 100}%`
                    }}
                    onClick={() => onSelectClip(clip)}
                  >
                    <div className="clip-content">
                      {clip.metadata?.isAI && <Sparkles size={12} />}
                      <span>Video {clip.id}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          
          {/* Audio Track */}
          <div className="timeline-track audio-track">
            <div className="track-label">Audio</div>
            <div className="track-content">
              {project.clips
                .filter(clip => clip.type === 'audio')
                .map(clip => (
                  <div
                    key={clip.id}
                    className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''}`}
                    style={{
                      left: `${(clip.startTime / project.duration) * 100}%`,
                      width: `${(clip.duration / project.duration) * 100}%`
                    }}
                    onClick={() => onSelectClip(clip)}
                  >
                    <div className="clip-content">
                      <Music size={12} />
                      <span>{clip.metadata?.title || 'Audio'}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          
          {/* Text Track */}
          <div className="timeline-track text-track">
            <div className="track-label">Text</div>
            <div className="track-content">
              {project.clips
                .filter(clip => clip.type === 'text')
                .map(clip => (
                  <div
                    key={clip.id}
                    className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''}`}
                    style={{
                      left: `${(clip.startTime / project.duration) * 100}%`,
                      width: `${(clip.duration / project.duration) * 100}%`
                    }}
                    onClick={() => onSelectClip(clip)}
                  >
                    <div className="clip-content">
                      <Type size={12} />
                      <span>{clip.content.substring(0, 10)}...</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoEditor; 
 