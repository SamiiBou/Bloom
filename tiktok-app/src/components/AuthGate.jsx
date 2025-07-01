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
      console.log('🔑 [AuthGate] === LOAD USER PROFILE START ===');
      console.log('🔑 [AuthGate] isAuthenticated:', isAuthenticated);
      console.log('🔑 [AuthGate] user present:', !!user);
      console.log('🔑 [AuthGate] userProfile present:', !!userProfile);
      console.log('🔑 [AuthGate] profileLoading:', profileLoading);
      
      if (isAuthenticated && user && !userProfile && !profileLoading) {
        console.log('✅ [AuthGate] Conditions met, loading profile...');
        setProfileLoading(true);
        
        // Debug localStorage tokens
        console.log('🔍 [AuthGate] Checking localStorage tokens:');
        console.log('  - authToken:', localStorage.getItem('authToken') ? 'EXISTS' : 'MISSING');
        console.log('  - token:', localStorage.getItem('token') ? 'EXISTS' : 'MISSING');
        console.log('  - auth_token:', localStorage.getItem('auth_token') ? 'EXISTS' : 'MISSING');
        
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          console.log('🔍 [AuthGate] authToken length:', authToken.length);
          console.log('🔍 [AuthGate] authToken preview:', authToken.substring(0, 20) + '...');
        }
        
        try {
          console.log('📡 [AuthGate] Calling apiService.getUserProfile()...');
          // Charger le profil utilisateur complet pour vérifier humanVerified
          const response = await apiService.getUserProfile();
          console.log('📡 [AuthGate] Profile response status:', response?.status);
          console.log('📡 [AuthGate] Profile response data:', response?.data);
          
          if (response.status === 'success') {
            const profile = response.data?.user || response.data;
            setUserProfile(profile);
            console.log('✅ [AuthGate] Profile loaded successfully:', profile);
          } else {
            console.log('❌ [AuthGate] Profile response not successful:', response);
          }
        } catch (error) {
          console.error('❌ [AuthGate] Error loading user profile:', error);
          console.error('❌ [AuthGate] Error details:');
          console.error('  - message:', error.message);
          console.error('  - status:', error.response?.status);
          console.error('  - statusText:', error.response?.statusText);
          console.error('  - data:', error.response?.data);
          console.error('  - headers:', error.response?.headers);
          console.error('  - config url:', error.config?.url);
          console.error('  - config headers:', error.config?.headers);
          
          // If 401, check token validity
          if (error.response?.status === 401) {
            console.log('🔒 [AuthGate] 401 Unauthorized - checking token validity...');
            const currentToken = localStorage.getItem('authToken');
            console.log('🔒 [AuthGate] Current token in localStorage:', currentToken ? 'EXISTS' : 'MISSING');
            
            if (currentToken) {
              console.log('🔒 [AuthGate] Token length:', currentToken.length);
              console.log('🔒 [AuthGate] Token starts with:', currentToken.substring(0, 10));
              
              // Try to decode JWT payload (just for debugging, not for security)
              try {
                const payload = JSON.parse(atob(currentToken.split('.')[1]));
                console.log('🔒 [AuthGate] Token payload:', payload);
                console.log('🔒 [AuthGate] Token exp:', payload.exp);
                console.log('🔒 [AuthGate] Current time:', Math.floor(Date.now() / 1000));
                console.log('🔒 [AuthGate] Token expired:', payload.exp < Math.floor(Date.now() / 1000));
              } catch (decodeError) {
                console.log('🔒 [AuthGate] Could not decode token payload:', decodeError.message);
              }
            }
          }
        } finally {
          setProfileLoading(false);
          console.log('🔑 [AuthGate] Profile loading finished');
        }
      } else {
        console.log('⏭️ [AuthGate] Conditions not met, skipping profile load');
        if (!isAuthenticated) console.log('  - Not authenticated');
        if (!user) console.log('  - No user');
        if (userProfile) console.log('  - Profile already loaded');
        if (profileLoading) console.log('  - Already loading');
      }
      console.log('🔑 [AuthGate] === LOAD USER PROFILE END ===');
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