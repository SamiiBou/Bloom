import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import VideoFeed from './components/VideoFeed';
import VideoCatalog from './components/VideoCatalog';
import ImageFeed from './components/ImageFeed';
import Sidebar from './components/Sidebar';
import BottomNavigation from './components/BottomNavigation';
import Header from './components/Header';
import ConnectionTest from './components/ConnectionTest';
import WalletAuth from './components/WalletAuth';
import AuthGate from './components/AuthGate';
import Profile from './components/Profile';
import RewardsHub from './components/RewardsHub';
import FluxImageGenerator from './components/FluxImageGenerator';
import MaintenanceMode from './components/MaintenanceMode';
import useMaintenanceMode from './hooks/useMaintenanceMode';
import './utils/maintenanceControl'; // Import pour rendre MaintenanceControl disponible globalement
import './App.css';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('images'); // Start on images page instead of videos
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const { isMaintenanceMode } = useMaintenanceMode();
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Si le mode maintenance est activé, afficher uniquement la fenêtre de maintenance
  if (isMaintenanceMode) {
    return <MaintenanceMode />;
  }
  
  const renderMainContent = () => {
    switch (currentPage) {
      case 'home':
        return <VideoFeed feedType="forYou" />;
      case 'videos':
        return <VideoCatalog />; // UTILISE LA VERSION ORIGINALE CORRIGÉE
      case 'images':
        return <ImageFeed />;
      case 'following':
        return <VideoFeed feedType="following" />;
      case 'discover':
        return <div className="page-placeholder">Discover</div>;
      case 'create':
        return <div className="page-placeholder">Create</div>;
      case 'flux':
        return <FluxImageGenerator />;
      case 'inbox':
        return <div className="page-placeholder">Inbox</div>;
      case 'profile':
        return <Profile />;
      case 'test':
        return <ConnectionTest />;
      case 'auth':
        return <WalletAuth />;
      case 'rewards':
        return <RewardsHub />;
      default:
        return <VideoFeed feedType="forYou" />;
    }
  };
  
  // Pour les pages qui ne sont pas des vidéos, on garde la structure normale
  const isVideoPage = currentPage === 'home' || currentPage === 'following';
  
  // MODIFIÉ - Ajout de 'flux' et 'images' dans les pages sans header (staking caché)
  const showHeader = isVideoPage || (
    currentPage !== 'profile' && 
    currentPage !== 'test' && 
    currentPage !== 'auth' && 
    currentPage !== 'rewards' && 
    currentPage !== 'videos' && 
    currentPage !== 'images' && 
    currentPage !== 'flux'  // AJOUTÉ
    // && currentPage !== 'staking'  // CACHÉ - staking retiré temporairement
  );
  
  return (
    <div className={`app ${isVideoPage ? 'video-page' : ''}`}>
      {isVideoPage ? (
        // Structure spéciale pour les pages vidéo - plein écran
        <>
          <AuthGate>
            {renderMainContent()}
          </AuthGate>
          {/* Navigation en overlay pour les vidéos */}
          <Header
            onMenuClick={() => setIsSidebarOpen(true)}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
          {/* Afficher la BottomNavigation seulement si l'utilisateur est authentifié */}
          {isAuthenticated && (
            <BottomNavigation
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}
        </>
      ) : (
        // Structure normale pour les autres pages
        <>
          {showHeader && (
            <Header
              onMenuClick={() => setIsSidebarOpen(true)}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}
          <main className="app-main">
            <AuthGate>
              {renderMainContent()}
            </AuthGate>
          </main>
          {/* Afficher la BottomNavigation seulement si l'utilisateur est authentifié */}
          {isAuthenticated && (
            <BottomNavigation
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;