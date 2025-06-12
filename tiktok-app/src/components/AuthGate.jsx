import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import WalletAuth from './WalletAuth';
import HumanVerificationModal from './HumanVerificationModal';
import apiService from '../services/api';
import bloomLogo from '../assets/Bloom_LOGO2.jpg';
import './AuthGate.css';

// 🚧 DÉVELOPPEMENT : Force l'affichage de la page de connexion
const FORCE_SHOW_LOGIN_FOR_DEV = false;

const AuthGate = ({ children }) => {
  const { isAuthenticated, isLoading, login, user } = useAuth();
  const [showHumanVerification, setShowHumanVerification] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Charger le profil utilisateur après l'authentification pour vérifier le statut humain
  useEffect(() => {
    const loadUserProfile = async () => {
      if (isAuthenticated && user && !userProfile && !profileLoading) {
        setProfileLoading(true);
        try {
          // Charger le profil utilisateur complet pour vérifier humanVerified
          const response = await apiService.getUserProfile();
          if (response.status === 'success') {
            const profile = response.data?.user || response.data;
            setUserProfile(profile);
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        } finally {
          setProfileLoading(false);
        }
      }
    };

    loadUserProfile();
  }, [isAuthenticated, user, userProfile, profileLoading]);

  const handleHumanVerificationSuccess = (verificationData) => {
    console.log('🎉 Human verification successful:', verificationData);
    
    // Marquer que l'utilisateur a vu la modal de vérification
    localStorage.setItem('hasSeenHumanVerification', 'true');
    
    // Mettre à jour le profil utilisateur local
    if (userProfile) {
      setUserProfile({
        ...userProfile,
        humanVerified: true,
        humanVerifiedAt: verificationData.verifiedAt,
        grabBalance: verificationData.newBalance
      });
    }

    // Fermer la modal
    setShowHumanVerification(false);

    // Afficher une notification de succès (optionnel)
    // Vous pouvez implémenter un système de notifications ici
    console.log('🪙 Bonus tokens received:', verificationData.tokensBonus);
  };

  const handleCloseHumanVerification = () => {
    // Marquer que l'utilisateur a vu la modal (même s'il l'a fermée)
    localStorage.setItem('hasSeenHumanVerification', 'true');
    setShowHumanVerification(false);
  };

  // Déterminer si on doit afficher la modal (mode debug désactivé)
  const shouldShowHumanVerification = () => {
    // Mode debug : désactivé maintenant
    const DEBUG_MODE = false;
    
    if (DEBUG_MODE) {
      console.log('🚧 DEBUG MODE: Human verification modal will always show');
      return true;
    }
    
    // Mode normal : afficher seulement si pas vérifié
    const hasSeenVerificationModal = localStorage.getItem('hasSeenHumanVerification');
    return userProfile && !userProfile.humanVerified && !hasSeenVerificationModal;
  };

  // Afficher la modal si nécessaire
  useEffect(() => {
    if (isAuthenticated && !profileLoading && userProfile) {
      if (shouldShowHumanVerification()) {
        // Délai pour laisser l'interface se charger
        setTimeout(() => {
          setShowHumanVerification(true);
        }, 1000);
      }
    }
  }, [isAuthenticated, profileLoading, userProfile]);

  // Show loader during authentication verification
  if (isLoading) {
    return (
      <div className="auth-gate-loading">
        <div className="loading-spinner-large"></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  // 🚧 DÉVELOPPEMENT : Force l'affichage de la page de sign in - Design minimaliste Apple
  if (FORCE_SHOW_LOGIN_FOR_DEV || !isAuthenticated) {
    return (
      <div className="auth-gate-minimal">
        <div className="auth-gate-container">
          {/* Logo central */}
          <div className="logo-container">
            <img src={bloomLogo} alt="Bloom" className="bloom-logo" />
          </div>
          
          {/* Composant d'authentification */}
          <div className="auth-component">
            <WalletAuth 
              onAuthSuccess={(userData) => {
                login(userData);
              }}
              onAuthError={(error) => {
                console.error('Auth error:', error);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // If user is authenticated, show application content with optional human verification modal
  return (
    <>
      {children}
      <HumanVerificationModal 
        isOpen={showHumanVerification}
        onClose={handleCloseHumanVerification}
        onVerificationSuccess={handleHumanVerificationSuccess}
      />
    </>
  );
};

export default AuthGate;