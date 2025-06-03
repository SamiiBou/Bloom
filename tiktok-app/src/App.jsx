import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
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
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home'); // Start on home page
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
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
    <AuthProvider>
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
            <BottomNavigation
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
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
            <BottomNavigation
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          </>
        )}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      </div>
    </AuthProvider>
  );
}

export default App;