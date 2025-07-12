import React, { useState } from 'react';
import { MiniKit, verifySiweMessage, getIsUserVerified } from '@worldcoin/minikit-js';
import './WalletAuth.css';

const WalletAuth = ({ onAuthSuccess, onAuthError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  // Function to retrieve MiniKit user information
  const getMiniKitUserData = async (walletAddress) => {
    console.log('🔍 Retrieving MiniKit user data...');
    
    try {
      // Retrieve user information via MiniKit
      const minikitUser = await MiniKit.getUserByAddress(walletAddress);
      console.log('👤 MiniKit user data retrieved:', minikitUser);

      const userInfo = await MiniKit.getUserInfo(walletAddress);
      console.log('👤 users info are :', userInfo);

      const verified = await getIsUserVerified(walletAddress);
      console.log('👤 is verified :', verified);

      
      if (minikitUser || userInfo) {
        // Use available data in priority order
        const sourceData = userInfo || minikitUser;
        
        const userData = {
          username: sourceData.username || null,
          userId: sourceData.id || sourceData.userId || null,
          profilePicture: sourceData.profilePictureUrl || sourceData.profilePicture || sourceData.avatar || null,
          verificationLevel: verified ? 'orb' : 'unverified', // Use retrieved verification
          nullifierHash: sourceData.nullifierHash || null,
          // Add other fields if available
          displayName: sourceData.displayName || sourceData.username || null,
          bio: sourceData.bio || null,
          isVerified: verified || false, // Use retrieved verification
          walletAddress: walletAddress,
        };
        
        console.log('📋 Formatted user data:', userData);
        
        // Log information retrieved on frontend side
        console.log('📊 USER INFORMATION RETRIEVED (FRONTEND):');
        console.log('- Username:', userData.username);
        console.log('- User ID:', userData.userId);
        console.log('- Profile Picture:', userData.profilePicture);
        console.log('- Verification Level:', userData.verificationLevel);
        console.log('- Display Name:', userData.displayName);
        console.log('- Bio:', userData.bio);
        console.log('- Is Verified:', userData.isVerified);
        console.log('- Nullifier Hash:', userData.nullifierHash);
        console.log('- Wallet Address:', userData.walletAddress);
        
        return userData;
      } else {
        console.log('⚠️ No MiniKit user data found');
        return null;
      }
    } catch (error) {
      console.error('❌ Error retrieving MiniKit data:', error);
      return null;
    }
  };

  // Backend connectivity test function
  const testBackendConnection = async () => {
    try {
      console.log('🔍 Testing backend connectivity...');
      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'https://bloom-m284.onrender.com/api';
      console.log('Backend URL:', backendUrl);
      
      // Test health endpoint
      const healthResponse = await fetch(`${backendUrl}/health`);
      console.log('✅ Health check status:', healthResponse.status);
      const healthData = await healthResponse.json();
      console.log('✅ Health check data:', healthData);
      
      // Test nonce endpoint
      const nonceResponse = await fetch(`${backendUrl}/wallet/nonce`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ Nonce endpoint status:', nonceResponse.status);
      console.log('✅ Nonce response headers:', Object.fromEntries(nonceResponse.headers.entries()));
      const nonceData = await nonceResponse.json();
      console.log('✅ Nonce endpoint data:', nonceData);
      
      alert('✅ Backend accessible! Check console for details.');
      
    } catch (error) {
      console.error('❌ Connectivity test failed:', error);
      alert(`❌ Backend inaccessible: ${error.message}`);
    }
  };

  // Enhanced debug function
  const showDebugInfo = () => {
    const debug = {
      // MiniKit info
      miniKitInstalled: MiniKit.isInstalled(),
      windowMiniKit: !!window.MiniKit,
      walletAddress: MiniKit.walletAddress || 'N/A',
      username: MiniKit.user?.username || 'N/A',
      
      // Environment info
      backendUrl: import.meta.env.VITE_API_BASE_URL || 'https://bloom-m284.onrender.com/api',
      worldcoinAppId: import.meta.env.VITE_REACT_APP_WORLDCOIN_APP_ID,
      
      // Browser info
      userAgent: navigator.userAgent,
      isWebView: /wv|WebView/i.test(navigator.userAgent),
      isMobile: /Mobi|Android|iPhone/i.test(navigator.userAgent),
      windowWidth: window.innerWidth,
      currentUrl: window.location.href,
      
      // Global World App info
      worldApp: !!window.WorldApp,
      minikit: !!window.minikit,
      worldcoin: !!window.worldcoin,
      
      // Cookies info
      cookiesEnabled: navigator.cookieEnabled,
      document_cookie: document.cookie,
      
      timestamp: new Date().toISOString()
    };
    
    setDebugInfo(debug);
    console.log('🔍 Complete debug info:', debug);
  };

  const signInWithWallet = async () => {
    console.log('🔍 Checking MiniKit...');
    console.log('MiniKit.isInstalled():', MiniKit.isInstalled());
    
    if (!MiniKit.isInstalled()) {
      console.log('❌ MiniKit not installed');
      showDebugInfo(); // Automatically show debug info
      setError('World App not detected. Check debug info below.');
      return;
    }

    console.log('✅ MiniKit detected, starting authentication');
    setIsLoading(true);
    setError(null);

    try {
      // 1. Get a nonce from backend
      console.log('📡 Retrieving nonce...');
      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'https://bloom-m284.onrender.com/api';
      console.log('Backend URL:', backendUrl);
      
      let nonceResponse;
      try {
        nonceResponse = await fetch(`${backendUrl}/wallet/nonce`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        console.log('📡 Nonce response status:', nonceResponse.status);
        console.log('📡 Nonce response headers:', Object.fromEntries(nonceResponse.headers.entries()));
        
      } catch (fetchError) {
        console.error('❌ Nonce fetch error:', fetchError);
        throw new Error(`Network error while retrieving nonce: ${fetchError.message}`);
      }
      
      if (!nonceResponse.ok) {
        const errorText = await nonceResponse.text();
        console.error('❌ Non-OK nonce response:', errorText);
        throw new Error(`Server error (${nonceResponse.status}): ${errorText}`);
      }
      
      const nonceData = await nonceResponse.json();
      console.log('📡 Complete nonce data:', nonceData);
      
      const { nonce } = nonceData;
      if (!nonce) {
        throw new Error('Missing nonce in server response');
      }
      
      console.log('✅ Nonce received:', nonce);

      // 2. Trigger wallet authentication with MiniKit
      console.log('🔑 Launching MiniKit authentication...');
      
      const authParams = {
        nonce: nonce,
        requestId: crypto.randomUUID(),
        expirationTime: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        notBefore: new Date(new Date().getTime() - 24 * 60 * 60 * 1000), // 1 day ago
        statement: 'Sign in to TikTok Clone with your Ethereum wallet',
      };
      
      console.log('🔑 Authentication parameters:', authParams);
      
      const authResult = await MiniKit.commandsAsync.walletAuth(authParams);
      
      console.log('📝 Raw authentication result:', authResult);
      
      // Extract final payload
      const finalPayload = authResult.finalPayload || authResult.commandPayload || authResult;
      console.log('📝 Extracted final payload:', finalPayload);

      if (finalPayload.status === 'error') {
        throw new Error(finalPayload.error || 'MiniKit authentication failed');
      }

      // Check that we have the necessary data
      if (!finalPayload.signature || !finalPayload.address) {
        console.error('❌ Missing data in payload:', finalPayload);
        throw new Error('Incomplete authentication data');
      }

      // 3. Retrieve MiniKit user information
      console.log('👤 Retrieving MiniKit user information...');
      const minikitUserData = await getMiniKitUserData(finalPayload.address);

      // 4. Verify signature on backend with MiniKit data
      console.log('🔍 Verifying signature...');
      
      const verifyPayload = {
        payload: finalPayload,
        nonce: nonce,
        minikitUserData: minikitUserData, // Add MiniKit data
      };
      
      console.log('📤 Sending for verification:', verifyPayload);
      
      const verifyResponse = await fetch(`${backendUrl}/wallet/complete-siwe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(verifyPayload),
      });

      console.log('📡 Verification response status:', verifyResponse.status);
      console.log('📡 Verification response headers:', Object.fromEntries(verifyResponse.headers.entries()));

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error('❌ Verification error (text):', errorText);
        throw new Error(`Signature verification failed (${verifyResponse.status}): ${errorText}`);
      }

      const verifyResult = await verifyResponse.json();
      console.log('✅ Verification result:', verifyResult);

      if (verifyResult.isValid) {
        // Extract token from the response
         const token =
               verifyResult.token ||               
               verifyResult.data?.token ||         
               verifyResult.data?.accessToken

        console.log('🔑 JWT token received:', token);       

        if (token) {
        localStorage.setItem('authToken', token);        
      }       
        
        const userData = {
          id: verifyResult.data.user.id,
          walletAddress: finalPayload.address,
          username: verifyResult.data.user.username,
          displayName: verifyResult.data.user.displayName,
          avatar: verifyResult.data.user.avatar,
          verified: verifyResult.data.user.verified,
          authMethod: verifyResult.data.user.authMethod,
          minikitProfile: verifyResult.data.user.minikitProfile,
          signature: finalPayload.signature
        };
        
        console.log('🎉 Authentication successful:', userData);
        console.log('🔑 JWT token received:', token);
        
        // Store JWT token for API authentication
        if (token) {
          localStorage.setItem('authToken', token);
          // Update apiService token
          const apiService = (await import('../services/api')).default;
          apiService.setToken(token);
          console.log('✅ JWT token stored and configured in apiService');
        } else {
          console.warn('⚠️ No JWT token received from backend');
        }
        
        // Log information stored on frontend side
        console.log('📊 USER INFORMATION STORED (FRONTEND):');
        console.log('- ID:', userData.id);
        console.log('- Username:', userData.username);
        console.log('- Display Name:', userData.displayName);
        console.log('- Wallet Address:', userData.walletAddress);
        console.log('- Avatar:', userData.avatar);
        console.log('- Verified:', userData.verified);
        console.log('- Auth Method:', userData.authMethod);
        console.log('- MiniKit Profile:', userData.minikitProfile);
        
        // Store in localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('walletAddress', userData.walletAddress);
        localStorage.setItem('username', userData.username);
        localStorage.setItem('isAuthenticated', 'true');
        
        setUser(userData);
        onAuthSuccess?.(userData);
      } else {
        throw new Error(verifyResult.message || 'Invalid signature');
      }

    } catch (err) {
      console.error('❌ Wallet authentication error (details):', err);
      console.error('❌ Error name:', err.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      
      let errorMessage = 'Unknown error';
      if (err.message) {
        errorMessage = err.message;
      } else if (err.name) {
        errorMessage = `Error ${err.name}`;
      }
      
      setError(errorMessage);
      onAuthError?.(err);
      
      // Automatically show debug info on error
      showDebugInfo();
      
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    setUser(null);
    setDebugInfo(null);
    setError(null);
    
    // Clean localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('username');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('authToken');
    
    // Clear token from apiService
    import('../services/api').then(({ default: apiService }) => {
      apiService.setToken(null);
      console.log('✅ JWT token removed from apiService');
    });
  };

  if (user) {
    return (
      <div className="wallet-auth-success">
        <div className="user-info">
          <div className="wallet-avatar">
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            ) : (
              user.username ? user.username[0].toUpperCase() : '👤'
            )}
          </div>
          <div className="user-details">
            <p className="username">{user.displayName || user.username || 'Anonymous'}</p>
            <p className="wallet-address">
              {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
            </p>
            {user.verified && <span className="verified-badge">✓ Verified</span>}
          </div>
        </div>
        <button onClick={signOut} className="sign-out-btn">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-auth">
      <div className="wallet-auth-content">
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <button 
          onClick={signInWithWallet} 
          disabled={isLoading}
          className="wallet-connect-btn"
        >
          {isLoading ? (
            <>
              <span className="loading-spinner"></span>
              Connecting...
            </>
          ) : (
            'Sign in with World'
          )}
        </button>
      </div>
    </div>
  );
};

export default WalletAuth;
