import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import axios from "axios";
import { ethers, BrowserProvider, Contract, formatUnits } from 'ethers';
import { MiniKit, ResponseEvent } from "@worldcoin/minikit-js";
import distributorAbi from '../abi/Distributor.json';
import permit2Abi from '../abi/Permit2.json';
import { encodeVoucher } from '../utils/encodeVoucher';
import BloomLogo from '../assets/Bloom_LOGO.jpg';
import { FaTelegramPlane } from 'react-icons/fa';

import './Profile.css';
import './VideoCatalog.css'; // Pour les styles de la modal vidéo
import { 
  RefreshCw, 
  Play, 
  Trash2, 
  Eye, 
  Heart, 
  Calendar,
  Coins,
  MessageSquare,
  Film,
  AlertTriangle,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';

// Token configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://bloom-m284.onrender.com/api';
const BACKEND_URL = API_BASE_URL;
const API_TIMEOUT = 15000;
const TOKEN_CONTRACT_ADDRESS = '0x8b2D045381c7B9E09dC72fc3DDEbC1c74724E78D';
const PERMIT2_CONTRACT_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const Profile = () => {
  const { user, isAuthenticated, getShortAddress } = useAuth();
  const [userVideos, setUserVideos] = useState([]);
  const [userImages, setUserImages] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [videosError, setVideosError] = useState('');
  const [imagesError, setImagesError] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [contentType, setContentType] = useState('videos'); // 'videos' or 'images'
  const [videoTypeFilter, setVideoTypeFilter] = useState('all');
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  
  // Ajout des états pour la modal vidéo
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Token states (from RewardsHub)
  const [walletBalance, setWalletBalance] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [username, setUsername] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [canClaim, setCanClaim] = useState(true);
  const [grabBalance, setGrabBalance] = useState(0);
  const [videosWatched, setVideosWatched] = useState(0);
  const [tokensEarnedFromVideos, setTokensEarnedFromVideos] = useState(0);

  // Credit purchase states
  const [credits, setCredits] = useState(0);
  const [creditPurchaseLoading, setCreditPurchaseLoading] = useState(false);
  const [creditAmountToBuy, setCreditAmountToBuy] = useState(35); // Default 35 credits (1 WLD)
  const [showQuickPurchase, setShowQuickPurchase] = useState(false); // To show/hide quick purchase interface

  // Ajout d'un state pour l'adresse de paiement
  const [paymentAddress, setPaymentAddress] = useState('');

  // Setup MiniKit event handlers (from RewardsHub)
  useEffect(() => {
    if (!MiniKit.isInstalled()) return;

    const unsubscribe = MiniKit.subscribe(
      ResponseEvent.MiniAppSendTransaction,
      async (payload) => {
        console.log('[MiniKit Event] Transaction response:', payload);
        
        if (payload.status === "success") {
          console.log('[MiniKit Event] Transaction successful:', payload.transaction_id);
        } else {
          console.log('[MiniKit Event] Transaction failed or rejected:', payload);
          setNotification({ 
            show: true, 
            message: "Transaction cancelled or failed", 
            type: "error" 
          });
          setIsLoading(false);
        }
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Load user data on component mount (from RewardsHub)
  useEffect(() => {
    // Retrieve JWT token from localStorage
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('auth_token'); 
    if (storedToken) {
      setToken(storedToken);
      console.log('[Profile] Token found:', storedToken.substring(0, 10) + '...');
    }
    
    // Retrieve user ID from localStorage
    const storedUserId = localStorage.getItem('userId') || localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    }
    
    // Retrieve username from localStorage
    const storedUsername = localStorage.getItem('username') || localStorage.getItem('user_username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
    
    // Retrieve wallet address from localStorage
    const storedWalletAddress = localStorage.getItem('walletAddress');
    if (storedWalletAddress) {
      setWalletAddress(storedWalletAddress);
      console.log('[Profile] Wallet address found:', storedWalletAddress);
    }
  }, []);

  // Auto-refresh when token becomes available (from RewardsHub)
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('🔄 [Profile] Authenticated and token available, auto-refreshing status...');
      checkClaimStatus();
      loadUserCredits();
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    loadUserVideos();
    loadUserImages();
  }, [user]);

  // Récupérer l'adresse de paiement depuis le backend au montage
  useEffect(() => {
    async function fetchPaymentAddress() {
      console.log('💰 [PROFILE PAYMENT ADDRESS] =================================');
      console.log('💰 [PROFILE PAYMENT ADDRESS] STARTING FETCH PAYMENT ADDRESS');
      console.log('💰 [PROFILE PAYMENT ADDRESS] Backend URL:', BACKEND_URL);
      
      try {
        const paymentUrl = `${BACKEND_URL}/users/payment/address`;
        console.log('💰 [PROFILE PAYMENT ADDRESS] 🔗 URL:', paymentUrl);
        console.log('💰 [PROFILE PAYMENT ADDRESS] 🔑 Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
        
        const res = await axios.get(paymentUrl, {
          withCredentials: true,
          headers: token ? {
            Authorization: `Bearer ${token}`,
          } : {},
          timeout: API_TIMEOUT,
        });

        console.log('💰 [PROFILE PAYMENT ADDRESS] 📨 Response status:', res.status);
        console.log('💰 [PROFILE PAYMENT ADDRESS] 📨 Response data:', res.data);
        
        if (res.data.address) {
          setPaymentAddress(res.data.address);
          console.log('💰 [PROFILE PAYMENT ADDRESS] ✅ Payment address fetched successfully:', res.data.address);
        } else {
          console.error('💰 [PROFILE PAYMENT ADDRESS] ❌ No payment address in response');
          
          // NOUVEAU: Essayer l'endpoint alternatif comme fallback
          try {
            console.log('💰 [PROFILE PAYMENT ADDRESS] 🔄 Trying alternative endpoint...');
            const alternativeUrl = `${BACKEND_URL}/payment/address`;
            console.log('💰 [PROFILE PAYMENT ADDRESS] 🔗 Alternative URL:', alternativeUrl);
            
            const res2 = await axios.get(alternativeUrl);
            console.log('💰 [PROFILE PAYMENT ADDRESS] 📨 Alternative response:', res2.data);
            
            if (res2.data.paymentAddress) {
              setPaymentAddress(res2.data.paymentAddress);
              console.log('💰 [PROFILE PAYMENT ADDRESS] ✅ Alternative address fetched:', res2.data.paymentAddress);
            } else {
              console.error('💰 [PROFILE PAYMENT ADDRESS] ❌ No payment address in alternative response');
              setPaymentAddress('');
            }
          } catch (e2) {
            console.error('💰 [PROFILE PAYMENT ADDRESS] ❌ Alternative endpoint failed:', e2);
            setPaymentAddress('');
          }
        }
      } catch (e) {
        console.error('💰 [PROFILE PAYMENT ADDRESS] ❌ Main endpoint failed:', e);
        console.error('💰 [PROFILE PAYMENT ADDRESS] ❌ Error details:', {
          message: e.message,
          status: e.response?.status,
          data: e.response?.data,
          url: e.config?.url
        });
        
        // NOUVEAU: Essayer l'endpoint alternatif comme fallback
        try {
          console.log('💰 [PROFILE PAYMENT ADDRESS] 🔄 Trying alternative endpoint after main failure...');
          const alternativeUrl = `${BACKEND_URL}/payment/address`;
          console.log('💰 [PROFILE PAYMENT ADDRESS] 🔗 Alternative URL:', alternativeUrl);
          
          const res2 = await axios.get(alternativeUrl);
          console.log('💰 [PROFILE PAYMENT ADDRESS] 📨 Alternative response:', res2.data);
          
          if (res2.data.paymentAddress) {
            setPaymentAddress(res2.data.paymentAddress);
            console.log('💰 [PROFILE PAYMENT ADDRESS] ✅ Alternative address fetched after failure:', res2.data.paymentAddress);
          } else {
            console.error('💰 [PROFILE PAYMENT ADDRESS] ❌ No payment address in alternative response');
            setPaymentAddress('');
          }
        } catch (e2) {
          console.error('💰 [PROFILE PAYMENT ADDRESS] ❌ All endpoints failed:', e2);
          setPaymentAddress('');
        }
      } finally {
        console.log('💰 [PROFILE PAYMENT ADDRESS] 🏁 Fetch payment address ended');
      }
    }
    fetchPaymentAddress();
  }, [token]); // Ajouter token comme dépendance

  // Function to claim tokens (from RewardsHub)
  const claimTokens = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setNotification({ show: true, message: "Preparing claim…", type: "info" });

    try {
      const storedWalletAddress = localStorage.getItem("walletAddress");
      if (!storedWalletAddress) {
        setNotification({ show: true, message: "Connect wallet first", type: "error" });
        setIsLoading(false);
        return;
      }
      if (!MiniKit.isInstalled()) {
        setNotification({ show: true, message: "World App / MiniKit not detected", type: "error" });
        setIsLoading(false);
        return;
      }

      console.log('[CLAIM] Requesting voucher from backend...');
      
      let voucherResponse;
      try {
        voucherResponse = await axios.post(
          `${BACKEND_URL}/airdrop/request`,
          {},
          {
            withCredentials: true,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            timeout: API_TIMEOUT,
          }
        );
      } catch (axiosError) {
        if (axiosError.response?.status === 400) {
          const errorData = axiosError.response.data;
          console.log('[CLAIM] Error from server:', errorData);
          throw new Error(errorData?.error || 'Claim request failed');
        }
        throw axiosError;
      }

      if (voucherResponse.status !== 200 || !voucherResponse.data?.voucher) {
        const errorData = voucherResponse.data;
        throw new Error(errorData?.error || 'Failed to get voucher');
      }

      const { voucher, signature, claimedAmount } = voucherResponse.data;
      console.log('[CLAIM] Voucher received:', { voucher, signature, claimedAmount });

      let voucherArgs;
      try {
        voucherArgs = encodeVoucher(voucher);
        console.log('[CLAIM] Voucher encoded:', voucherArgs);
      } catch (err) {
        throw new Error(`Voucher encoding failed: ${err.message}`);
      }

      setNotification({ show: true, message: "Sending transaction...", type: "info" });
      
      console.log('[CLAIM] Sending transaction via MiniKit...');
      const transactionResponse = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: "0xD32E3A5d27241Fd13141caf48c4b43F833aAFcBd",
            abi: distributorAbi,
            functionName: "claim",
            args: [voucherArgs, signature],
          },
        ],
      });

      console.log('[CLAIM] MiniKit transaction response:', transactionResponse);

      if (transactionResponse.finalPayload?.status === "error") {
        await axios.post(
          `${BACKEND_URL}/airdrop/cancel`,
          { nonce: voucher.nonce },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        throw new Error(transactionResponse.finalPayload.message || "Transaction rejected");
      }

      if (!transactionResponse.finalPayload?.transaction_id) {
        await axios.post(
          `${BACKEND_URL}/airdrop/cancel`,
          { nonce: voucher.nonce },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        throw new Error("No transaction ID received");
      }

      const txId = transactionResponse.finalPayload.transaction_id;
      console.log('[CLAIM] Confirming transaction with backend:', txId);
      
      setNotification({ show: true, message: "Confirming transaction...", type: "info" });

      let attempts = 0;
      const maxAttempts = 8;
      
      for (;;) {
        attempts += 1;
        console.log(`[CLAIM] Confirmation attempt ${attempts}/${maxAttempts}`);
        
        const confirmResponse = await axios.post(
          `${BACKEND_URL}/airdrop/confirm`,
          { nonce: voucher.nonce, transaction_id: txId },
          { 
            headers: { Authorization: `Bearer ${token}` },
            validateStatus: () => true 
          }
        );

        console.log('[CLAIM] Confirm response:', confirmResponse.status, confirmResponse.data);

        if (confirmResponse.status === 200 && confirmResponse.data.ok) {
          console.log('[CLAIM] Transaction confirmed successfully!');
          break;
        }

        if (confirmResponse.status === 202 && confirmResponse.data.status === "pending") {
          console.log(`[CLAIM] Still pending, retrying in 5s (attempt ${attempts})`);
          if (attempts >= maxAttempts) {
            console.log('[CLAIM] Max attempts reached, but transaction likely succeeded');
            break;
          }
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        if (confirmResponse.status === 404 && confirmResponse.data?.error?.includes("No matching pending claim")) {
          console.log('[CLAIM] No matching pending claim - transaction may have already been processed');
          break;
        }
        
        throw new Error(confirmResponse.data?.error || `Confirmation failed (status ${confirmResponse.status})`);
      }

      setNotification({
        show: true,
        message: `✅ ${claimedAmount} BLOOM claimed successfully!`,
        type: "success",
      });
      
      console.log('[CLAIM] 🔄 Refreshing backend data after successful claim...');
      setTimeout(() => {
        checkClaimStatus();
      }, 1000);
      
      setTimeout(async () => {
        const onChain = await fetchTokenBalance();
        if (onChain !== null) setWalletBalance(onChain);
      }, 6000);

    } catch (err) {
      console.error('[CLAIM] Error:', err);
      setNotification({ 
        show: true, 
        message: err.message || "Claim failed", 
        type: "error" 
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 5000);
    }
  };

  // Function to buy credits
  const buyCredits = async () => {
    console.log('🏪 [PROFILE CREDIT PURCHASE] =================================');
    console.log('🏪 [PROFILE CREDIT PURCHASE] STARTING CREDIT PURCHASE FLOW');
    console.log('🏪 [PROFILE CREDIT PURCHASE] Timestamp:', new Date().toISOString());
    console.log('🏪 [PROFILE CREDIT PURCHASE] Credit amount:', creditAmountToBuy);
    console.log('🏪 [PROFILE CREDIT PURCHASE] Backend URL:', BACKEND_URL);
    console.log('🏪 [PROFILE CREDIT PURCHASE] API_BASE_URL:', API_BASE_URL);
    console.log('🏪 [PROFILE CREDIT PURCHASE] Payment address:', paymentAddress);
    console.log('🏪 [PROFILE CREDIT PURCHASE] Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
    console.log('🏪 [PROFILE CREDIT PURCHASE] =================================');
    
    if (creditPurchaseLoading || !creditAmountToBuy || creditAmountToBuy <= 0) {
      console.log('🏪 [PROFILE CREDIT PURCHASE] ❌ Precondition failed:', {
        creditPurchaseLoading,
        creditAmountToBuy,
        isValid: creditAmountToBuy > 0
      });
      return;
    }
    
    setCreditPurchaseLoading(true);
    setNotification({ show: true, message: "Initiating credit purchase...", type: "info" });

    try {
      if (!MiniKit.isInstalled()) {
        console.error('🏪 [PROFILE CREDIT PURCHASE] ❌ MiniKit not installed');
        setNotification({ show: true, message: "World App / MiniKit not detected", type: "error" });
        setCreditPurchaseLoading(false);
        return;
      }

      // NOUVEAU: Vérifier que l'adresse de paiement est disponible
      if (!paymentAddress || paymentAddress.trim() === '') {
        console.error('🏪 [PROFILE CREDIT PURCHASE] ❌ No payment address available:', paymentAddress);
        setNotification({ show: true, message: "Payment address not available. Please try again.", type: "error" });
        setCreditPurchaseLoading(false);
        return;
      }

      console.log('🏪 [PROFILE CREDIT PURCHASE] ✅ Payment address available:', paymentAddress);
      console.log('🏪 [PROFILE CREDIT PURCHASE] 📡 Initiating purchase with backend...');
      
      const initiateUrl = `${BACKEND_URL}/users/initiate-credit-purchase`;
      console.log('🏪 [PROFILE CREDIT PURCHASE] 🔗 Initiate URL:', initiateUrl);
      
      const initResponse = await axios.post(
        initiateUrl,
        { creditAmount: creditAmountToBuy },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          timeout: API_TIMEOUT,
        }
      );

      console.log('🏪 [PROFILE CREDIT PURCHASE] 📨 Initiate response status:', initResponse.status);
      console.log('🏪 [PROFILE CREDIT PURCHASE] 📨 Initiate response data:', initResponse.data);

      if (initResponse.status !== 200 || !initResponse.data?.reference) {
        throw new Error(initResponse.data?.error || 'Failed to initiate purchase');
      }

      const { reference, wldPrice } = initResponse.data;
      console.log('🏪 [PROFILE CREDIT PURCHASE] ✅ Purchase initiated successfully:', { reference, wldPrice, creditAmountToBuy });

      // Prepare payload for World Pay
      const payload = {
        reference: reference,
        to: paymentAddress, // Adresse dynamique reçue du back
        tokens: [
          {
            symbol: 'WLD',
            token_amount: (wldPrice * Math.pow(10, 18)).toString(),
          }
        ],
        description: `Purchase ${creditAmountToBuy} credits for ${wldPrice} WLD`,
      };

      console.log('🏪 [PROFILE CREDIT PURCHASE] 💰 Payment payload prepared:', payload);
      console.log('🏪 [PROFILE CREDIT PURCHASE] 🔍 Payment address check:', { 
        paymentAddress, 
        isEmpty: !paymentAddress || paymentAddress.trim() === '',
        length: paymentAddress?.length 
      });

      setNotification({ show: true, message: "Confirming payment...", type: "info" });
      
      console.log('🏪 [PROFILE CREDIT PURCHASE] 📱 Sending payment via MiniKit...');
      const { finalPayload } = await MiniKit.commandsAsync.pay(payload);

      console.log('🏪 [PROFILE CREDIT PURCHASE] 📱 MiniKit response received:', finalPayload);

      if (finalPayload.status === 'success') {
        console.log('🏪 [PROFILE CREDIT PURCHASE] ✅ Payment successful! Transaction ID:', finalPayload.transaction_id);
        
        const confirmUrl = `${BACKEND_URL}/users/confirm-credit-purchase`;
        console.log('🏪 [PROFILE CREDIT PURCHASE] 🔗 Confirm URL:', confirmUrl);
        
        // Confirm purchase with backend
        const confirmResponse = await axios.post(
          confirmUrl,
          {
            reference: reference,
            transaction_id: finalPayload.transaction_id
          },
          {
            withCredentials: true,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            timeout: API_TIMEOUT,
          }
        );

        console.log('🏪 [PROFILE CREDIT PURCHASE] 📨 Confirm response status:', confirmResponse.status);
        console.log('🏪 [PROFILE CREDIT PURCHASE] 📨 Confirm response data:', confirmResponse.data);

        if (confirmResponse.data.success) {
          setCredits(confirmResponse.data.credits);
          setNotification({ 
            show: true, 
            message: `Successfully purchased ${confirmResponse.data.purchasedAmount} credits!`, 
            type: "success" 
          });
          setCreditAmountToBuy(35); // Reset to default
          setShowQuickPurchase(false); // Close quick purchase interface
          console.log('🏪 [PROFILE CREDIT PURCHASE] ✅ Purchase completed successfully!');
        } else {
          throw new Error('Purchase confirmation failed');
        }
      } else {
        console.log('🏪 [PROFILE CREDIT PURCHASE] ❌ Payment failed or cancelled:', finalPayload);
        
        let errorMessage = "Payment cancelled or failed";
        if (finalPayload.error_code === 'user_rejected') {
          errorMessage = "Payment cancelled by user";
        } else if (finalPayload.error_code === 'transaction_failed') {
          errorMessage = "Transaction failed. Please check your wallet balance and try again.";
        }
        
        setNotification({ 
          show: true, 
          message: errorMessage, 
          type: "error" 
        });
      }
    } catch (error) {
      console.error('🏪 [PROFILE CREDIT PURCHASE] ❌ CRITICAL ERROR:', error);
      console.error('🏪 [PROFILE CREDIT PURCHASE] ❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // Gestion spéciale pour l'erreur 429 (Too Many Requests)
      if (error.response?.status === 429) {
        setNotification({ 
          show: true, 
          message: "⏰ Too many attempts. Please wait 2-3 minutes before trying again to avoid rate limiting.", 
          type: "error" 
        });
      } else {
        setNotification({ 
          show: true, 
          message: error.response?.data?.error || error.message || "Credit purchase failed", 
          type: "error" 
        });
      }
    } finally {
      setCreditPurchaseLoading(false);
      console.log('🏪 [PROFILE CREDIT PURCHASE] 🏁 Purchase flow ended');
    }
  };

  // Check if user can claim (depuis RewardsHub)
  const checkClaimStatus = async () => {
    console.log('🎯 [Profile] checkClaimStatus called');
    
    if (token) {
      try {
        console.log('🎯 [Profile] Making request to /airdrop/status...');
        const statusResponse = await axios.get(
          `${BACKEND_URL}/airdrop/status`,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
          }
        );

        console.log('🎯 [Profile] Status response:', statusResponse.data);

        if (statusResponse.data) {
          const { 
            canClaim: serverCanClaim, 
            hasPending, 
            grabBalance: userGrabBalance,
            videosWatched: userVideosWatched,
            tokensEarnedFromVideos: userTokensEarned
          } = statusResponse.data;
          
          setCanClaim(serverCanClaim);
          setGrabBalance(userGrabBalance || 0);
          setVideosWatched(userVideosWatched || 0);
          setTokensEarnedFromVideos(userTokensEarned || 0);
          
          if (hasPending) {
            console.log('[Profile] Transaction pending, claim disabled temporarily');
          }
        }
      } catch (error) {
        console.error('🎯 [Profile] Failed to check server status:', error);
        setCanClaim(true);
      }
    } else {
      setCanClaim(true);
    }
  };

  // Fetch token balance (depuis RewardsHub)
  const fetchTokenBalance = async (address = walletAddress) => {
    try {
      if (!address) return null;

      try {
        const apiRes = await axios.get(
          `${API_BASE_URL}/users/token-balance/${address}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        );

        if (apiRes?.data?.status === 'success') {
          return parseFloat(apiRes.data.data.balance);
        }
      } catch (apiErr) {
        console.log('API balance fetch failed, trying on-chain...', apiErr.message);
      }

      const injected = window?.MiniKit?.ethereum || window.ethereum;
      const provider = injected
        ? new BrowserProvider(injected)
        : ethers.getDefaultProvider();

      const contract = new Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);

      const [rawBalance, decimals] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals()
      ]);

      return parseFloat(formatUnits(rawBalance, decimals));
    } catch (err) {
      console.error('❌ Error fetching token balance:', err);
      return null;
    }
  };

  // Fetch balance on wallet address change (depuis RewardsHub)
  useEffect(() => {
    (async () => {
      if (!walletAddress) return;
      const chainBal = await fetchTokenBalance(walletAddress);
      if (chainBal !== null) setWalletBalance(chainBal);
    })();
  }, [walletAddress]);

  // Function to refresh token balance manually (depuis RewardsHub)
  const refreshTokenBalance = async () => {
    setNotification({
      show: true,
      message: "Refreshing balance...",
      type: 'info'
    });
    
    const bal = await fetchTokenBalance();
    if (bal !== null) {
      setWalletBalance(bal);
      setNotification({ show: true, message: `Balance updated: ${bal.toFixed(2)} BLOOM`, type: 'success' });
    } else {
      setNotification({ show: true, message: 'Failed to refresh balance', type: 'error' });
    }
    
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'info' });
    }, 3000);
  };

  const loadUserVideos = async () => {
    try {
      setVideosLoading(true);
      setVideosError('');
      
      const response = await apiService.getUserVideos(user.username);
      
      if (response.status === 'success') {
        const videos = response.data.videos || [];
        setUserVideos(videos);
        
        console.log('=== VIDÉOS CHARGÉES ===');
        console.log(`Nombre de vidéos: ${videos.length}`);
        videos.forEach((video, index) => {
          console.log(`Vidéo ${index + 1}:`, {
            id: video._id,
            description: video.description,
            videoUrl: video.videoUrl,
            thumbnailUrl: video.thumbnailUrl,
            createdAt: video.createdAt,
            type: video.type,
            duration: video.duration
          });
        });
        console.log('========================');
      } else {
        setVideosError('Erreur lors du chargement des vidéos');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des vidéos:', error);
      setVideosError(error.message || 'Erreur lors du chargement des vidéos');
    } finally {
      setVideosLoading(false);
    }
  };

  const loadUserImages = async () => {
    try {
      if (!user?.username) {
        console.log('❌ No username available for images:', user);
        return;
      }
      
      setImagesLoading(true);
      setImagesError('');
      
      console.log('🖼️ Loading images for username:', user.username);
      console.log('🖼️ User object:', user);
      
      // Essayons d'abord avec l'ID si disponible, sinon avec le username
      let response;
      if (user._id) {
        console.log('🖼️ Trying with user ID:', user._id);
        try {
          response = await apiService.getUserImages(user._id, { page: 1, limit: 50 });
        } catch (error) {
          console.log('🖼️ ID failed, trying with username:', error.message);
          response = await apiService.getUserImagesByUsername(user.username, { page: 1, limit: 50 });
        }
      } else {
        // Fallback: utiliser le username
        console.log('🖼️ No ID available, using username');
        response = await apiService.getUserImagesByUsername(user.username, { page: 1, limit: 50 });
      }
      
      console.log('🖼️ Images API response:', response);
      
      if (response.status === 'success') {
        const images = response.data.images || [];
        setUserImages(images);
        
        console.log('=== IMAGES LOADED ===');
        console.log(`Number of images: ${images.length}`);
        if (images.length === 0) {
          console.log('ℹ️ No images found for this user');
        } else {
          images.forEach((image, index) => {
            console.log(`Image ${index + 1}:`, {
              id: image._id,
              title: image.title,
              description: image.description,
              imageUrl: image.imageUrl,
              createdAt: image.createdAt,
              likesCount: image.likesCount
            });
          });
        }
        console.log('========================');
      } else {
        console.log('❌ Images API error response:', response);
        setImagesError('Erreur lors du chargement des images: ' + (response.message || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des images:', error);
      setImagesError(error.message || 'Erreur lors du chargement des images');
    } finally {
      setImagesLoading(false);
    }
  };

  const deleteVideo = async (videoId) => {
    console.log('🗑️ deleteVideo called with videoId:', videoId);
    
    if (deleteConfirmation !== videoId) {
      console.log('🤔 First deletion request, requesting confirmation...');
      setDeleteConfirmation(videoId);
      setTimeout(() => {
        setDeleteConfirmation(null);
      }, 5000);
      return;
    }

    console.log('✅ User confirmation received, starting deletion...');
    setDeleteConfirmation(null);

    try {
      console.log('📡 Calling API deleteVideo...');
      const response = await apiService.deleteVideo(videoId);
      console.log('📡 API response received:', response);
      
      if (response.status === 'success') {
        setUserVideos(prev => prev.filter(video => video._id !== videoId));
        console.log('✅ Video deleted successfully from local list');
      } else {
        throw new Error(response.message || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('❌ Video deletion error:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const getFilteredVideos = () => {
    switch (videoTypeFilter) {
      case 'short':
        return userVideos.filter(video => video.type === 'short' || (video.duration && video.duration <= 60));
      case 'long':
        return userVideos.filter(video => video.type === 'long' || (video.duration && video.duration > 60));
      default:
        return userVideos;
    }
  };

  const filteredVideos = getFilteredVideos();
  const shortVideos = userVideos.filter(video => video.type === 'short' || (video.duration && video.duration <= 60));
  const longVideos = userVideos.filter(video => video.type === 'long' || (video.duration && video.duration > 60));

  if (!isAuthenticated || !user) {
    return (
      <div className="profile-container-new">
        <div className="profile-error-new">
          <h2>Non connected</h2>
          <p>Please connect to see your profile.</p>
        </div>
      </div>
    );
  }

  const savedUserData = JSON.parse(localStorage.getItem('user') || '{}');
  const allUserData = { ...user, ...savedUserData };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non available';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getVerificationBadge = (level) => {
    switch (level) {
      case 'orb':
        return { text: 'Verified Orb', class: 'verified-orb', icon: '🔮' };
      case 'device':
        return { text: 'Verified Device', class: 'verified-device', icon: '📱' };
      default:
        return { text: 'Unverified', class: 'unverified', icon: '❌' };
    }
  };

  const verification = getVerificationBadge(allUserData.verificationLevel);

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isVideoFile = (url) => /\.(mp4|mov|webm)$/i.test(url || '');

  // Composant VideoCard rectangulaire - design épuré
  const VideoCardRectangular = ({ video }) => {
    const { thumbnailUrl, videoUrl, description, viewsCount, likesCount, duration, createdAt } = video;
    const [generatedThumbnail, setGeneratedThumbnail] = useState(null);
    const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
    const [thumbnailError, setThumbnailError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const videoRef = useRef(null);
    
    const handleDeleteClick = (e) => {
      e.stopPropagation();
      deleteVideo(video._id);
    };

    const handleVideoClick = () => {
      // Ouvrir la modal de lecture vidéo
      openVideoPlayer(video);
    };

    // Fonction améliorée pour générer une miniature à partir de la vidéo
    const generateThumbnailFromVideo = async (videoSrc) => {
      if (isGeneratingThumbnail || generatedThumbnail || thumbnailError) return;
      
      console.log('🎬 Generating thumbnail for:', videoSrc);
      setIsGeneratingThumbnail(true);
      setThumbnailError(false);
      
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log('⏰ Thumbnail generation timeout');
            video.src = '';
            setThumbnailError(true);
            setIsGeneratingThumbnail(false);
            reject(new Error('Timeout'));
          }, 15000);

          video.onloadedmetadata = () => {
            console.log('📹 Video metadata loaded, duration:', video.duration);
            if (video.duration > 0) {
              const seekTime = Math.min(2, video.duration * 0.2);
              video.currentTime = seekTime;
            } else {
              video.currentTime = 0.1;
            }
          };
          
          video.onseeked = () => {
            console.log('🎯 Video position reached, generating canvas...');
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              // Ratio 9:16 for vertical design
              const targetWidth = 360;
              const targetHeight = 640;
              
              canvas.width = targetWidth;
              canvas.height = targetHeight;
              
              // Default black background
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Calculate dimensions to maintain ratio
              const videoRatio = video.videoWidth / video.videoHeight;
              const targetRatio = targetWidth / targetHeight;
              
              let drawWidth, drawHeight, offsetX, offsetY;
              
              if (videoRatio > targetRatio) {
                // Video wider - adjust by height
                drawHeight = targetHeight;
                drawWidth = drawHeight * videoRatio;
                offsetX = (targetWidth - drawWidth) / 2;
                offsetY = 0;
              } else {
                // Video taller - adjust by width
                drawWidth = targetWidth;
                drawHeight = drawWidth / videoRatio;
                offsetX = 0;
                offsetY = (targetHeight - drawHeight) / 2;
              }
              
              try {
                ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
                console.log('✅ Image drawn on canvas');
              } catch (drawError) {
                console.log('❌ Canvas drawing error:', drawError);
                // Create elegant fallback thumbnail
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, '#1a1a1a');
                gradient.addColorStop(1, '#000000');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Add play icon to center
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const size = 60;
                ctx.moveTo(centerX - size/2, centerY - size/2);
                ctx.lineTo(centerX - size/2, centerY + size/2);
                ctx.lineTo(centerX + size/2, centerY);
                ctx.closePath();
                ctx.fill();
              }
              
              canvas.toBlob((blob) => {
                clearTimeout(timeout);
                if (blob) {
                  const thumbnailUrl = URL.createObjectURL(blob);
                  console.log('🖼️ Thumbnail generated successfully');
                  setGeneratedThumbnail(thumbnailUrl);
                  setIsGeneratingThumbnail(false);
                  resolve(thumbnailUrl);
                } else {
                  console.log('❌ Thumbnail generation failed');
                  setThumbnailError(true);
                  setIsGeneratingThumbnail(false);
                  reject(new Error('Failed to generate thumbnail blob'));
                }
                video.src = '';
                video.remove();
              }, 'image/jpeg', 0.85);
            } catch (error) {
              clearTimeout(timeout);
              console.log('❌ Canvas error:', error);
              setThumbnailError(true);
              setIsGeneratingThumbnail(false);
              reject(error);
            }
          };
          
          video.onerror = (e) => {
            clearTimeout(timeout);
            console.log('❌ Video loading error:', e);
            setThumbnailError(true);
            setIsGeneratingThumbnail(false);
            reject(new Error('Video load error'));
          };

          video.src = videoSrc;
          video.load();
        });
      } catch (error) {
        console.log('❌ General thumbnail generation error:', error);
        setThumbnailError(true);
        setIsGeneratingThumbnail(false);
      }
    };

    // Effect to trigger thumbnail generation
    useEffect(() => {
      if (!thumbnailUrl && videoUrl && !generatedThumbnail && !isGeneratingThumbnail && !thumbnailError) {
        console.log('🎬 Triggering thumbnail generation for:', video._id);
        const timer = setTimeout(() => {
          generateThumbnailFromVideo(videoUrl);
        }, 100 + Math.random() * 500);

        return () => clearTimeout(timer);
      }
    }, [thumbnailUrl, videoUrl, generatedThumbnail, isGeneratingThumbnail, thumbnailError]);

    // Clean up blob URLs
    useEffect(() => {
      return () => {
        if (generatedThumbnail && generatedThumbnail.startsWith('blob:')) {
          URL.revokeObjectURL(generatedThumbnail);
        }
      };
    }, [generatedThumbnail]);

    const getBestThumbnail = () => {
      if (thumbnailUrl && !thumbnailUrl.includes('undefined')) return thumbnailUrl;
      if (generatedThumbnail) return generatedThumbnail;
      return null;
    };

    const bestThumbnail = getBestThumbnail();

    return (
      <div className="video-card-rectangular" onClick={handleVideoClick}>
        <div className="video-thumbnail-container">
          <div className="video-thumbnail-wrapper" style={{position: 'relative', width: '100%', height: '100%'}}>
            <video
              src={videoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', background: '#222', pointerEvents: 'none' }}
              muted
              playsInline
              preload="metadata"
              controls={false}
              onLoadedMetadata={e => { try { e.target.currentTime = 1; } catch {} }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'white', fontSize: 32, pointerEvents: 'none' }}>
              <svg width="48" height="48" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="28" fill="rgba(0,0,0,0.5)" />
                <polygon points="25,20 45,30 25,40" fill="#fff" />
              </svg>
            </span>
          </div>
          
          <div className="video-overlay">
            <Play size={24} className="play-icon" />
            {duration && (
              <span className="video-duration">{formatDuration(duration)}</span>
            )}
          </div>
        </div>
        
        <div className="video-info">
          <p className="video-description">
            {description ? (description.length > 80 ? description.substring(0, 80) + '...' : description) : 'No description'}
          </p>
          
          <div className="video-stats">
            <div className="stat">
              <Eye size={14} />
              <span>{viewsCount || 0}</span>
            </div>
            <div className="stat">
              <Heart size={14} />
              <span>{likesCount || 0}</span>
            </div>
            <div className="stat">
              <Calendar size={14} />
              <span>{new Date(createdAt).toLocaleDateString('en-US')}</span>
            </div>
          </div>
        </div>
        
        <button 
          className={`delete-btn ${deleteConfirmation === video._id ? 'confirm' : ''}`}
          onClick={handleDeleteClick}
          title={deleteConfirmation === video._id ? 'Click again to confirm' : 'Delete video'}
        >
          {deleteConfirmation === video._id ? (
            <>
              <AlertTriangle size={16} />
              <span>Confirm</span>
            </>
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>
    );
  };

  // Composant ImageCard pour afficher les images
  const ImageCard = ({ image }) => {
    const { imageUrl, title, description, likesCount, createdAt, metadata } = image;
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    const handleDeleteClick = (e) => {
      e.stopPropagation();
      // TODO: Implémenter la suppression d'image
      console.log('Suppression image:', image._id);
    };

    const handleImageClick = () => {
      // TODO: Ouvrir l'image en plein écran ou rediriger vers la page de détails
      console.log('Image clicked:', image._id);
    };

    return (
      <div className="image-card-rectangular" onClick={handleImageClick}>
        <div className="image-thumbnail-container">
          <div className="image-thumbnail-wrapper">
            {!imageError ? (
              <img 
                src={imageUrl} 
                alt={title || 'Image'} 
                className={`image-thumbnail ${imageLoaded ? 'loaded' : ''}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  console.log('❌ Image loading error');
                  setImageError(true);
                }}
              />
            ) : (
              <div className="image-placeholder">
                <ImageIcon size={32} />
                <span>Image loading error</span>
              </div>
            )}
          </div>
          
          {/* AI Badge if image is generated by AI */}
          {metadata?.aiGenerated && (
            <div className="ai-badge-overlay">
              <Sparkles size={12} />
              <span>AI</span>
            </div>
          )}
        </div>
        
        <div className="image-info">
          <p className="image-title">
            {title && title.trim() ? (title.length > 60 ? title.substring(0, 60) + '...' : title) : 'No title'}
          </p>
          
          {description && description.trim() && (
            <p className="image-description">
              {description.length > 80 ? description.substring(0, 80) + '...' : description}
            </p>
          )}
          
          <div className="image-stats">
            <div className="stat">
              <Heart size={14} />
              <span>{likesCount || 0}</span>
            </div>
            <div className="stat">
              <Calendar size={14} />
              <span>{new Date(createdAt).toLocaleDateString('en-US')}</span>
            </div>
          </div>
        </div>
        
        <button 
          className={`delete-btn ${deleteConfirmation === image._id ? 'confirm' : ''}`}
          onClick={handleDeleteClick}
          title={deleteConfirmation === image._id ? 'Click again to confirm' : 'Delete image'}
        >
          {deleteConfirmation === image._id ? (
            <>
              <AlertTriangle size={16} />
              <span>Confirm</span>
            </>
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>
    );
  };

  // Fonction pour charger les crédits de l'utilisateur
  const loadUserCredits = async () => {
    console.log('🔄 [PROFILE FETCH CREDITS] =================================');
    console.log('🔄 [PROFILE FETCH CREDITS] STARTING FETCH CREDITS');
    console.log('🔄 [PROFILE FETCH CREDITS] Backend URL:', BACKEND_URL);
    console.log('🔄 [PROFILE FETCH CREDITS] Token available:', !!token);
    
    try {
      if (!token) {
        console.log('🔄 [PROFILE FETCH CREDITS] ❌ No token available');
        return;
      }
      
      const creditsUrl = `${BACKEND_URL}/users/credits`;
      console.log('🔄 [PROFILE FETCH CREDITS] 🔗 URL:', creditsUrl);
      console.log('🔄 [PROFILE FETCH CREDITS] 🔑 Token (first 20 chars):', token.substring(0, 20) + '...');
      
      const response = await axios.get(
        creditsUrl,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      console.log('🔄 [PROFILE FETCH CREDITS] 📨 Response status:', response.status);
      console.log('🔄 [PROFILE FETCH CREDITS] 📨 Response data:', response.data);

      if (response.data && response.data.data) {
        const creditsValue = response.data.data.credits || 0;
        setCredits(creditsValue);
        console.log('🔄 [PROFILE FETCH CREDITS] ✅ Credits loaded successfully:', creditsValue);
      } else if (response.data && typeof response.data.credits !== 'undefined') {
        // Nouveau format de réponse
        const creditsValue = response.data.credits || 0;
        setCredits(creditsValue);
        console.log('🔄 [PROFILE FETCH CREDITS] ✅ Credits loaded (new format):', creditsValue);
      } else {
        console.error('🔄 [PROFILE FETCH CREDITS] ❌ Unexpected response format:', response.data);
      }
    } catch (error) {
      console.error('🔄 [PROFILE FETCH CREDITS] ❌ Error:', error);
      console.error('🔄 [PROFILE FETCH CREDITS] ❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
    } finally {
      console.log('🔄 [PROFILE FETCH CREDITS] 🏁 Fetch credits ended');
    }
  };

  // Fonctions pour la modal vidéo
  const openVideoPlayer = (video) => {
    setSelectedVideo(video);
  };

  const closeVideoPlayer = () => {
    setSelectedVideo(null);
  };

  // Format functions (copiées depuis VideoCatalog)
  const formatCategory = (category) => {
    const categoryNames = {
      'education': 'Education',
      'entertainment': 'Entertainment',
      'music': 'Music',
      'gaming': 'Gaming',
      'sports': 'Sports',
      'technology': 'Technology',
      'lifestyle': 'Lifestyle',
      'travel': 'Travel',
      'food': 'Food',
      'fashion': 'Fashion',
      'news': 'News',
      'comedy': 'Comedy',
      'art': 'Art',
      'science': 'Science',
      'health': 'Health',
      'business': 'Business',
      'other': 'Other'
    };
    return categoryNames[category] || category;
  };

  useEffect(() => {
    const handleFocus = () => {
      if (isAuthenticated && token) {
        loadUserCredits();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const interval = setInterval(() => {
      loadUserCredits();
    }, 20000); // 20 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, token]);

  // Fonction pour ouvrir le groupe Telegram
  const openTelegramGroup = () => {
    window.open('https://t.me/+X5ymk_jSYKk0Mjdk', '_blank');
  };

  return (
    <div className="profile-container-new">
      {/* Header premium with balance */}
      <div className="profile-header-premium">
        <div className="header-left">
          <img src={BloomLogo} alt="Logo Bloom" style={{ height: 50, maxWidth: 140, width: 'auto', objectFit: 'contain', display: 'block' }} />
        </div>
        <div className="header-balances">
          <div className="credits-balance-header">
            <div className="balance-display-profile credits-display">
              <div className="balance-text-profile">
                <Sparkles size={16} className="credits-icon" />
                <span className="balance-value-profile">
                  {credits} credits
                </span>
                <button className="refresh-btn-profile" onClick={loadUserCredits} title="Rafraîchir les crédits">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="token-balance-header">
            <div className="balance-display-profile">
              <div className="balance-text-profile">
                <Coins size={16} className="balance-icon" />
                <span className="balance-value-profile">
                  {walletBalance !== null ? `${walletBalance.toFixed(2)} BLOOM` : 'Loading...'}
                </span>
              </div>
              <button className="refresh-btn-profile" onClick={refreshTokenBalance} title="Refresh balance">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section bouton Telegram sous le header */}
      <div className="telegram-section">
        <div className="social-btn telegram-btn" onClick={openTelegramGroup}>
          <FaTelegramPlane size={18} />
          <span>Join Us</span>
        </div>
      </div>

      {/* Main profile section */}
      <div className="profile-hero-section">
        {/* Profile avatar centrally */}
        <div className="profile-avatar-container">
          {allUserData.avatar || allUserData.profilePictureUrl ? (
            <img 
              src={allUserData.avatar || allUserData.profilePictureUrl} 
              alt="Avatar" 
              className="profile-avatar-new"
            />
          ) : (
            <div className="profile-avatar-placeholder-new">
              {(allUserData.username || allUserData.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* User information */}
        <div className="profile-info-new">
          <h1 className="profile-name-new">
            {allUserData.displayName || allUserData.username || 'Emily Carter'}
          </h1>
          
          {allUserData.bio && (
            <p className="profile-bio-new">{allUserData.bio}</p>
          )}
          
          {/* Social statistics */}
          <div className="profile-stats-horizontal">
            <div className="stat-item-horizontal">
              <span className="stat-number-horizontal">{userVideos.length || 0}</span>
              <span className="stat-label-horizontal">videos</span>
            </div>
            <div className="stat-item-horizontal">
              <span className="stat-number-horizontal">{userImages.length || 0}</span>
              <span className="stat-label-horizontal">images</span>
            </div>
            <div className="stat-item-horizontal">
              <span className="stat-number-horizontal">{userVideos.reduce((total, video) => total + (video.likesCount || 0), 0) + userImages.reduce((total, image) => total + (image.likesCount || 0), 0)}</span>
              <span className="stat-label-horizontal">likes</span>
            </div>
          </div>

          {/* Grab Tokens button */}
          <button
            className={`grab-button-profile ${!canClaim || grabBalance <= 0 ? 'disabled' : ''}`}
            disabled={isLoading || !canClaim || grabBalance <= 0}
            onClick={claimTokens}
          >
            {isLoading ? (
              'Processing...'
            ) : grabBalance <= 0 ? (
              'Watch videos to earn'
            ) : !canClaim ? (
              'Transaction pending...'
            ) : (
              `Claim ${grabBalance.toFixed(2)} BLOOM`
            )}
          </button>

          {/* Reward reminder message - Original text restored, countdown display COMMENTED OUT */}
          <div className="reward-reminder-message">
            <Coins size={14} className="reminder-icon" />
            {/* <span>{countdown}</span> */}
            <span>Come back after every 3 hours to receive 1 Bloom</span> { /* Restored original text */}
          </div>

          {/* Quick credit purchase section */}
          <div className="quick-purchase-section">
            <button 
              className="quick-purchase-trigger"
              onClick={() => setShowQuickPurchase(true)}
            >
              <Sparkles size={16} />
              <span>Buy credits</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick purchase modal - Displayed above everything */}
      {showQuickPurchase && (
        <div 
          className="quick-purchase-overlay"
          onClick={(e) => {
            // Close modal if clicked outside (not on content)
            if (e.target === e.currentTarget) {
              setShowQuickPurchase(false);
            }
          }}
        >
          <div className="quick-purchase-interface">
            <div className="quick-purchase-header">
              <h4>Quick purchase</h4>
              <button 
                className="close-quick-purchase"
                onClick={() => setShowQuickPurchase(false)}
              >
                ×
              </button>
            </div>
            
            <div className="quick-purchase-presets">
              <button 
                className={`preset-btn ${creditAmountToBuy === 35 ? 'active' : ''}`}
                onClick={() => setCreditAmountToBuy(35)}
                disabled={creditPurchaseLoading}
              >
                <div className="preset-amount">35 credits</div>
                <div className="preset-price">1 WLD</div>
              </button>
              <button 
                className={`preset-btn ${creditAmountToBuy === 175 ? 'active' : ''}`}
                onClick={() => setCreditAmountToBuy(175)}
                disabled={creditPurchaseLoading}
              >
                <div className="preset-amount">175 credits</div>
                <div className="preset-price">5 WLD</div>
              </button>
              <button 
                className={`preset-btn ${creditAmountToBuy === 350 ? 'active' : ''}`}
                onClick={() => setCreditAmountToBuy(350)}
                disabled={creditPurchaseLoading}
              >
                <div className="preset-amount">350 credits</div>
                <div className="preset-price">10 WLD</div>
              </button>
            </div>
            <button
              className={`quick-buy-btn ${creditPurchaseLoading ? 'loading' : ''}`}
              onClick={buyCredits}
              disabled={creditPurchaseLoading || creditAmountToBuy <= 0}
            >
              {creditPurchaseLoading ? (
                'Processing...'
              ) : (
                `Buy ${creditAmountToBuy} credits`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Navigation - MODIFIED to remove Staking */}
      <div className="bottom-navigation">
        <div className="nav-tabs-container">
          <button 
            className={`nav-tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            Content
          </button>
          <button 
            className={`nav-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Info
          </button>
          <button 
            className={`nav-tab ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            Posts
          </button>
        </div>
      </div>
      {/* Content of tabs */}
      {activeTab === 'content' && (
        <div className="tab-content">
          {/* Sub-navigation for content */}
          <div className="content-type-navigation">
            <button 
              className={`content-type-btn ${contentType === 'videos' ? 'active' : ''}`}
              onClick={() => setContentType('videos')}
            >
              <Film size={18} />
              <span>Videos ({userVideos.length})</span>
            </button>
            <button 
              className={`content-type-btn ${contentType === 'images' ? 'active' : ''}`}
              onClick={() => setContentType('images')}
            >
              <ImageIcon size={18} />
              <span>Images ({userImages.length})</span>
            </button>
          </div>
          {contentType === 'videos' && (
            <div className="videos-section-new">
              <div className="video-type-filters-new">
                <button 
                  className={`filter-btn-new ${videoTypeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setVideoTypeFilter('all')}
                >
                  All ({userVideos.length})
                </button>
                <button 
                  className={`filter-btn-new ${videoTypeFilter === 'short' ? 'active' : ''}`}
                  onClick={() => setVideoTypeFilter('short')}
                >
                  Shorts ({shortVideos.length})
                </button>
                <button 
                  className={`filter-btn-new ${videoTypeFilter === 'long' ? 'active' : ''}`}
                  onClick={() => setVideoTypeFilter('long')}
                >
                  Longs ({longVideos.length})
                </button>
              </div>
              {videosLoading && (
                <div className="loading-new">
                  <div className="loading-spinner-new"></div>
                  <p>Loading videos...</p>
                </div>
              )}
              {videosError && (
                <div className="error-new">
                  <p>{videosError}</p>
                  <button onClick={loadUserVideos}>Retry</button>
                </div>
              )}
              {!videosLoading && !videosError && filteredVideos.length === 0 && userVideos.length > 0 && (
                <div className="no-content-new">
                  <Film size={48} className="no-content-icon" />
                  <p>No content of this type</p>
                </div>
              )}
              {!videosLoading && !videosError && userVideos.length === 0 && (
                <div className="no-content-new">
                  <Film size={48} className="no-content-icon" />
                  <p>No videos published</p>
                  <p>Upload your first video!</p>
                </div>
              )}
              {!videosLoading && !videosError && filteredVideos.length > 0 && (
                <div className="videos-grid-new">
                  {filteredVideos.map(video => (
                    <VideoCardRectangular key={video._id} video={video} />
                  ))}
                </div>
              )}
            </div>
          )}
          {contentType === 'images' && (
            <div className="images-section-new">
              {/* Temporary debug button */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                {/* <button 
                  onClick={() => {
                    console.log('🔍 DEBUG - Current user:', user);
                    console.log('🔍 DEBUG - User ID:', user?._id);
                    console.log('🔍 DEBUG - Images state:', userImages);
                    console.log('🔍 DEBUG - Images loading:', imagesLoading);
                    console.log('🔍 DEBUG - Images error:', imagesError);
                    loadUserImages();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🔍 Debug Images
                </button> */}
              </div>
              {imagesLoading && (
                <div className="loading-new">
                  <div className="loading-spinner-new"></div>
                  <p>Loading images...</p>
                </div>
              )}
              {imagesError && (
                <div className="error-new">
                  <p>{imagesError}</p>
                  <button onClick={loadUserImages}>Retry</button>
                </div>
              )}
              {!imagesLoading && !imagesError && userImages.length === 0 && (
                <div className="no-content-new">
                  <ImageIcon size={48} className="no-content-icon" />
                  <p>No images published</p>
                  <p>Create your first image in the Images tab!</p>
                  <div style={{ marginTop: '16px', padding: '12px', background: '#f0f8ff', borderRadius: '8px', fontSize: '14px' }}>
                    <strong>💡 For testing:</strong><br/>
                    1. Go to the main menu and select the "Images" tab<br/>
                    2. Click the "+" button at the bottom right<br/>
                    3. Publish an image (upload or AI generation)<br/>
                    4. Come back here to see it in your profile
                  </div>
                </div>
              )}
              {!imagesLoading && !imagesError && userImages.length > 0 && (
                <div className="images-grid-new">
                  {userImages.map(image => (
                    <ImageCard key={image._id} image={image} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {activeTab === 'info' && (
        <div className="tab-content">
          <div className="profile-details-new">
            <h3>Detailed information</h3>
            <div className="detail-card">
              <h4>🔐 Authentication</h4>
              <div className="detail-item-new">
                <span>Wallet address :</span>
                <span>{allUserData.walletAddress ? getShortAddress(allUserData.walletAddress) : 'Not connected'}</span>
              </div>
              <div className="detail-item-new">
                <span>Verification level :</span>
                <span>{allUserData.verificationLevel || 'unverified'}</span>
              </div>
            </div>
            <div className="detail-card">
              <h4>📅 Account information</h4>
              <div className="detail-item-new">
                <span>Created :</span>
                <span>{formatDate(allUserData.createdAt)}</span>
              </div>
              <div className="detail-item-new">
                <span>Last connection :</span>
                <span>{formatDate(allUserData.lastLogin)}</span>
              </div>
            </div>
            <div className="detail-card">
              <h4>💰 BLOOM information</h4>
              <div className="detail-item-new">
                <span>Current balance :</span>
                <span>{walletBalance !== null ? `${walletBalance.toFixed(2)} BLOOM` : 'Loading...'}</span>
              </div>
              <div className="detail-item-new">
                <span>BLOOM to claim :</span>
                <span>{grabBalance.toFixed(2)} BLOOM</span>
              </div>
              <div className="detail-item-new">
                <span>Videos watched :</span>
                <span>{videosWatched}</span>
              </div>
              <div className="detail-item-new">
                <span>BLOOM earned by watching :</span>
                <span>{tokensEarnedFromVideos.toFixed(2)} BLOOM</span>
              </div>
            </div>
            <div className="detail-card">
              <h4>💳 Credits</h4>
              <div className="detail-item-new">
                <span>Available credits :</span>
                <span>{credits} credits</span>
              </div>
              <div className="credit-purchase-section">
                <h5>Buy credits</h5>
                <p className="credit-info">1 WLD = 35 credits</p>
                <div className="credit-input-group">
                  <label htmlFor="creditAmount">Number of credits :</label>
                  <input
                    id="creditAmount"
                    type="number"
                    min="4"
                    max="3500"
                    value={creditAmountToBuy}
                    onChange={(e) => setCreditAmountToBuy(parseInt(e.target.value) || 35)}
                    disabled={creditPurchaseLoading}
                  />
                  <span className="wld-price">
                    Price: {(creditAmountToBuy / 35).toFixed(2)} WLD
                  </span>
                </div>
                <div className="credit-presets">
                  <button 
                    onClick={() => setCreditAmountToBuy(35)}
                    className={creditAmountToBuy === 35 ? 'active' : ''}
                    disabled={creditPurchaseLoading}
                  >
                    35 credits (1 WLD)
                  </button>
                  <button 
                    onClick={() => setCreditAmountToBuy(175)}
                    className={creditAmountToBuy === 175 ? 'active' : ''}
                    disabled={creditPurchaseLoading}
                  >
                    175 credits (5 WLD)
                  </button>
                  <button 
                    onClick={() => setCreditAmountToBuy(350)}
                    className={creditAmountToBuy === 350 ? 'active' : ''}
                    disabled={creditPurchaseLoading}
                  >
                    350 credits (10 WLD)
                  </button>
                </div>
                <button
                  className={`buy-credits-btn ${creditPurchaseLoading ? 'loading' : ''}`}
                  onClick={buyCredits}
                  disabled={creditPurchaseLoading || creditAmountToBuy <= 0}
                >
                  {creditPurchaseLoading ? (
                    'Processing...'
                  ) : (
                    `Buy ${creditAmountToBuy} credits for ${(creditAmountToBuy / 35).toFixed(2)} WLD`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'posts' && (
        <div className="tab-content">
          <div className="posts-section-new">
            <h3>Questions & Answers</h3>
            <div className="no-content-new">
              <MessageSquare size={48} className="no-content-icon" />
              <p>No Q&A for now</p>
              <p>This section will be available soon!</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Video player modal */}
      {selectedVideo && (
        <VideoPlayerModal 
          video={selectedVideo} 
          onClose={closeVideoPlayer}
          formatCategory={formatCategory}
          formatDuration={formatDuration}
        />
      )}
      
      {/* Notification */}
      {notification.show && (
        <div className={`notification-profile ${notification.type}`}>
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
};

// Video player modal - YouTube Mobile Style (copié depuis VideoCatalog)
const VideoPlayerModal = ({ video, onClose, formatCategory, formatDuration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [hasTrackedWatch, setHasTrackedWatch] = useState(false);
  const [watchStartTime, setWatchStartTime] = useState(null);
  const [isFollowing, setIsFollowing] = useState(video.isFollowing || false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(video.user?.followersCount || 0);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const progressRef = useRef(null);
  const modalRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const touchStartY = useRef(null);

  // Load complete user data if needed
  useEffect(() => {
    const loadUserData = async () => {
      if (!userDataLoaded && video.user?.username) {
        try {
          const response = await apiService.getUserProfile(video.user.username);
          if (response.status === 'success') {
            setFollowersCount(response.data.followersCount || 0);
            // Update follow status if available
            if (response.data.isFollowing !== undefined) {
              setIsFollowing(response.data.isFollowing);
            }
          }
        } catch (error) {
          console.error('❌ Error loading user data:', error);
          // Keep default value in case of error
        } finally {
          setUserDataLoaded(true);
        }
      }
    };

    loadUserData();
  }, [video.user?.username, userDataLoaded]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!canFollow() || isFollowLoading) {
      if (!canFollow()) {
        alert("You cannot follow yourself!");
      }
      return;
    }

    try {
      setIsFollowLoading(true);
      console.log(`${isFollowing ? 'Unfollow' : 'Follow'} user:`, video.user?.username);
      
      const response = await apiService.followUser(video.user.username);
      
      if (response.status === 'success') {
        const wasFollowing = isFollowing;
        setIsFollowing(!isFollowing);
        
        // Update local followers count
        setFollowersCount(prev => wasFollowing ? prev - 1 : prev + 1);
        
        console.log(`✅ ${wasFollowing ? 'Unfollowed' : 'Followed'} ${video.user.username} successfully`);
      } else {
        throw new Error(response.message || 'Failed to update follow status');
      }
    } catch (error) {
      console.error('❌ Error following/unfollowing user:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Handle swipe down to close
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (!touchStartY.current) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY.current;
      
      // If swipe down more than 100px, close modal
      if (deltaY > 100) {
        modalRef.current?.classList.add('closing');
        setTimeout(onClose, 300);
      }
    };

    const handleTouchEnd = () => {
      touchStartY.current = null;
    };

    const modal = modalRef.current;
    if (modal) {
      modal.addEventListener('touchstart', handleTouchStart);
      modal.addEventListener('touchmove', handleTouchMove);
      modal.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (modal) {
        modal.removeEventListener('touchstart', handleTouchStart);
        modal.removeEventListener('touchmove', handleTouchMove);
        modal.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [onClose]);

  // Handle native browser fullscreen events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      console.log('🎬 Fullscreen state changed:', isCurrentlyFullscreen);
      setIsFullscreen(isCurrentlyFullscreen);
    };

    const handleFullscreenError = (e) => {
      console.error('❌ Fullscreen error event:', e);
      setIsFullscreen(false);
    };

    // Add listeners for all prefixes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    document.addEventListener('fullscreenerror', handleFullscreenError);
    document.addEventListener('webkitfullscreenerror', handleFullscreenError);
    document.addEventListener('mozfullscreenerror', handleFullscreenError);
    document.addEventListener('MSFullscreenError', handleFullscreenError);

    return () => {
      // Clean up listeners
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      document.removeEventListener('fullscreenerror', handleFullscreenError);
      document.removeEventListener('webkitfullscreenerror', handleFullscreenError);
      document.removeEventListener('mozfullscreenerror', handleFullscreenError);
      document.removeEventListener('MSFullscreenError', handleFullscreenError);
    };
  }, []);

  // Hide controls after 3 seconds
  const hideControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Show controls
  const handleShowControls = () => {
    setShowControls(true);
    hideControlsTimeout();
  };

  // Trigger control hiding when video starts playing
  useEffect(() => {
    if (isPlaying) {
      hideControlsTimeout();
    } else {
      // Show controls when video is paused
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Play/Pause
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
        if (!watchStartTime) {
          setWatchStartTime(Date.now());
        }
      }
    }
  };

  // Update time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Update buffer
      if (videoRef.current.buffered.length > 0) {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBuffered((bufferedEnd / videoRef.current.duration) * 100);
      }
    }
  };

  // Handle metadata loading
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  // Handle video end
  const handleVideoEnded = async () => {
    setIsPlaying(false);
    
    // Track for rewards
    if (!hasTrackedWatch && watchStartTime) {
      const watchDuration = (Date.now() - watchStartTime) / 1000;
      const videoDuration = duration || 30;
      
      if (watchDuration >= videoDuration * 0.8) {
        try {
          const response = await apiService.trackVideoWatch(
            video.id || video._id, 
            'videos',
            watchDuration
          );
          
          if (response.status === 'success' && response.tokensEarned > 0) {
            setHasTrackedWatch(true);
            console.log(`✅ Earned ${response.tokensEarned} tokens`);
          }
        } catch (error) {
          console.error('❌ Error tracking video:', error);
        }
      }
    }
  };

  // Seek in video
  const handleProgressClick = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    
    if (videoRef.current) {
      videoRef.current.currentTime = pos * duration;
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    console.log('🎬 Toggle fullscreen clicked, current state:', isFullscreen);
    
    if (!modalRef.current) {
      console.error('❌ modalRef is null');
      return;
    }

    const element = modalRef.current;
    
    try {
      if (!isFullscreen) {
        // Enter fullscreen
        console.log('🎬 Entering fullscreen...');
        
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        } else {
          console.warn('⚠️ Fullscreen API not supported, using CSS fallback');
          setIsFullscreen(true);
          return;
        }
      } else {
        // Exit fullscreen
        console.log('🎬 Exiting fullscreen...');
        
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        } else {
          console.warn('⚠️ Exit fullscreen API not supported, using CSS fallback');
          setIsFullscreen(false);
          return;
        }
      }
    } catch (error) {
      console.error('❌ Fullscreen error:', error);
      setIsFullscreen(!isFullscreen);
    }
  };

  // Format time
  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num?.toString() || '0';
  };

  // Check if user can follow this user
  const canFollow = () => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUsername = currentUser.username;
    
    // A user cannot follow themselves
    return currentUsername && currentUsername !== video.user?.username;
  };

  return (
    <div 
      className={`video-player-modal ${isFullscreen ? 'fullscreen' : ''}`} 
      ref={modalRef}
    >
      {/* Container video with 16:9 ratio */}
      <div className="youtube-video-container" onClick={handleShowControls}>
        <video
          ref={videoRef}
          src={video.videoUrl}
          className="youtube-video"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleVideoEnded}
          onLoadStart={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          playsInline
          preload="metadata"
        />

        {/* Loading spinner */}
        {isLoading && (
          <div className="youtube-loading-overlay">
            <div className="youtube-loading-spinner"></div>
          </div>
        )}

        {/* Overlay with controls */}
        <div 
          className={`youtube-video-overlay ${showControls ? 'visible' : ''}`}
          ref={overlayRef}
        >
          {/* Player header */}
          <div className="youtube-player-header">
            <button className="youtube-close-btn" onClick={onClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            <h3 className="youtube-player-title">{video.title || video.description}</h3>
          </div>

          {/* Central controls */}
          <div className="youtube-center-controls">
            <button className="youtube-control-btn youtube-play-pause" onClick={togglePlayPause}>
              {isPlaying ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
          </div>

          {/* Bottom controls */}
          <div className="youtube-bottom-controls">
            {/* Progress bar */}
            <div className="youtube-progress-container" onClick={handleProgressClick}>
              <span className="youtube-time">{formatTime(currentTime)}</span>
              <div className="youtube-progress-bar" ref={progressRef}>
                <div 
                  className="youtube-progress-buffered" 
                  style={{ width: `${buffered}%` }}
                />
                <div 
                  className="youtube-progress-played" 
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
                <div 
                  className="youtube-progress-handle" 
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <span className="youtube-time">{formatTime(duration)}</span>
            </div>

            {/* Additional controls */}
            <div className="youtube-extra-controls">
              <div className="youtube-left-controls">
                <button className="youtube-control-icon" onClick={toggleMute}>
                  {isMuted ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  )}
                </button>
              </div>

              <div className="youtube-right-controls">
                <button className="youtube-control-icon" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Container scrollable for details */}
      <div className="youtube-details-container">
        {/* Video information */}
        <div className="youtube-video-info">
          <h1 className="youtube-video-title">{video.title || video.description}</h1>
          <div className="youtube-video-meta">
            <span>{formatNumber(video.viewsCount || video.views || 0)} views</span>
            <span>{video.user?.username || 'Unknown'}</span>
            <span>{video.createdAt || video.uploadDate}</span>
          </div>
        </div>

        {/* Video actions */}
        <div className="youtube-video-actions">
          <button className={`youtube-action-btn ${video.isLiked ? 'active' : ''}`}>
            <span className="youtube-action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
            </span>
            <span className="youtube-action-label">{formatNumber(video.likesCount || video.likes || 0)}</span>
          </button>
          
          <button className="youtube-action-btn">
            <span className="youtube-action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </span>
            <span className="youtube-action-label">Share</span>
          </button>
          
          <button className="youtube-action-btn">
            <span className="youtube-action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </span>
            <span className="youtube-action-label">Download</span>
          </button>
        </div>

        {/* Channel section */}
        {video.user && (
          <div className="youtube-channel-section">
            <div className="youtube-channel-header">
              <div className="youtube-channel-info">
                <img 
                  src={video.user.avatar || '/default-avatar.png'} 
                  alt={video.user.username} 
                  className="youtube-channel-avatar"
                />
                <div className="youtube-channel-details">
                  <div className="youtube-channel-name">
                    {video.user.username}
                  </div>
                  <div className="youtube-channel-subs">
                    {formatNumber(followersCount)} subscribers
                  </div>
                </div>
              </div>
              <button 
                className={`youtube-subscribe-btn ${isFollowing ? 'subscribed' : ''}`}
                onClick={handleFollow}
                disabled={!canFollow() || isFollowLoading}
                style={{ 
                  opacity: !canFollow() ? 0.5 : 1,
                  cursor: !canFollow() ? 'not-allowed' : 'pointer'
                }}
              >
                {isFollowLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid transparent',
                      borderTop: '2px solid currentColor',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    {isFollowing ? 'Unfollowing...' : 'Following...'}
                  </span>
                ) : !canFollow() ? (
                  'You'
                ) : (
                  isFollowing ? 'Following' : 'Follow'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Comments section */}
        <div className="youtube-comments-section">
          <div className="youtube-comments-header">
            <h2 className="youtube-comments-title">
              Comments
              <span className="youtube-comments-count">{formatNumber(video.comments || 0)}</span>
            </h2>
          </div>
          <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
            Comments are temporarily disabled
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;