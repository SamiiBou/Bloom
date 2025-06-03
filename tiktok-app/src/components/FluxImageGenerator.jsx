import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Wand2, 
  Upload, 
  Download, 
  Settings, 
  History, 
  Eye, 
  Trash2, 
  Share, 
  Copy,
  Palette,
  Image as ImageIcon,
  RefreshCw,
  Zap,
  Crown,
  Clock,
  DollarSign,
  Coins,
  AlertCircle,
  Check
} from 'lucide-react';
import apiService from '../services/api';
import PublishModal from './PublishModal';
import axios from "axios";
import { MiniKit, ResponseEvent } from "@worldcoin/minikit-js";
import './FluxImageGenerator.css';
import CreditPurchaseCard from './CreditPurchaseCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://d8a0e486e7eb.ngrok.app/api';
const BACKEND_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

const FluxImageGenerator = () => {
  // States pour l'interface
  const [activeTab, setActiveTab] = useState('generate'); // generate, edit, history
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // States pour la génération
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('flux-pro-1.1');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(3.5);
  const [seed, setSeed] = useState('');
  const [promptUpsampling, setPromptUpsampling] = useState(false);
  
  // States pour l'édition
  const [editPrompt, setEditPrompt] = useState('');
  const [sourceImage, setSourceImage] = useState(null);
  const [sourceImageBase64, setSourceImageBase64] = useState('');
  const [editModel, setEditModel] = useState('flux-pro-1.1-kontext');
  
  // States pour les tâches
  const [currentTask, setCurrentTask] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  
  // States pour l'interface
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // NOUVEAU: States pour les crédits
  const [credits, setCredits] = useState(0);
  const [showCreditPurchase, setShowCreditPurchase] = useState(false);
  const [creditPurchaseLoading, setCreditPurchaseLoading] = useState(false);
  const [creditAmountToBuy, setCreditAmountToBuy] = useState(35);
  const [token, setToken] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [paymentAddress, setPaymentAddress] = useState('');
  
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Charger la configuration au montage
  useEffect(() => {
    loadConfig();
    loadHistory();
    loadStats();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // NOUVEAU: Initialisation des données utilisateur et crédits
  useEffect(() => {
    // Retrieve JWT token from localStorage
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('auth_token'); 
    if (storedToken) {
      setToken(storedToken);
      console.log('[FluxImageGenerator] Token found:', storedToken.substring(0, 10) + '...');
    }
  }, []);

  // Auto-refresh when token becomes available
  useEffect(() => {
    if (token) {
      console.log('🔄 [FluxImageGenerator] Token available, loading user credits...');
      loadUserCredits();
    }
  }, [token]);

  // NOUVEAU: Fonction pour charger les crédits de l'utilisateur
  const loadUserCredits = async () => {
    try {
      if (!token) return;
      const response = await axios.get(
        `${BACKEND_URL}/users/credits`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );
      if (response.data && response.data.data) {
        setCredits(response.data.data.credits || 0);
      }
    } catch (error) {
      console.error('Failed to load user credits:', error);
    }
  };

  // NOUVEAU: Fonction pour acheter des crédits
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

      // Initiate the purchase
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

      // Prepare the payload for World Pay
      const payload = {
        reference: reference,
        to: paymentAddress,
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
        
        // Confirm the purchase with the backend
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
          setShowCreditPurchase(false); // Close the purchase interface
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
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 5000);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await apiService.getFluxConfig();
      if (response.status === 'success') {
        setConfig(response.data);
        // Set default model based on available models
        const textToImageModels = response.data.models.filter(m => m.type === 'text-to-image');
        if (textToImageModels.length > 0) {
          setSelectedModel(textToImageModels[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading FLUX config:', error);
      setError('Error loading FLUX config');
    }
  };

  const loadHistory = async () => {
    try {
      const response = await apiService.getFluxTasks({ page: 1, limit: 20 });
      if (response.status === 'success') {
        setHistory(response.data.images || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
      // Ne pas afficher d'erreur pour l'historique, juste un log
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.getFluxStats('month');
      if (response.status === 'success') {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      // Utiliser des stats par défaut si l'API échoue
      setStats({
        totalGenerations: 0,
        successfulGenerations: 0,
        failedGenerations: 0,
        totalCost: 0,
        avgProcessingTime: 0
      });
    }
  };

  const showMessage = useCallback((message, type = 'error') => {
    if (type === 'error') {
      setError(message);
      setTimeout(() => setError(''), 5000);
    } else {
      setSuccess(message);
      setTimeout(() => setSuccess(''), 5000);
    }
  }, []);

  const generateImage = async () => {
    if (!prompt.trim()) {
      showMessage('Please enter a description');
      return;
    }

    // NOUVEAU: Vérifier les crédits avant la génération
    const requiredCredits = 5;
    if (credits < requiredCredits) {
      showMessage(`You need ${requiredCredits} credits to generate an image. You have ${credits} credits.`);
      setShowCreditPurchase(true);
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedImage(null);

    try {
      const params = {
        promptText: prompt,
        model: selectedModel,
        aspectRatio: aspectRatio,
        steps: parseInt(steps),
        guidance: parseFloat(guidance),
        promptUpsampling: promptUpsampling
      };

      if (seed && seed.trim()) {
        params.seed = parseInt(seed);
      }

      const response = await apiService.generateFluxImage(params);
      
      if (response.status === 'success') {
        const taskData = response.data;
        setCurrentTask(taskData);
        
        // NOUVEAU: Mettre à jour les crédits après succès
        if (taskData.remainingCredits !== undefined) {
          setCredits(taskData.remainingCredits);
        }
        
        showMessage(`🎨 Generation started! ${taskData.creditsUsed} credits used. Please wait...`, 'success');
        startPolling(taskData.taskId);
      } else {
        throw new Error(response.message || 'Generation failed');
      }
    } catch (error) {
      console.error('Generation error:', error);
      
      // NOUVEAU: Gérer l'erreur de crédits insuffisants
      if (error.response?.status === 402) {
        const errorData = error.response.data;
        showMessage(`Insufficient credits! You have ${errorData.data?.available || 0} credits, ${errorData.data?.required || 5} required.`);
        setShowCreditPurchase(true);
      } else {
        showMessage(error.message || 'Error generating');
      }
      setLoading(false);
    }
  };

  const editImage = async () => {
    if (!editPrompt.trim()) {
      showMessage('Please enter a description of the modifications');
      return;
    }

    if (!sourceImageBase64) {
      showMessage('Please select an image to edit');
      return;
    }

    // NOUVEAU: Vérifier les crédits avant l'édition
    const requiredCredits = 5;
    if (credits < requiredCredits) {
      showMessage(`You need ${requiredCredits} credits to edit an image. You have ${credits} credits.`);
      setShowCreditPurchase(true);
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedImage(null);

    try {
      const params = {
        promptText: editPrompt,
        imageBase64: sourceImageBase64,
        model: editModel,
        aspectRatio: aspectRatio
      };

      const response = await apiService.editFluxImage(params);
      
      if (response.status === 'success') {
        const taskData = response.data;
        setCurrentTask(taskData);
        
        // NOUVEAU: Mettre à jour les crédits après succès
        if (taskData.remainingCredits !== undefined) {
          setCredits(taskData.remainingCredits);
        }
        
        showMessage(`✨ Editing started! ${taskData.creditsUsed} credits used. Please wait...`, 'success');
        startPolling(taskData.taskId);
      } else {
        throw new Error(response.message || 'Edit failed');
      }
    } catch (error) {
      console.error('Edit error:', error);
      
      // NOUVEAU: Gérer l'erreur de crédits insuffisants
      if (error.response?.status === 402) {
        const errorData = error.response.data;
        showMessage(`Insufficient credits! You have ${errorData.data?.available || 0} credits, ${errorData.data?.required || 5} required.`);
        setShowCreditPurchase(true);
      } else {
        showMessage(error.message || 'Error editing');
      }
      setLoading(false);
    }
  };

  const startPolling = (taskId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    let attempts = 0;
    const maxAttempts = 100; // 5 minutes max (100 * 3 seconds)

    const poll = async () => {
      try {
        attempts++;
        
        const response = await apiService.checkFluxTaskStatus(taskId);
        
        if (response.status === 'success') {
          const task = response.data.task;
          
          if (task.status === 'SUCCEEDED') {
            clearInterval(pollIntervalRef.current);
            setGeneratedImage(task);
            setLoading(false);
            setShowPreview(true);
            showMessage('✅ Image generated successfully!', 'success');
            loadHistory(); // Refresh history
          } else if (task.status === 'FAILED') {
            clearInterval(pollIntervalRef.current);
            setLoading(false);
            showMessage(task.error || 'Generation failed');
          } else if (attempts >= maxAttempts) {
            clearInterval(pollIntervalRef.current);
            setLoading(false);
            showMessage('⏰ Timeout: Generation taking too long. Check your history later.');
          }
          // Continue polling if PENDING or RUNNING
        }
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
        
        if (attempts >= maxAttempts) {
          clearInterval(pollIntervalRef.current);
          setLoading(false);
          showMessage('❌ Error checking status. Check your history later.');
        }
        // Continue polling even in case of occasional error
      }
    };

    // First immediate call
    poll();
    
    // Then polling every 3 seconds
    pollIntervalRef.current = setInterval(poll, 3000);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showMessage('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showMessage('Image must not exceed 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target.result;
      setSourceImage(imageDataUrl);
      setSourceImageBase64(imageDataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const publishImage = () => {
    if (!generatedImage?.id) return;
    setShowPublishModal(true);
  };

  // Handle publish from modal
  const handlePublishImage = async (publishData) => {
    if (!generatedImage?.id) return;

    try {
      setPublishing(true);
      
      const imageData = {
        title: '', // No title to avoid duplication with description
        description: publishData.caption || `Generated with ${generatedImage.model}: ${activeTab === 'generate' ? prompt : editPrompt}`,
        hashtags: publishData.hashtags.length > 0 ? publishData.hashtags : ['ai', 'flux', 'generated', 'art']
      };

      const response = await apiService.publishFluxImage(generatedImage.id, imageData);
      
      if (response.status === 'success') {
        showMessage('✅ Image published successfully!', 'success');
        setShowPublishModal(false);
        setShowPreview(false);
        setGeneratedImage(null);
        loadHistory();
      } else {
        throw new Error(response.message || 'Publish failed');
      }
    } catch (error) {
      console.error('Publish error:', error);
      showMessage(error.message || 'Error publishing');
    } finally {
      setPublishing(false);
    }
  };

  const handleCancelPublish = () => {
    setShowPublishModal(false);
  };

  const rejectImage = async () => {
    if (!generatedImage?.id) return;

    try {
      await apiService.rejectFluxImage(generatedImage.id);
      showMessage('✅ Image deleted', 'success');
      setShowPreview(false);
      setGeneratedImage(null);
      loadHistory(); // Refresh history
    } catch (error) {
      console.error('Reject error:', error);
      showMessage(error.message || 'Error deleting');
    }
  };

  const copyPrompt = async (promptText) => {
    try {
      await navigator.clipboard.writeText(promptText);
      showMessage('�� Prompt copied!', 'success');
    } catch (error) {
      showMessage('Error copying');
    }
  };

  const getModelPricing = (modelId) => {
    if (!config) return '?';
    const model = config.models.find(m => m.id === modelId);
    return model ? `${model.pricing?.standard || 0}¢` : '?¢';
  };

  const getEstimatedCost = () => {
    if (!config) return '?';
    const model = config.models.find(m => m.id === (activeTab === 'generate' ? selectedModel : editModel));
    return model ? `$${(model.pricing?.standard || 0) / 100}` : '$?';
  };

  // Valeurs par défaut pour la configuration si elle n'est pas chargée
  const defaultConfig = {
    models: [
      {
        id: 'flux-pro-1.1',
        name: 'FLUX.1.1 [pro]',
        type: 'text-to-image',
        pricing: { standard: 3 }
      },
      {
        id: 'flux-pro',
        name: 'FLUX.1 [pro]', 
        type: 'text-to-image',
        pricing: { standard: 5 }
      },
      {
        id: 'flux-pro-1.1-kontext',
        name: 'FLUX.1 Kontext [pro]',
        type: 'image-to-image',
        pricing: { standard: 6 }
      }
    ],
    aspectRatios: [
      { id: '1:1', name: '1:1 Square' },
      { id: '16:9', name: '16:9 Landscape' },
      { id: '9:16', name: '9:16 Portrait' },
      { id: '4:3', name: '4:3 Landscape' },
      { id: '3:4', name: '3:4 Portrait' }
    ],
    stepRanges: {
      'flux-pro-1.1': { recommended: 25 },
      'flux-pro': { recommended: 30 }
    },
    guidanceRanges: {
      'flux-pro-1.1': { recommended: 3.5 },
      'flux-pro': { recommended: 3.5 }
    }
  };

  const activeConfig = config || defaultConfig;

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

  return (
    <div className="flux-image-generator">
      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div 
            className="message error-message"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            {error}
          </motion.div>
        )}
        
        {success && (
          <motion.div 
            className="message success-message"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOUVEAU: Affichage des crédits et interface d'achat */}
      <div className="credits-section">
        <div className="credits-header">
          <div className="credits-display">
            <Coins size={20} className="credits-icon" />
            <span className="credits-count">{credits}</span>
            <span className="credits-label">credits</span>
          </div>
          <div className="credits-info">
            <span className="generation-cost">5 credits per image</span>
          </div>
        </div>

        {!showCreditPurchase ? (
          <button 
            className="buy-credits-trigger"
            onClick={() => setShowCreditPurchase(true)}
          >
            <Sparkles size={16} />
            <span>Buy credits</span>
          </button>
        ) : (
          <CreditPurchaseCard
            isOpen={showCreditPurchase}
            onClose={() => setShowCreditPurchase(false)}
            credits={credits}
            onPurchase={buyCredits}
            isLoading={creditPurchaseLoading}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="flux-tabs">
        {[
          { id: 'generate', label: 'Generate', icon: Sparkles, enabled: true },
          { id: 'edit', label: 'Soon - Edit', icon: Wand2, enabled: false },
          { id: 'history', label: 'History', icon: History, enabled: true }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''} ${!tab.enabled ? 'disabled' : ''}`}
              onClick={() => tab.enabled && setActiveTab(tab.id)}
              whileHover={tab.enabled ? { scale: 1.05 } : {}}
              whileTap={tab.enabled ? { scale: 0.95 } : {}}
              disabled={!tab.enabled}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flux-content">
        <AnimatePresence mode="wait">
          {activeTab === 'generate' && (
            <motion.div 
              key="generate"
              className="tab-content"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="generate-form">
                {/* Prompt Input */}
                <div className="form-group">
                  <label className="form-label">
                    <Palette size={16} />
                    Image description *
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the image you want to generate..."
                    className="form-textarea"
                    rows="4"
                    maxLength="1000"
                  />
                  <div className="char-count">{prompt.length}/1000</div>
                </div>

                {/* Generate Button */}
                <div className="form-footer">
                  <motion.button
                    onClick={generateImage}
                    disabled={loading || !prompt.trim()}
                    className="generate-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={20} className="spinning" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        Generate image
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* L'onglet edit est désactivé et ne sera pas affiché */}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              className="tab-content"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="history-content">
                {history.length === 0 ? (
                  <div className="empty-history">
                    <ImageIcon size={64} />
                    <h3>No generations</h3>
                    <p>Your generated images will appear here</p>
                  </div>
                ) : (
                  <div className="history-grid">
                    {history.map((item) => (
                      <motion.div
                        key={item._id}
                        className="history-item"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt="Generated" className="history-image" />
                        )}
                        
                        <div className="history-info">
                          <div className="history-prompt">
                            "{item.promptText.substring(0, 60)}..."
                          </div>
                          
                          <div className="history-actions">
                            <button
                              onClick={() => copyPrompt(item.promptText)}
                              className="action-button"
                              title="Copy prompt"
                            >
                              <Copy size={16} />
                            </button>
                            
                            {item.imageUrl && (
                              <a
                                href={item.imageUrl}
                                download
                                className="action-button"
                                title="Download"
                              >
                                <Download size={16} />
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && generatedImage && (
          <motion.div 
            className="preview-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPreview(false)}
          >
            <motion.div 
              className="preview-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="preview-header">
                <h3>Generated image preview</h3>
                <button 
                  className="close-button"
                  onClick={() => setShowPreview(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="preview-content">
                <img 
                  src={generatedImage.imageUrl} 
                  alt="Generated" 
                  className="preview-image" 
                />
                
                <div className="preview-info">
                  <div className="info-grid">
                    <div className="info-item">
                      <span>Model:</span>
                      <span>{generatedImage.model}</span>
                    </div>
                    <div className="info-item">
                      <span>Cost:</span>
                      <span>${generatedImage.costInDollars}</span>
                    </div>
                    <div className="info-item">
                      <span>Time:</span>
                      <span>{generatedImage.processingTime}s</span>
                    </div>
                    <div className="info-item">
                      <span>Dimensions:</span>
                      <span>{generatedImage.dimensions?.width}×{generatedImage.dimensions?.height}</span>
                    </div>
                  </div>
                  
                  <div className="preview-prompt">
                    <strong>Prompt:</strong> "{activeTab === 'generate' ? prompt : editPrompt}"
                  </div>
                </div>
              </div>
              
              <div className="preview-actions">
                <motion.button
                  onClick={rejectImage}
                  className="action-button reject-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Trash2 size={16} />
                  Delete
                </motion.button>
                
                <motion.a
                  href={generatedImage.imageUrl}
                  download={`flux-generated-${generatedImage.id}.jpg`}
                  className="action-button download-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Download image"
                >
                  <Download size={16} />
                  Download
                </motion.a>
                
                <motion.button
                  onClick={publishImage}
                  className="action-button publish-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Share size={16} />
                  Publish
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            className="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="loading-content">
              <motion.div
                className="loading-spinner"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles size={48} />
              </motion.div>
              <h3>Generating...</h3>
              <p>This can take 10 to 30 seconds</p>
              {currentTask && (
                <div className="task-info">
                  <p>Model: {currentTask.model}</p>
                  <p>Type: {currentTask.type}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Publish Modal */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={handleCancelPublish}
        onPublish={handlePublishImage}
        imagePreview={generatedImage?.imageUrl}
        isPublishing={publishing}
        initialText={activeTab === 'generate' ? prompt : editPrompt}
      />

      {/* NOUVEAU: Notification pour les crédits */}
      {notification.show && (
        <div className={`notification-credits ${notification.type}`}>
          {notification.type === 'error' && <AlertCircle size={16} />}
          {notification.type === 'success' && <Check size={16} />}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default FluxImageGenerator;