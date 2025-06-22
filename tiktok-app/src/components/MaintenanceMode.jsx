import React, { useState, useEffect } from 'react';
import bloomLogo from '../assets/Bloom_LOGO2.jpg';
import './MaintenanceMode.css';

const MaintenanceMode = () => {
  const [dots, setDots] = useState('');

  // Animation des points
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Fonction pour désactiver le mode maintenance (pour les développeurs)
  const handleDisableMaintenance = () => {
    if (window.confirm('Êtes-vous sûr de vouloir désactiver le mode maintenance ?')) {
      localStorage.setItem('maintenanceMode', 'false');
      window.location.reload();
    }
  };

  // Raccourci clavier pour les développeurs (Ctrl+Shift+M)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        handleDisableMaintenance();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="maintenance-mode">
      <div className="maintenance-container">
        {/* Logo */}
        <div className="maintenance-logo">
          <img src={bloomLogo} alt="Bloom" />
        </div>

        {/* Message principal */}
        <div className="maintenance-content">
          <h1>Maintenance en cours{dots}</h1>
          <p>We'll be back quickly!</p>
          <p className="maintenance-subtitle">
            Nous améliorons votre expérience Bloom
          </p>
        </div>

        {/* Animation de chargement */}
        <div className="maintenance-loader">
          <div className="loader-bar">
            <div className="loader-progress"></div>
          </div>
        </div>

        {/* Message de statut */}
        <div className="maintenance-status">
          <p>Merci pour votre patience</p>
          <p className="maintenance-time">Temps estimé : quelques minutes</p>
        </div>

        {/* Bouton caché pour les développeurs */}
        <button 
          className="dev-exit-btn"
          onClick={handleDisableMaintenance}
          title="Ctrl+Shift+M pour sortir du mode maintenance"
        >
          DEV: Exit Maintenance
        </button>
      </div>
    </div>
  );
};

export default MaintenanceMode; 