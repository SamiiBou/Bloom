import { useState, useEffect } from 'react';

// Fonction utilitaire pour gérer le localStorage
const getMaintenanceStatus = () => {
  try {
    const status = localStorage.getItem('maintenanceMode');
    // Par défaut, le mode maintenance est DÉSACTIVÉ pour le développement
    // Changez `false` en `true` pour activer par défaut en production
    return status === null ? false : status === 'true';
  } catch (error) {
    console.error('Error reading maintenance status from localStorage:', error);
    return false; // Mode développement - désactiver la maintenance par défaut
  }
};

const setMaintenanceStatus = (isActive) => {
  try {
    localStorage.setItem('maintenanceMode', isActive.toString());
  } catch (error) {
    console.error('Error saving maintenance status to localStorage:', error);
  }
};

const useMaintenanceMode = () => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(() => getMaintenanceStatus());

  // Fonction pour activer le mode maintenance
  const enableMaintenance = () => {
    setIsMaintenanceMode(true);
    setMaintenanceStatus(true);
    console.log('🚧 Mode maintenance activé');
  };

  // Fonction pour désactiver le mode maintenance
  const disableMaintenance = () => {
    setIsMaintenanceMode(false);
    setMaintenanceStatus(false);
    console.log('✅ Mode maintenance désactivé');
  };

  // Fonction pour basculer le mode maintenance
  const toggleMaintenance = () => {
    const newStatus = !isMaintenanceMode;
    setIsMaintenanceMode(newStatus);
    setMaintenanceStatus(newStatus);
    console.log(`${newStatus ? '🚧' : '✅'} Mode maintenance ${newStatus ? 'activé' : 'désactivé'}`);
  };

  // Écouter les changements du localStorage (pour synchroniser entre les onglets)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'maintenanceMode') {
        const newStatus = e.newValue === 'true';
        setIsMaintenanceMode(newStatus);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Fonction utilitaire pour réinitialiser complètement l'état
  const resetMaintenanceMode = () => {
    try {
      localStorage.removeItem('maintenanceMode');
      setIsMaintenanceMode(true); // Retour à l'état par défaut
      console.log('🔄 État de maintenance réinitialisé');
    } catch (error) {
      console.error('Error resetting maintenance mode:', error);
    }
  };

  // Raccourci clavier global pour les développeurs (Ctrl+Alt+M)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.altKey && e.key === 'm') {
        e.preventDefault();
        toggleMaintenance();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaintenanceMode]);

  return {
    isMaintenanceMode,
    enableMaintenance,
    disableMaintenance,
    toggleMaintenance,
    resetMaintenanceMode
  };
};

export default useMaintenanceMode; 