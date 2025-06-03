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

import './Profile.css';
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
      try {
        const res = await axios.get(`${BACKEND_URL}/payment/address`);
        setPaymentAddress(res.data.paymentAddress);
      } catch (e) {
        setPaymentAddress('');
        console.error('Failed to fetch payment address', e);
      }
    }
    fetchPaymentAddress();
  }, []);

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
    if (creditPurchaseLoading || !creditAmountToBuy || creditAmountToBuy <= 0) return;
    
    setCreditPurchaseLoading(true);
    setNotification({ show: true, message: "Initiating credit purchase...", type: "info" });

    try {
      if (!MiniKit.isInstalled()) {
        setNotification({ show: true, message: "World App / MiniKit not detected", type: "error" });
        setCreditPurchaseLoading(false);
        return;
      }

      // Initiate credit purchase
      console.log('[CREDIT PURCHASE] Initiating purchase...');
      
      const initResponse = await axios.post(
        `${BACKEND_URL}/users/initiate-credit-purchase`,
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

      if (initResponse.status !== 200 || !initResponse.data?.reference) {
        throw new Error(initResponse.data?.error || 'Failed to initiate purchase');
      }

      const { reference, wldPrice } = initResponse.data;
      console.log('[CREDIT PURCHASE] Purchase initiated:', { reference, wldPrice, creditAmountToBuy });

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

      setNotification({ show: true, message: "Confirming payment...", type: "info" });
      
      console.log('[CREDIT PURCHASE] Sending payment via MiniKit...', payload);
      const { finalPayload } = await MiniKit.commandsAsync.pay(payload);

      if (finalPayload.status === 'success') {
        console.log('[CREDIT PURCHASE] Payment successful:', finalPayload.transaction_id);
        
        // Confirm purchase with backend
        const confirmResponse = await axios.post(
          `${BACKEND_URL}/users/confirm-credit-purchase`,
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

        if (confirmResponse.data.success) {
          setCredits(confirmResponse.data.credits);
          setNotification({ 
            show: true, 
            message: `Successfully purchased ${confirmResponse.data.purchasedAmount} credits!`, 
            type: "success" 
          });
          setCreditAmountToBuy(35); // Reset to default
          setShowQuickPurchase(false); // Close quick purchase interface
        } else {
          throw new Error('Purchase confirmation failed');
        }
      } else {
        console.log('[CREDIT PURCHASE] Payment failed or cancelled:', finalPayload);
        setNotification({ 
          show: true, 
          message: "Payment cancelled or failed", 
          type: "error" 
        });
      }
    } catch (error) {
      console.error('[CREDIT PURCHASE] Error:', error);
      setNotification({ 
        show: true, 
        message: error.response?.data?.error || error.message || "Credit purchase failed", 
        type: "error" 
      });
    } finally {
      setCreditPurchaseLoading(false);
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
        
        console.log('=== IMAGES CHARGÉES ===');
        console.log(`Nombre d'images: ${images.length}`);
        if (images.length === 0) {
          console.log('ℹ️ Aucune image trouvée pour cet utilisateur');
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
      // Logique pour ouvrir/jouer la vidéo
      console.log('Video clicked:', video._id);
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
    try {
      if (!token) return;
      
      const response = await axios.get(
        `${BACKEND_URL}/users/credits`, // Changed endpoint
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      if (response.data && response.data.data) {
        setCredits(response.data.data.credits || 0); // Adjusted data access
      }
    } catch (error) {
      console.error('Failed to load user credits:', error);
    }
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
                <button 
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
                </button>
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
      {/* Notification */}
      {notification.show && (
        <div className={`notification-profile ${notification.type}`}>
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default Profile;