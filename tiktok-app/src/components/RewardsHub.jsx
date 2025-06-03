import React, { useState, useEffect } from 'react';
import { ChevronLeft, Award, Gift, Shield, User, Check, RefreshCw, Copy, Clock, Send } from "lucide-react";
import axios from "axios";
import { ethers, BrowserProvider, Contract, formatUnits } from 'ethers';
import { MiniKit, ResponseEvent } from "@worldcoin/minikit-js";
import distributorAbi from '../abi/Distributor.json';
import permit2Abi from '../abi/Permit2.json';
import { encodeVoucher } from '../utils/encodeVoucher';
import './RewardsHub.css';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://bloom-m284.onrender.com/api';
const BACKEND_URL = API_BASE_URL;
const API_TIMEOUT = 15000;
const TOKEN_CONTRACT_ADDRESS = '0x8b2D045381c7B9E09dC72fc3DDEbC1c74724E78D';
const PERMIT2_CONTRACT_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'; // Official Permit2 contract

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const RewardsHub = () => {
  // States
  const [walletBalance, setWalletBalance] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [username, setUsername] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [canClaim, setCanClaim] = useState(true);
  const [nextClaimTime, setNextClaimTime] = useState(null);
  const [lastClaimTime, setLastClaimTime] = useState(null);
  const [grabBalance, setGrabBalance] = useState(0);
  const [videosWatched, setVideosWatched] = useState(0);
  const [tokensEarnedFromVideos, setTokensEarnedFromVideos] = useState(0);

  // Setup MiniKit event handlers
  useEffect(() => {
    if (!MiniKit.isInstalled()) return;

    const unsubscribe = MiniKit.subscribe(
      ResponseEvent.MiniAppSendTransaction,
      async (payload) => {
        console.log('[MiniKit Event] Transaction response:', payload);
        
        if (payload.status === "success") {
          console.log('[MiniKit Event] Transaction successful:', payload.transaction_id);
          // Transaction handled in claimTokens function
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

  // Function to claim tokens - Simplified version
  const claimTokens = async () => {
    if (isLoading) return; // Prevent multiple clicks
    
    setIsLoading(true);
    setNotification({ show: true, message: "Preparing claim…", type: "info" });

    try {
      /* ─────────────────────────────
       * 0. Pre-checks
       * ────────────────────────────*/
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

      /* ─────────────────────────────
       * 1. Voucher retrieval
       * ────────────────────────────*/
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
        // Handle Axios errors (like 400, 401, etc.)
        if (axiosError.response?.status === 400) {
          const errorData = axiosError.response.data;
          console.log('[CLAIM] Error from server:', errorData);
          
          throw new Error(errorData?.error || 'Claim request failed');
        }
        
        // Re-throw other axios errors
        throw axiosError;
      }

      if (voucherResponse.status !== 200 || !voucherResponse.data?.voucher) {
        const errorData = voucherResponse.data;
        throw new Error(errorData?.error || 'Failed to get voucher');
      }

      const { voucher, signature, claimedAmount } = voucherResponse.data;
      console.log('[CLAIM] Voucher received:', { voucher, signature, claimedAmount });

      /* ─────────────────────────────
       * 2. Arguments construction
       * ────────────────────────────*/
      let voucherArgs;
      try {
        voucherArgs = encodeVoucher(voucher);
        console.log('[CLAIM] Voucher encoded:', voucherArgs);
      } catch (err) {
        throw new Error(`Voucher encoding failed: ${err.message}`);
      }

      /* ─────────────────────────────
       * 3. Transaction sending with MiniKit
       * ────────────────────────────*/
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
        // Cancel the pending claim on backend
        await axios.post(
          `${BACKEND_URL}/airdrop/cancel`,
          { nonce: voucher.nonce },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        throw new Error(transactionResponse.finalPayload.message || "Transaction rejected");
      }

      if (!transactionResponse.finalPayload?.transaction_id) {
        // Cancel the pending claim on backend
        await axios.post(
          `${BACKEND_URL}/airdrop/cancel`,
          { nonce: voucher.nonce },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        throw new Error("No transaction ID received");
      }

      /* ─────────────────────────
       * 4. Server confirmation
       * ────────────────────────*/
      const txId = transactionResponse.finalPayload.transaction_id;
      console.log('[CLAIM] Confirming transaction with backend:', txId);
      
      setNotification({ show: true, message: "Confirming transaction...", type: "info" });

      let attempts = 0;
      const maxAttempts = 8; // Reduced from 12 to 8
      
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
            // Don't throw error - just break and show success
            break;
          }
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        // Handle 404 "No matching pending claim" - this might mean it's already processed
        if (confirmResponse.status === 404 && confirmResponse.data?.error?.includes("No matching pending claim")) {
          console.log('[CLAIM] No matching pending claim - transaction may have already been processed');
          break;
        }
        
        throw new Error(confirmResponse.data?.error || `Confirmation failed (status ${confirmResponse.status})`);
      }

      /* ─────────────────────────
       * 5. UI update
       * ────────────────────────*/
      setNotification({
        show: true,
        message: `✅ ${claimedAmount} tokens claimed successfully!`,
        type: "success",
      });
      
      // 🚨 FIX: Refresh backend data immediately after successful claim
      console.log('[CLAIM] 🔄 Refreshing backend data after successful claim...');
      setTimeout(() => {
        checkClaimStatus();
      }, 1000);
      
      // Refresh balance after a delay
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

  // Function to transfer tokens with Permit2
  const transferTokens = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setNotification({ show: true, message: "Preparing transfer...", type: "info" });

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

      // Transfer configuration
      const transferAmount = (5 * 10 ** 18).toString(); // 5 tokens in wei
      const recipientAddress = "0xAD37a1134C8f4254050B853c29dEcB91969caa41";
      
      // Permit2 is valid for maximum 1 hour
      const permitTransfer = {
        permitted: {
          token: TOKEN_CONTRACT_ADDRESS,
          amount: transferAmount,
        },
        nonce: Date.now().toString(),
        deadline: Math.floor((Date.now() + 30 * 60 * 1000) / 1000).toString(), // 30 minutes
      };

      const transferDetails = {
        to: recipientAddress,
        requestedAmount: transferAmount,
      };

      setNotification({ show: true, message: "Sending transfer transaction...", type: "info" });

      console.log('[TRANSFER] Sending transaction via MiniKit...');
      const transactionResponse = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: PERMIT2_CONTRACT_ADDRESS,
            abi: permit2Abi,
            functionName: 'permitTransferFrom',
            args: [
              [
                [
                  permitTransfer.permitted.token,
                  permitTransfer.permitted.amount,
                ],
                permitTransfer.nonce,
                permitTransfer.deadline,
              ],
              [transferDetails.to, transferDetails.requestedAmount],
              'PERMIT2_SIGNATURE_PLACEHOLDER_0',
            ],
          },
        ],
        permit2: [
          {
            ...permitTransfer,
            spender: PERMIT2_CONTRACT_ADDRESS,
          },
        ],
      });

      console.log('[TRANSFER] MiniKit transaction response:', transactionResponse);

      if (transactionResponse.finalPayload?.status === "error") {
        throw new Error(transactionResponse.finalPayload.message || "Transaction rejected");
      }

      if (!transactionResponse.finalPayload?.transaction_id) {
        throw new Error("No transaction ID received");
      }

      setNotification({
        show: true,
        message: `✅ 5 tokens transferred successfully to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}!`,
        type: "success",
      });
      
      // Refresh balance after a delay
      setTimeout(async () => {
        const onChain = await fetchTokenBalance();
        if (onChain !== null) setWalletBalance(onChain);
      }, 6000);

    } catch (err) {
      console.error('[TRANSFER] Error:', err);
      setNotification({ 
        show: true, 
        message: err.message || "Transfer failed", 
        type: "error" 
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 5000);
    }
  };

  // Load user data on component mount
  useEffect(() => {
    setIsLoading(true);
    
    // Retrieve JWT token from localStorage
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('auth_token'); 
    if (storedToken) {
      setToken(storedToken);
      console.log('[RewardsHub] Token found:', storedToken.substring(0, 10) + '...');
    } else {
      console.log('[RewardsHub] No token found in localStorage');
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
      console.log('[RewardsHub] Wallet address found:', storedWalletAddress);
    } else {
      console.log('[RewardsHub] No wallet address found in localStorage');
    }
    
    setIsLoading(false);
  }, []);

  // Auto-refresh when token becomes available
  useEffect(() => {
    if (token) {
      console.log('🔄 [RewardsHub] Token available, auto-refreshing status...');
      checkClaimStatus();
    }
  }, [token]);

  // Check if user can claim (no cooldown)
  const checkClaimStatus = async () => {
    console.log('🎯 [RewardsHub] checkClaimStatus called');
    console.log('🎯 [RewardsHub] token present:', !!token);
    
    // No local cooldown check - always check with server

    // Check with backend for pending status
    if (token) {
      try {
        console.log('🎯 [RewardsHub] Making request to /airdrop/status...');
        const statusResponse = await axios.get(
          `${BACKEND_URL}/airdrop/status`,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
          }
        );

        console.log('🎯 [RewardsHub] Status response:', statusResponse.data);

        if (statusResponse.data) {
          const { 
            canClaim: serverCanClaim, 
            hasPending, 
            grabBalance: userGrabBalance,
            videosWatched: userVideosWatched,
            tokensEarnedFromVideos: userTokensEarned
          } = statusResponse.data;
          
          console.log('🎯 [RewardsHub] Parsed data:');
          console.log('  - canClaim:', serverCanClaim);
          console.log('  - hasPending:', hasPending);
          console.log('  - grabBalance:', userGrabBalance);
          console.log('  - videosWatched:', userVideosWatched);
          console.log('  - tokensEarnedFromVideos:', userTokensEarned);
          
          setCanClaim(serverCanClaim);
          setGrabBalance(userGrabBalance || 0);
          setVideosWatched(userVideosWatched || 0);
          setTokensEarnedFromVideos(userTokensEarned || 0);
          
          console.log('🎯 [RewardsHub] State updated with grabBalance:', userGrabBalance || 0);
          
          // No cooldown logic - always available unless pending
          if (hasPending) {
            console.log('[RewardsHub] Transaction pending, claim disabled temporarily');
          }
        } else {
          console.warn('🎯 [RewardsHub] No data in response');
        }
      } catch (error) {
        console.error('🎯 [RewardsHub] Failed to check server status:', error);
        console.error('🎯 [RewardsHub] Error details:', error.response?.data);
        // Default to allowing claims if server check fails
        setCanClaim(true);
      }
    } else {
      console.warn('🎯 [RewardsHub] No token available, skipping status check');
      setCanClaim(true);
    }
  };

  // Fetch token balance
  const fetchTokenBalance = async (address = walletAddress) => {
    try {
      if (!address) return null;

      // Try API endpoint first
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

      // Fallback to on-chain
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

  // Fetch balance on wallet address change
  useEffect(() => {
    (async () => {
      if (!walletAddress) return;
      const chainBal = await fetchTokenBalance(walletAddress);
      if (chainBal !== null) setWalletBalance(chainBal);
    })();
  }, [walletAddress]);

  // Function to refresh token balance manually
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

  const formatTimeRemaining = (nextClaimTime) => {
    if (!nextClaimTime) return '';
    
    const now = new Date();
    const timeDiff = nextClaimTime - now;
    
    if (timeDiff <= 0) {
      setCanClaim(true);
      return '';
    }
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="rewards-hub">
      <div className="background"></div>
      <div className="content-container">
        
        {/* Header */}
        <header>
          <div className="top-nav">
            <div className="balance-display">
              <div className="balance-text">
                <span className="balance-label">Balance:</span>
                <span className="balance-value">
                  {isLoading ? 'Loading…' :
                    walletBalance !== null ? `${walletBalance.toFixed(2)} BLOOM` : 'N/A'}
                </span>
              </div>
              <button className="refresh-btn" onClick={refreshTokenBalance}>
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* User Profile Section */}
        <div className="profile-container">
          <div className="profile-image-container">
            <div className="profile-avatar">
              <User size={40} />
            </div>
          </div>
          <div className="profile-header">
            <h3 className="profile-username">
              {isLoading ? 'Loading...' : (username || 'User')}
            </h3>
          </div>
        </div>

        {/* Claim Section */}
        <div className="claim-section">
          <div className="claim-card">
            <div className="claim-header">
              <Gift size={24} />
              <h3>Grab Your BLOOM</h3>
            </div>
            
            <div className="claim-info">
              <div className="grab-balance-display">
                <div className="balance-amount">
                  {grabBalance.toFixed(2)} BLOOM
                </div>
                <div className="balance-label">Available to grab</div>
              </div>
              
              <div className="earning-stats">
                <div className="stat-item">
                  <span className="stat-number">{videosWatched}</span>
                  <span className="stat-label">Videos watched</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{tokensEarnedFromVideos.toFixed(2)}</span>
                  <span className="stat-label">BLOOM earned</span>
                </div>
              </div>
              
              {grabBalance > 0 ? (
                <p>You have {grabBalance.toFixed(2)} BLOOM ready to grab!</p>
              ) : (
                <p>Watch videos to earn BLOOM. 0.1 BLOOM for home videos, 0.2 for catalog videos.</p>
              )}
            </div>

            <button
              className={`claim-button ${!canClaim || grabBalance <= 0 ? 'disabled' : ''}`}
              disabled={isLoading || !canClaim || grabBalance <= 0}
              onClick={claimTokens}
            >
              {isLoading ? (
                <span className="claim-text">Processing...</span>
              ) : grabBalance <= 0 ? (
                <span className="claim-text">No BLOOM to grab</span>
              ) : !canClaim ? (
                <span className="claim-text">Transaction pending...</span>
              ) : (
                <div className="claim-content">
                  <span className="claim-text">Grab {grabBalance.toFixed(2)} BLOOM</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Transfer Section */}
        <div className="claim-section">
          <div className="claim-card">
            <div className="claim-header">
              <Send size={24} />
              <h3>Transfer BLOOM</h3>
            </div>
            
            <div className="claim-info">
              <p>Send 5 BLOOM to 0xAD37...caa41</p>
            </div>

            <button
              className="claim-button"
              disabled={isLoading}
              onClick={transferTokens}
            >
              {isLoading ? (
                <span className="claim-text">Processing...</span>
              ) : (
                <div className="claim-content">
                  <span className="claim-text">Send 5 BLOOM</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="challenges-section">
          <div className="section-header">
            <h3>More Features</h3>
          </div>
          
          <div className="coming-soon-container">
            <div className="coming-soon-icon">
              <Award size={28} />
            </div>
            <h3 className="coming-soon-title">Coming Soon!</h3>
            <p className="coming-soon-text">More ways to earn BLOOM</p>
          </div>
        </div>
      </div>
      
      {/* Notification */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default RewardsHub;