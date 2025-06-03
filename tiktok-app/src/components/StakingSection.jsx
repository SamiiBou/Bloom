import React, { useState, useEffect } from 'react';
import { MiniKit, ResponseEvent } from "@worldcoin/minikit-js";
import { ethers, formatUnits, parseUnits } from 'ethers';
import { 
  Lock, 
  Unlock, 
  Timer, 
  TrendingUp, 
  AlertTriangle,
  RefreshCw,
  Calendar,
  Coins,
  Shield,
  Clock
} from 'lucide-react';
import stakingAbi from '../abi/TokenStaking.json';
import permit2Abi from '../abi/Permit2.json';

// Configuration des contrats
const STAKING_CONTRACT_ADDRESS = '0x30331E4E1D10B9737aA2A85d32E3C7Dd4e2B72ee';
const TOKEN_CONTRACT_ADDRESS = '0x8b2D045381c7B9E09dC72fc3DDEbC1c74724E78D';
const PERMIT2_CONTRACT_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const StakingSection = ({ walletAddress, userBalance, refreshBalance }) => {
  // États pour le staking
  const [stakes, setStakes] = useState([]);
  const [userStats, setUserStats] = useState({
    totalStaked: 0,
    totalWithdrawn: 0,
    stakeCount: 0
  });
  const [lockPeriods, setLockPeriods] = useState([]);
  const [minimumStakeAmount, setMinimumStakeAmount] = useState(0);
  
  // États pour l'interface
  const [isLoading, setIsLoading] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedLockPeriod, setSelectedLockPeriod] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  // États pour le refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Setup MiniKit event handlers
  useEffect(() => {
    if (!MiniKit.isInstalled()) return;

    const unsubscribe = MiniKit.subscribe(
      ResponseEvent.MiniAppSendTransaction,
      async (payload) => {
        console.log('[Staking] Transaction response:', payload);
        
        if (payload.status === "success") {
          console.log('[Staking] Transaction successful:', payload.transaction_id);
          setNotification({ 
            show: true, 
            message: "Transaction réussie ! Actualisation des données...", 
            type: "success" 
          });
          
          // Rafraîchir les données après succès
          setTimeout(() => {
            loadStakingData();
            if (refreshBalance) refreshBalance();
          }, 3000);
        } else {
          console.error('[Staking] Transaction failed:', payload);

          const { error_code, revert_reason, debug_url } = payload;
          const friendlyMsg =
            revert_reason || error_code || 'Transaction annulée ou échouée';

          setNotification({
            show: true,
            message: friendlyMsg,
            type: 'error',
          });

          if (debug_url) window.open(debug_url, '_blank');
        }
        setIsLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Charger les données de staking au montage
  useEffect(() => {
    if (walletAddress) {
      loadStakingData();
    }
  }, [walletAddress]);

  // Fonction pour charger toutes les données de staking
  const loadStakingData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadUserStakes(),
        loadUserStats(),
        loadLockPeriods(),
        loadMinimumStakeAmount()
      ]);
    } catch (error) {
      console.error('[Staking] Error loading data:', error);
      showNotification("Erreur lors du chargement des données de staking", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Charger les stakes de l'utilisateur
  const loadUserStakes = async () => {
    try {
      if (!walletAddress) return;

      console.log('[Staking] Loading user stakes for:', walletAddress);
      
      const response = await MiniKit.commandsAsync.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: stakingAbi,
        functionName: 'getUserStakes',
        args: [walletAddress]
      });

      console.log('[Staking] User stakes response:', response);

      if (response && response.finalPayload) {
        const [amounts, timestamps, lockPeriods, unlockTimes, withdrawn, canWithdraw] = response.finalPayload;
        
        const formattedStakes = amounts.map((amount, index) => ({
          id: index,
          amount: parseFloat(formatUnits(amount.toString(), 18)),
          timestamp: parseInt(timestamps[index].toString()),
          lockPeriod: parseInt(lockPeriods[index].toString()),
          unlockTime: parseInt(unlockTimes[index].toString()),
          withdrawn: withdrawn[index],
          canWithdraw: canWithdraw[index]
        }));

        setStakes(formattedStakes);
        console.log('[Staking] Formatted stakes:', formattedStakes);
      }
    } catch (error) {
      console.error('[Staking] Error loading user stakes:', error);
    }
  };

  // Charger les statistiques utilisateur
  const loadUserStats = async () => {
    try {
      if (!walletAddress) return;

      const response = await MiniKit.commandsAsync.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: stakingAbi,
        functionName: 'userStats',
        args: [walletAddress]
      });

      if (response && response.finalPayload) {
        const [totalStaked, totalWithdrawn, stakeCount] = response.finalPayload;
        
        setUserStats({
          totalStaked: parseFloat(formatUnits(totalStaked.toString(), 18)),
          totalWithdrawn: parseFloat(formatUnits(totalWithdrawn.toString(), 18)),
          stakeCount: parseInt(stakeCount.toString())
        });
      }
    } catch (error) {
      console.error('[Staking] Error loading user stats:', error);
    }
  };

  // Charger les périodes de lock disponibles
  const loadLockPeriods = async () => {
    try {
      console.log('[Staking] Loading lock periods...');
      const response = await MiniKit.commandsAsync.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: stakingAbi,
        functionName: 'getValidLockPeriods',
        args: []
      });

      if (response && response.finalPayload) {
        const [periods, labels] = response.finalPayload;
        
        const formattedPeriods = periods.map((period, index) => ({
          value: period.toString(),
          label: labels[index],
          seconds: parseInt(period.toString())
        }));

        setLockPeriods(formattedPeriods);
        console.log('[Staking] Lock periods loaded:', formattedPeriods);
      }
    } catch (error) {
      console.error('[Staking] Error loading lock periods:', error);
      // Fallback avec des périodes par défaut si le contrat ne répond pas
      const fallbackPeriods = [
        { value: '86400', label: '1 Jour', seconds: 86400 },
        { value: '604800', label: '1 Semaine', seconds: 604800 },
        { value: '2592000', label: '30 Jours', seconds: 2592000 },
        { value: '7776000', label: '90 Jours', seconds: 7776000 }
      ];
      setLockPeriods(fallbackPeriods);
      console.log('[Staking] Using fallback lock periods:', fallbackPeriods);
    }
  };

  // Charger le montant minimum de stake
  const loadMinimumStakeAmount = async () => {
    try {
      const response = await MiniKit.commandsAsync.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: stakingAbi,
        functionName: 'minimumStakeAmount',
        args: []
      });

      if (response && response.finalPayload) {
        const minimum = parseFloat(formatUnits(response.finalPayload.toString(), 18));
        setMinimumStakeAmount(minimum);
        console.log('[Staking] Minimum stake amount:', minimum);
      }
    } catch (error) {
      console.error('[Staking] Error loading minimum stake amount:', error);
    }
  };

  // Fonction pour staker des tokens avec Permit2
  const stakeTokensWithPermit2 = async () => {
    try {
      const amount = parseFloat(stakeAmount);
      
      // Validations
      if (!amount || amount <= 0) {
        showNotification("Veuillez entrer un montant valide", "error");
        return;
      }

      if (amount < minimumStakeAmount) {
        showNotification(`Le montant minimum de stake est de ${minimumStakeAmount} tokens`, "error");
        return;
      }

      if (amount > userBalance) {
        showNotification("Solde insuffisant", "error");
        return;
      }

      if (!selectedLockPeriod) {
        showNotification("Veuillez sélectionner une période de verrouillage", "error");
        return;
      }

      setIsLoading(true);
      showNotification("Préparation du staking avec Permit2...", "info");

      console.log('[Staking] Starting stake process:', { amount, selectedLockPeriod });

      const amountWei = parseUnits(amount.toString(), 18);

      // Créer le permit transfer pour Permit2
      const permitTransfer = {
        permitted: {
          token: TOKEN_CONTRACT_ADDRESS,
          amount: amountWei.toString(),
        },
        nonce: Date.now().toString(),
        deadline: Math.floor((Date.now() + 30 * 60 * 1000) / 1000).toString(), // 30 minutes
      };

      console.log('[Staking] Permit transfer:', permitTransfer);

      const transferDetails = {
        to: STAKING_CONTRACT_ADDRESS,
        requestedAmount: amountWei.toString(),
      };

      // Transaction atomique : Permit2 + Stake
      const response = await MiniKit.commandsAsync.sendTransaction({
        formatPayload: false, 
        transaction: [
          {
            // 1. Permit2 signature transfer
            address: PERMIT2_CONTRACT_ADDRESS,
            abi: permit2Abi,
            functionName: 'signatureTransfer',
            args: [
              [
                [permitTransfer.permitted.token, permitTransfer.permitted.amount],
                permitTransfer.nonce,
                permitTransfer.deadline,
              ],
              [transferDetails.to, transferDetails.requestedAmount],
              'PERMIT2_SIGNATURE_PLACEHOLDER_0', // Sera remplacé par la signature
            ],
          },
          {
            // 2. Appel de la fonction stake
            address: STAKING_CONTRACT_ADDRESS,
            abi: stakingAbi,
            functionName: 'stake',
            args: [amountWei.toString(), selectedLockPeriod],
          },
        ],
        permit2: [
          {
            ...permitTransfer,
            spender: STAKING_CONTRACT_ADDRESS,
          },
        ],
      });

      console.log('[Staking] Transaction response:', response);

      const { finalPayload } = response;

      if (finalPayload?.status === 'error') {
        // 1. Log complet dans la console pour le debug
        console.group('[Staking] Detailed TX error');
        console.log(JSON.stringify(finalPayload, null, 2));
        console.groupEnd();

        // 2. Récupère les champs intéressants
        const { error_code, revert_reason, debug_url } = finalPayload;

        // 3. Compose un message lisible pour l'utilisateur
        const friendlyMsg =
          revert_reason || error_code || 'Transaction échouée (raison inconnue)';

        // 4. Affiche dans ta bannière de notifications
        showNotification(`Erreur : ${friendlyMsg}`, 'error');

        // 5. Ouvre Tenderly dans un nouvel onglet si dispo
        if (debug_url) window.open(debug_url, '_blank');

        // 6. Sort de la fonction pour ne pas continuer
        setIsLoading(false);
        return;
      }

      showNotification("Staking réussi !", "success");
      setShowStakeModal(false);
      setStakeAmount('');
      setSelectedLockPeriod('');

    } catch (error) {
      console.error('[Staking] Stake error:', error);
      showNotification(`Échec du staking : ${error.message}`, "error");
      setIsLoading(false);
    }
  };

  // Fonction pour retirer un stake
  const withdrawStake = async (stakeId) => {
    try {
      setIsLoading(true);
      showNotification("Retrait du stake en cours...", "info");

      const response = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: STAKING_CONTRACT_ADDRESS,
            abi: stakingAbi,
            functionName: 'withdraw',
            args: [stakeId.toString()]
          }
        ]
      });

      console.log('[Staking] Withdraw response:', response);

      if (response.finalPayload?.status === "error") {
        throw new Error(response.finalPayload.message || "Échec du retrait");
      }

      showNotification("Retrait réussi !", "success");

    } catch (error) {
      console.error('[Staking] Withdraw error:', error);
      showNotification(`Échec du retrait : ${error.message}`, "error");
      setIsLoading(false);
    }
  };

  // Fonction pour le retrait d'urgence
  const emergencyWithdraw = async (stakeId) => {
    try {
      const confirmed = window.confirm(
        "Le retrait d'urgence entraînera une pénalité de 50%. Êtes-vous sûr de vouloir continuer ?"
      );
      
      if (!confirmed) return;

      setIsLoading(true);
      showNotification("Traitement du retrait d'urgence...", "info");

      const response = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: STAKING_CONTRACT_ADDRESS,
            abi: stakingAbi,
            functionName: 'emergencyWithdraw',
            args: [stakeId.toString()]
          }
        ]
      });

      if (response.finalPayload?.status === "error") {
        throw new Error(response.finalPayload.message || "Échec du retrait d'urgence");
      }

      showNotification("Retrait d'urgence réussi !", "success");

    } catch (error) {
      console.error('[Staking] Emergency withdraw error:', error);
      showNotification(`Échec du retrait d'urgence : ${error.message}`, "error");
      setIsLoading(false);
    }
  };

  // Fonction pour afficher une notification
  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'info' });
    }, 5000);
  };

  // Fonction pour formater les dates
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fonction pour formater la durée
  const formatDuration = (seconds) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    if (days >= 365) {
      return `${Math.floor(days / 365)} année${Math.floor(days / 365) > 1 ? 's' : ''}`;
    } else if (days >= 30) {
      return `${Math.floor(days / 30)} mois`;
    } else {
      return `${days} jour${days > 1 ? 's' : ''}`;
    }
  };

  // Gérer les changements dans l'input de montant
  const handleAmountChange = (e) => {
    const value = e.target.value;
    // Permettre seulement les nombres avec point décimal
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setStakeAmount(value);
    }
  };

  // Gérer la sélection de la période de lock
  const handleLockPeriodSelect = (periodValue) => {
    console.log('[Staking] Period selected:', periodValue);
    console.log('[Staking] Current selectedLockPeriod:', selectedLockPeriod);
    setSelectedLockPeriod(periodValue);
    console.log('[Staking] New selectedLockPeriod will be:', periodValue);
  };

  // Gérer l'ouverture du modal
  const handleOpenModal = () => {
    setShowStakeModal(true);
    setStakeAmount('');
    setSelectedLockPeriod('');
  };

  // Gérer la fermeture du modal
  const handleCloseModal = () => {
    setShowStakeModal(false);
    setStakeAmount('');
    setSelectedLockPeriod('');
  };

  return (
    <div className="staking-section">
      {/* Header avec statistiques */}
      <div className="staking-header">
        <div className="staking-title">
          <Lock size={24} />
          <h3>Staking de Tokens</h3>
          <button 
            onClick={loadStakingData} 
            disabled={isRefreshing}
            className="refresh-btn"
            type="button"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} />
          </button>
        </div>
        
        <div className="staking-stats">
          <div className="stat-card">
            <Shield size={20} />
            <div>
              <span className="stat-value">{userStats.totalStaked.toFixed(2)}</span>
              <span className="stat-label">Stakés</span>
            </div>
          </div>
          <div className="stat-card">
            <TrendingUp size={20} />
            <div>
              <span className="stat-value">{userStats.totalWithdrawn.toFixed(2)}</span>
              <span className="stat-label">Retirés</span>
            </div>
          </div>
          <div className="stat-card">
            <Calendar size={20} />
            <div>
              <span className="stat-value">{userStats.stakeCount}</span>
              <span className="stat-label">Stakes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bouton pour créer un nouveau stake */}
      <button 
        onClick={handleOpenModal}
        className="stake-new-btn"
        disabled={isLoading}
        type="button"
      >
        <Lock size={16} />
        Staker des Tokens (Permit2)
      </button>

      {/* Liste des stakes existants */}
      <div className="stakes-list">
        {stakes.length === 0 ? (
          <div className="no-stakes">
            <Lock size={48} />
            <p>Aucun stake pour le moment</p>
            <p>Stakez vos tokens pour gagner des récompenses et soutenir le réseau</p>
          </div>
        ) : (
          stakes.map((stake) => (
            <div key={stake.id} className="stake-card">
              <div className="stake-header">
                <div className="stake-amount">
                  <Coins size={16} />
                  <span>{stake.amount.toFixed(2)} tokens</span>
                </div>
                <div className={`stake-status ${stake.withdrawn ? 'withdrawn' : stake.canWithdraw ? 'unlocked' : 'locked'}`}>
                  {stake.withdrawn ? 'Retiré' : stake.canWithdraw ? 'Déverrouillé' : 'Verrouillé'}
                </div>
              </div>
              
              <div className="stake-details">
                <div className="detail-row">
                  <Clock size={14} />
                  <span>Durée : {formatDuration(stake.lockPeriod)}</span>
                </div>
                <div className="detail-row">
                  <Calendar size={14} />
                  <span>Staké : {formatDate(stake.timestamp)}</span>
                </div>
                <div className="detail-row">
                  <Timer size={14} />
                  <span>Déverrouillage : {formatDate(stake.unlockTime)}</span>
                </div>
              </div>
              
              {!stake.withdrawn && (
                <div className="stake-actions">
                  {stake.canWithdraw ? (
                    <button 
                      onClick={() => withdrawStake(stake.id)}
                      disabled={isLoading}
                      className="withdraw-btn"
                      type="button"
                    >
                      <Unlock size={16} />
                      Retirer
                    </button>
                  ) : (
                    <button 
                      onClick={() => emergencyWithdraw(stake.id)}
                      disabled={isLoading}
                      className="emergency-withdraw-btn"
                      type="button"
                    >
                      <AlertTriangle size={16} />
                      Retrait d'urgence (50% pénalité)
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal pour créer un nouveau stake */}
      {showStakeModal && (
        <div className="stake-modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCloseModal();
          }
        }}>
          <div className="stake-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Staker des Tokens (Permit2)</h3>
              <button 
                onClick={handleCloseModal}
                className="close-btn"
                type="button"
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="permit2-info">
                <p>✅ Utilisation de Permit2 - Aucune approbation séparée nécessaire !</p>
              </div>

              <div className="form-group">
                <label htmlFor="stake-amount-input">Montant à staker</label>
                <div className="amount-input">
                  <input
                    id="stake-amount-input"
                    type="text"
                    inputMode="decimal"
                    value={stakeAmount}
                    onChange={handleAmountChange}
                    placeholder={`Min : ${minimumStakeAmount}`}
                    step="0.01"
                    autoComplete="off"
                  />
                  <span className="token-symbol">tokens</span>
                </div>
                <div className="balance-info">
                  Disponible : {userBalance?.toFixed(2) || '0'} tokens
                </div>
              </div>
              
              <div className="form-group">
                <label>Période de verrouillage</label>
                <div className="lock-period-options">
                  {lockPeriods.length === 0 ? (
                    <div style={{ 
                      padding: '20px', 
                      textAlign: 'center', 
                      color: '#b0b0b0',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px'
                    }}>
                      Chargement des périodes...
                    </div>
                  ) : (
                    lockPeriods.map((period, index) => (
                      <button
                        key={period.value}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('[Staking] Button clicked for period:', period);
                          handleLockPeriodSelect(period.value);
                        }}
                        className={`period-btn ${selectedLockPeriod === period.value ? 'selected' : ''}`}
                        type="button"
                        style={{
                          // Debug: border rouge temporaire pour voir les boutons
                          border: selectedLockPeriod === period.value 
                            ? '2px solid #00bfff' 
                            : '2px solid rgba(255, 255, 255, 0.2)'
                        }}
                      >
                        {period.label}
                        {/* Debug: afficher la valeur */}
                        <span style={{ 
                          fontSize: '10px', 
                          opacity: 0.7, 
                          display: 'block',
                          marginTop: '4px'
                        }}>
                          {period.value}s
                        </span>
                      </button>
                    ))
                  )}
                </div>
                {/* Debug: afficher l'état actuel */}
                <div style={{ 
                  fontSize: '12px', 
                  color: '#00bfff', 
                  marginTop: '8px',
                  padding: '8px',
                  background: 'rgba(0, 191, 255, 0.1)',
                  borderRadius: '4px'
                }}>
                  Debug : Période sélectionnée = "{selectedLockPeriod}" | Périodes disponibles : {lockPeriods.length}
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  onClick={handleCloseModal}
                  className="cancel-btn"
                  type="button"
                >
                  Annuler
                </button>
                <button 
                  onClick={stakeTokensWithPermit2}
                  disabled={isLoading || !stakeAmount || !selectedLockPeriod || parseFloat(stakeAmount) <= 0}
                  className="confirm-stake-btn"
                  type="button"
                >
                  {isLoading ? 'Traitement...' : 'Staker avec Permit2'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification.show && (
        <div className={`staking-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default StakingSection;