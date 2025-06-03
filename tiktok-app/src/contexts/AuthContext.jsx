import React, { createContext, useContext, useState, useEffect } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Initialiser MiniKit avec l'App ID
    const initializeMiniKit = () => {
      try {
        // Vérifier si l'utilisateur est déjà connecté
        if (MiniKit.isInstalled() && MiniKit.walletAddress) {
          const userData = {
            walletAddress: MiniKit.walletAddress,
            username: MiniKit.user?.username
          };
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error initializing MiniKit:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Attendre que MiniKit soit disponible
    if (typeof window !== 'undefined') {
      if (window.MiniKit) {
        initializeMiniKit();
      } else {
        // Attendre que MiniKit soit chargé
        const checkMiniKit = setInterval(() => {
          if (window.MiniKit) {
            initializeMiniKit();
            clearInterval(checkMiniKit);
          }
        }, 100);

        // Nettoyer l'intervalle après 5 secondes
        setTimeout(() => {
          clearInterval(checkMiniKit);
          setIsLoading(false);
        }, 5000);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    
    // Optionnel : sauvegarder dans localStorage pour persister la session
    try {
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error saving user to localStorage:', error);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    
    // Nettoyer localStorage
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      
      // Clear token from apiService
      import('../services/api').then(({ default: apiService }) => {
        apiService.setToken(null);
        console.log('✅ Token JWT supprimé de apiService lors du logout');
      });
    } catch (error) {
      console.error('Error removing user from localStorage:', error);
    }
  };

  // Vérifier localStorage au chargement pour restaurer la session
  useEffect(() => {
    console.log('🔐 [AuthContext] Checking localStorage for saved session...');
    console.log('🔐 [AuthContext] isAuthenticated:', isAuthenticated);
    console.log('🔐 [AuthContext] isLoading:', isLoading);
    
    if (!isAuthenticated && !isLoading) {
      try {
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('authToken');
        
        console.log('🔐 [AuthContext] savedUser:', savedUser ? 'present' : 'null');
        console.log('🔐 [AuthContext] savedToken:', savedToken ? 'present' : 'null');
        
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          console.log('🔐 [AuthContext] Parsed user data:', userData);
          
          // Vérifier que les données sont valides
          if (userData.walletAddress) {
            console.log('🔐 [AuthContext] Valid user data found, logging in...');
            setUser(userData);
            setIsAuthenticated(true);
            
            // Restore JWT token if available
            if (savedToken) {
              console.log('🔐 [AuthContext] Restoring JWT token...');
              import('../services/api').then(({ default: apiService }) => {
                apiService.setToken(savedToken);
                console.log('✅ [AuthContext] Token JWT restauré dans apiService');
                console.log('🔑 [AuthContext] Token preview:', savedToken.substring(0, 20) + '...');
              });
            } else {
              console.warn('⚠️ [AuthContext] User found but no JWT token saved');
            }
          } else {
            console.warn('⚠️ [AuthContext] Invalid user data - missing walletAddress');
          }
        } else {
          console.log('ℹ️ [AuthContext] No saved user found in localStorage');
        }
      } catch (error) {
        console.error('❌ [AuthContext] Error restoring user from localStorage:', error);
        localStorage.removeItem('user'); // Nettoyer les données corrompues
        localStorage.removeItem('authToken'); // Nettoyer aussi le token
      }
    } else {
      console.log('🔐 [AuthContext] Skipping localStorage check (already authenticated or still loading)');
    }
  }, [isAuthenticated, isLoading]);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    // Fonctions utilitaires
    isWorldAppUser: () => MiniKit.isInstalled(),
    getShortAddress: (address) => {
      if (!address) return '';
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};