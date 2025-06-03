import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Camera, Sparkles, ArrowLeft, Coins, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { MiniKit } from '@worldcoin/minikit-js';
import CreditPurchaseCard from './CreditPurchaseCard';
import './UploadModal.css';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://bloom-m284.onrender.com';
const API_TIMEOUT = 30000;

// DEBUGGING: Log the backend URL being used
console.log('[UploadModal] Backend URL configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  BACKEND_URL,
  actualBackendUrl: BACKEND_URL
});

const UploadModal = ({ 
  isOpen, 
  onClose, 
  onFileUpload, 
  onAIGenerate, 
  isUploading, 
  uploadStatus, 
  uploadProgress 
}) => {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(5); // 5 or 10 seconds
  const fileInputRef = useRef(null);

  // States for credits
  const [credits, setCredits] = useState(0);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [showCreditPurchase, setShowCreditPurchase] = useState(false);
  const [creditPurchaseLoading, setCreditPurchaseLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const token = localStorage.getItem('authToken');
  const [paymentAddress, setPaymentAddress] = useState('');

  // NOUVEAU: Setup MiniKit event handlers
  useEffect(() => {
    if (!MiniKit.isInstalled()) return;

    const unsubscribe = MiniKit.subscribe(
      'miniapp-payment',
      async (payload) => {
        console.log('[MiniKit Event] Payment response:', payload);
        
        if (payload.status === "success") {
          console.log('[MiniKit Event] Payment successful:', payload.transaction_id);
          setNotification({ 
            show: true, 
            message: "Payment successful! Processing...", 
            type: "success" 
          });
        } else {
          console.log('[MiniKit Event] Payment failed or rejected:', payload);
          setNotification({ 
            show: true, 
            message: "Payment cancelled or failed", 
            type: "error" 
          });
          setCreditPurchaseLoading(false);
        }
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Generation costs
  const getGenerationCost = (duration) => {
    return duration === 10 ? 42 : 21;
  };

  // Fetch user credits
  const fetchCredits = async () => {
    console.log('🔄 [FETCH CREDITS] =================================');
    console.log('🔄 [FETCH CREDITS] STARTING FETCH CREDITS');
    console.log('🔄 [FETCH CREDITS] Backend URL:', BACKEND_URL);
    
    try {
      const creditsUrl = `${BACKEND_URL}/api/users/credits`;
      console.log('🔄 [FETCH CREDITS] 🔗 URL:', creditsUrl);
      console.log('🔄 [FETCH CREDITS] 🔑 Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      
      const response = await axios.get(creditsUrl, {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: API_TIMEOUT,
      });

      console.log('🔄 [FETCH CREDITS] 📨 Response status:', response.status);
      console.log('🔄 [FETCH CREDITS] 📨 Response data:', response.data);
      
      setCredits(response.data.credits);
      console.log('🔄 [FETCH CREDITS] ✅ Credits fetched successfully:', response.data.credits);
    } catch (error) {
      console.error('🔄 [FETCH CREDITS] ❌ Error:', error);
      console.error('🔄 [FETCH CREDITS] ❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      setCredits(0);
    } finally {
      console.log('🔄 [FETCH CREDITS] 🏁 Fetch credits ended');
    }
  };

  // Fetch payment address
  const fetchPaymentAddress = async () => {
    console.log('💰 [FETCH PAYMENT ADDRESS] =================================');
    console.log('💰 [FETCH PAYMENT ADDRESS] STARTING FETCH PAYMENT ADDRESS');
    console.log('💰 [FETCH PAYMENT ADDRESS] Backend URL:', BACKEND_URL);
    
    try {
      const paymentUrl = `${BACKEND_URL}/api/users/payment/address`;
      console.log('💰 [FETCH PAYMENT ADDRESS] 🔗 URL:', paymentUrl);
      console.log('💰 [FETCH PAYMENT ADDRESS] 🔑 Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      
      const response = await axios.get(paymentUrl, {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: API_TIMEOUT,
      });

      console.log('💰 [FETCH PAYMENT ADDRESS] 📨 Response status:', response.status);
      console.log('💰 [FETCH PAYMENT ADDRESS] 📨 Response data:', response.data);
      
      if (response.data.address) {
        setPaymentAddress(response.data.address);
        console.log('💰 [FETCH PAYMENT ADDRESS] ✅ Payment address fetched successfully:', response.data.address);
      } else {
        console.error('💰 [FETCH PAYMENT ADDRESS] ❌ No payment address in response');
      }
    } catch (error) {
      console.error('💰 [FETCH PAYMENT ADDRESS] ❌ Error:', error);
      console.error('💰 [FETCH PAYMENT ADDRESS] ❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
    } finally {
      console.log('💰 [FETCH PAYMENT ADDRESS] 🏁 Fetch payment address ended');
    }
  };

  // Function to purchase credits
  const handleCreditPurchase = async (creditAmount) => {
    console.log('🚀 [CREDIT PURCHASE] =================================');
    console.log('🚀 [CREDIT PURCHASE] STARTING CREDIT PURCHASE FLOW');
    console.log('🚀 [CREDIT PURCHASE] Timestamp:', new Date().toISOString());
    console.log('🚀 [CREDIT PURCHASE] Credit amount:', creditAmount);
    console.log('🚀 [CREDIT PURCHASE] Backend URL:', BACKEND_URL);
    console.log('🚀 [CREDIT PURCHASE] =================================');
    
    setCreditPurchaseLoading(true);
    setNotification({ show: true, message: "Initiating credit purchase...", type: "info" });

    try {
      if (!MiniKit.isInstalled()) {
        setNotification({ show: true, message: "World App / MiniKit not detected", type: "error" });
        setCreditPurchaseLoading(false);
        return;
      }

      // NOUVEAU: Vérifier que l'adresse de paiement est disponible
      if (!paymentAddress || paymentAddress.trim() === '') {
        console.error('🚀 [CREDIT PURCHASE] ❌ No payment address available:', paymentAddress);
        setNotification({ show: true, message: "Payment address not available. Please try again.", type: "error" });
        setCreditPurchaseLoading(false);
        return;
      }

      console.log('🚀 [CREDIT PURCHASE] ✅ Payment address available:', paymentAddress);
      console.log('🚀 [CREDIT PURCHASE] 📡 Initiating purchase with backend...');
      
      const initiateUrl = `${BACKEND_URL}/api/users/initiate-credit-purchase`;
      console.log('🚀 [CREDIT PURCHASE] 🔗 Initiate URL:', initiateUrl);
      console.log('🚀 [CREDIT PURCHASE] 🔑 Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      
      const initResponse = await axios.post(
        initiateUrl,
        { creditAmount: creditAmount },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          timeout: API_TIMEOUT,
        }
      );

      console.log('🚀 [CREDIT PURCHASE] 📨 Initiate response status:', initResponse.status);
      console.log('🚀 [CREDIT PURCHASE] 📨 Initiate response data:', initResponse.data);

      if (initResponse.status !== 200 || !initResponse.data?.reference) {
        throw new Error(initResponse.data?.error || 'Failed to initiate purchase');
      }

      const { reference, wldPrice } = initResponse.data;
      console.log('🚀 [CREDIT PURCHASE] ✅ Purchase initiated successfully:', { reference, wldPrice, creditAmount });

      const payload = {
        reference: reference,
        to: paymentAddress,
        tokens: [
          {
            symbol: 'WLD',
            token_amount: (wldPrice * Math.pow(10, 18)).toString(),
          }
        ],
        description: `Purchase ${creditAmount} credits for ${wldPrice} WLD`,
      };

      console.log('🚀 [CREDIT PURCHASE] 💰 Payment payload prepared:', payload);
      console.log('🚀 [CREDIT PURCHASE] 🔍 Payment address check:', { 
        paymentAddress, 
        isEmpty: !paymentAddress || paymentAddress.trim() === '',
        length: paymentAddress?.length 
      });

      setNotification({ show: true, message: "Confirming payment...", type: "info" });
      
      console.log('🚀 [CREDIT PURCHASE] 📱 Sending payment via MiniKit...');
      const { finalPayload } = await MiniKit.commandsAsync.pay(payload);

      console.log('🚀 [CREDIT PURCHASE] 📱 MiniKit response received:', finalPayload);

      if (finalPayload.status === 'success') {
        console.log('🚀 [CREDIT PURCHASE] ✅ Payment successful! Transaction ID:', finalPayload.transaction_id);
        
        const confirmUrl = `${BACKEND_URL}/api/users/confirm-credit-purchase`;
        console.log('🚀 [CREDIT PURCHASE] 🔗 Confirm URL:', confirmUrl);
        
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

        console.log('🚀 [CREDIT PURCHASE] 📨 Confirm response status:', confirmResponse.status);
        console.log('🚀 [CREDIT PURCHASE] 📨 Confirm response data:', confirmResponse.data);

        if (confirmResponse.data.success) {
          setCredits(confirmResponse.data.credits);
          setNotification({ 
            show: true, 
            message: `Successfully purchased ${confirmResponse.data.purchasedAmount} credits!`, 
            type: "success" 
          });
          setShowCreditPurchase(false);
          console.log('🚀 [CREDIT PURCHASE] ✅ Purchase completed successfully!');
        } else {
          throw new Error('Purchase confirmation failed');
        }
      } else {
        console.log('🚀 [CREDIT PURCHASE] ❌ Payment failed or cancelled:', finalPayload);
        
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
      console.error('🚀 [CREDIT PURCHASE] ❌ CRITICAL ERROR:', error);
      console.error('🚀 [CREDIT PURCHASE] ❌ Error details:', {
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
      console.log('🚀 [CREDIT PURCHASE] 🏁 Purchase flow ended');
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchCredits();
      fetchPaymentAddress();
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: 'info' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleCancelPreview = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setSelectedFile(null);
    setVideoPreview(null);
  };

  const handlePublishPreview = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
      setSelectedFile(null);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      setVideoPreview(null);
      onClose();
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      return;
    }

    const requiredCredits = getGenerationCost(selectedDuration);
    
    // Check credits
    if (credits < requiredCredits) {
      setNotification({
        show: true,
        message: `You need ${requiredCredits} credits to generate a ${selectedDuration}s video. You have ${credits} credits.`,
        type: "error"
      });
      setShowCreditPurchase(true);
      return;
    }

    setIsGenerating(true);
    
    // Immediate feedback
    setNotification({
      show: true,
      message: `🚀 Starting AI generation (${selectedDuration}s)...`,
      type: "info"
    });

    try {
      await onAIGenerate(aiPrompt, {
        duration: selectedDuration,
        ratio: '1280:720',
        model: 'gen4_turbo'
      });
      
      // Don't close modal here anymore, parent handles closing after preview
      setAiPrompt('');
      setNotification({
        show: true,
        message: `✨ Generation started successfully!`,
        type: "success"
      });
      
    } catch (error) {
      console.error('AI generation error:', error);
      
      // If error is credits-related, show purchase interface
      if (error.response?.status === 402) {
        setNotification({
          show: true,
          message: `Insufficient credits! ${requiredCredits} credits required.`,
          type: "error"
        });
        setShowCreditPurchase(true);
      } else {
        setNotification({
          show: true,
          message: error.message || 'Error during generation',
          type: "error"
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTextInput = (e) => {
    console.log('[onInput]', e.target.value, e);
    setAiPrompt(e.target.value);
  };

  const handleTextKeyDown = (e) => {
    console.log('[onKeyDown]', e.key, e);
  };

  useEffect(() => {
    if (!isOpen || selectedOption !== 'ai') return;
    const handleGlobalKeyDown = (e) => {
      console.log('[GLOBAL keydown]', e.key, e.metaKey, e.ctrlKey);
      if ((e.key === 'Enter' || e.keyCode === 13) && (e.metaKey || e.ctrlKey)) {
        if (aiPrompt.trim() && !isGenerating) {
          e.preventDefault();
          handleAIGenerate();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, selectedOption, aiPrompt, isGenerating]);

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.95,
      y: 20
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25,
        mass: 0.8
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95,
      y: 20,
      transition: {
        duration: 0.15,
        ease: "easeOut"
      }
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.2 }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.15 }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        delay: 0.1,
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="upload-modal-overlay-apple"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div 
            className="upload-modal-apple"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="upload-modal-header-apple" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', minHeight: 56 }}>
              <div style={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                {selectedOption && (
                  <button 
                    className="back-button-apple" 
                    onClick={() => setSelectedOption(null)}
                    style={{ position: 'static' }}
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <h2 className="modal-title-apple" style={{ margin: 0 }}>
                  {!selectedOption ? 'Create a video' : 
                    selectedOption === 'upload' ? 'Upload a video' : 
                    'Generate with AI'}
                </h2>
              </div>
              <div style={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <button className="close-button-apple" onClick={onClose} style={{ position: 'static' }} disabled={false}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <motion.div 
              className="upload-modal-content-apple"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
            >
              {!selectedOption ? (
                /* Option Selection */
                <div className="upload-options-apple">
                  <motion.div 
                    className="upload-option-apple upload-option-camera"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedOption('upload')}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="option-visual">
                      <div className="option-icon-apple camera-icon">
                        <Camera size={24} />
                      </div>
                      <div className="option-glow camera-glow"></div>
                    </div>
                    <div className="option-content-apple">
                      <h3>Upload a video</h3>
                      <p>Select from your device</p>
                    </div>
                    <div className="option-arrow">→</div>
                  </motion.div>

                  <motion.div 
                    className="upload-option-apple upload-option-ai"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedOption('ai')}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="option-visual">
                      <div className="option-icon-apple ai-icon">
                        <Sparkles size={24} />
                      </div>
                      <div className="option-glow ai-glow"></div>
                    </div>
                    <div className="option-content-apple">
                      <h3>Generate with AI</h3>
                      <p>Create from a description</p>
                      <div className="ai-pricing">
                        <span>21 credits (5s) • 42 credits (10s)</span>
                      </div>
                    </div>
                    <div className="option-arrow">→</div>
                  </motion.div>
                </div>
              ) : selectedOption === 'upload' ? (
                selectedFile && videoPreview ? (
                  <motion.div className="video-preview-upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="preview-video-wrapper-short">
                      <video src={videoPreview} controls className="preview-video-short" />
                    </div>
                    <div className="actions-minimal" style={{ display: 'flex', gap: 16 }}>
                      <button className="claim-button cancel" onClick={handleCancelPreview}>Cancel</button>
                      <button className="claim-button" onClick={handlePublishPreview}>Publish</button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div className="upload-section-apple" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
                    <div className="upload-area-apple" onClick={handleFileSelect}>
                      <div className="upload-icon-container">
                        <Upload size={32} />
                      </div>
                      <h3>Select a video</h3>
                      <p>MP4, AVI, MOV • Max 50MB • 3 min max</p>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      style={{ display: 'none' }}
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </motion.div>
                )
              ) : (
                /* AI Generation with new design */
                <motion.div 
                  className="ai-section-apple-refined"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Credits section - Apple minimalist design */}
                  <div className="ai-credits-section">
                    <div className="credits-balance-display">
                      <div className="balance-row">
                        <span className="balance-label">Balance</span>
                        <div className="balance-value-group">
                          <Sparkles size={16} className="credits-icon-subtle" />
                          <span className="balance-number">{loadingCredits ? '...' : credits}</span>
                          <span className="balance-unit">credits</span>
                        </div>
                      </div>
                      
                      {credits < getGenerationCost(selectedDuration) && (
                        <motion.button 
                          className="get-credits-button"
                          onClick={() => setShowCreditPurchase(true)}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          Get credits
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Duration selection - Simplified Apple design */}
                  <div className="duration-selector-refined">
                    <label className="selector-label">Duration</label>
                    <div className="duration-options-refined">
                      <motion.button
                        className={`duration-option ${selectedDuration === 5 ? 'selected' : ''}`}
                        onClick={() => setSelectedDuration(5)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="duration-value">5</span>
                        <span className="duration-unit">sec</span>
                        <span className="duration-price">21 credits</span>
                      </motion.button>
                      <motion.button
                        className={`duration-option ${selectedDuration === 10 ? 'selected' : ''}`}
                        onClick={() => setSelectedDuration(10)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="duration-value">10</span>
                        <span className="duration-unit">sec</span>
                        <span className="duration-price">42 credits</span>
                      </motion.button>
                    </div>
                  </div>

                  {/* Prompt area - Clean design */}
                  <div className="prompt-section-refined">
                    <label className="prompt-label">Description</label>
                    <div className="prompt-container-refined">
                      <textarea
                        value={aiPrompt}
                        onChange={handleTextInput}
                        onInput={handleTextInput}
                        onKeyDown={handleTextKeyDown}
                        placeholder="Describe the video you want to create..."
                        rows={4}
                        maxLength={1000}
                        className="prompt-textarea-simplified"
                        disabled={isGenerating}
                      />
                      <div className="prompt-footer">
                        <span className="character-count">
                          {aiPrompt.length}/1000
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Generation button - Apple style */}
                  <motion.button 
                    className={`generate-button-refined ${!aiPrompt.trim() || isGenerating || credits < getGenerationCost(selectedDuration) ? 'disabled' : ''}`}
                    onClick={handleAIGenerate}
                    disabled={!aiPrompt.trim() || isGenerating || credits < getGenerationCost(selectedDuration)}
                    whileHover={!isGenerating && aiPrompt.trim() && credits >= getGenerationCost(selectedDuration) ? { scale: 1.01 } : {}}
                    whileTap={!isGenerating && aiPrompt.trim() && credits >= getGenerationCost(selectedDuration) ? { scale: 0.99 } : {}}
                  >
                    {isGenerating ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="generating-icon"
                        >
                          <Sparkles size={18} />
                        </motion.div>
                        <span>Generating...</span>
                      </>
                    ) : credits < getGenerationCost(selectedDuration) ? (
                      <>
                        <Coins size={18} />
                        <span>Insufficient credits</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>Generate video</span>
                        <span className="button-cost">{getGenerationCost(selectedDuration)} credits</span>
                      </>
                    )}
                  </motion.button>
                </motion.div>
              )}
            </motion.div>

            {/* Upload Progress */}
            <AnimatePresence>
              {(isUploading || uploadStatus) && (
                <motion.div 
                  className="upload-progress-section-apple"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="upload-status-apple">{uploadStatus}</div>
                  {uploadProgress > 0 && (
                    <div className="progress-bar-apple">
                      <motion.div 
                        className="progress-fill-apple"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Credit Purchase Card Modal */}
            <CreditPurchaseCard
              isOpen={showCreditPurchase}
              onClose={() => setShowCreditPurchase(false)}
              credits={credits}
              onPurchase={handleCreditPurchase}
              isLoading={creditPurchaseLoading}
              compact={true}
            />

            {/* Notifications */}
            <AnimatePresence>
              {notification.show && (
                <motion.div 
                  className={`notification-modal ${notification.type}`}
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                >
                  {notification.message}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadModal; 
 