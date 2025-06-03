import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Gift, TrendingUp, Clock, Wallet, AlertTriangle, CheckCircle } from 'lucide-react';
import { MiniKit } from '@worldcoin/minikit-js';

// Configuration des contrats - À MODIFIER avec vos vraies adresses
const CONTRACTS = {
  BLOOM_TOKEN: '0xYOUR_BLOOM_TOKEN_ADDRESS', // ⚠️ Remplacez par votre adresse de token
  STAKING_CONTRACT: '0xYOUR_STAKING_CONTRACT_ADDRESS' // ⚠️ Remplacez par votre adresse de staking
};

// ABIs simplifiés pour les fonctions utilisées
const BLOOM_TOKEN_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "spender", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {"internalType": "address", "name": "spender", "type": "address"}],
    "name": "allowance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const STAKING_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "stake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "stakeIndex", "type": "uint256"}],
    "name": "unstake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "stakeIndex", "type": "uint256"}],
    "name": "claimRewards",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const Staking = () => {
  // États
  const [walletAddress, setWalletAddress] = useState('');
  const [bloomBalance, setBloomBalance] = useState('0');
  const [stakedAmount, setStakedAmount] = useState('0');
  const [pendingRewards, setPendingRewards] = useState('0');
  const [userStakes, setUserStakes] = useState([]);
  const [stakeAmount, setStakeAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState('');
  const [minimumStake, setMinimumStake] = useState('1000');
  const [rewardRate, setRewardRate] = useState('10');

  // Fonction utilitaire pour formater les montants
  const formatAmount = (amount, decimals = 18) => {
    if (!amount || amount === '0') return '0';
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  };

  // Fonction utilitaire pour convertir en wei
  const toWei = (amount, decimals = 18) => {
    return (parseFloat(amount) * Math.pow(10, decimals)).toString();
  };

  // Vérifier la connexion World App et récupérer l'adresse
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (MiniKit.isInstalled()) {
          // Récupérer les informations de l'utilisateur si connecté
          const isConnected = await MiniKit.user.isLoggedIn();
          if (isConnected) {
            const userInfo = await MiniKit.user.getProfile();
            console.log('User info:', userInfo);
          }
        }
      } catch (error) {
        console.error('Erreur de connexion:', error);
      }
    };

    checkConnection();
  }, []);

  // Fonction pour approuver les tokens BLOOM
  const approveTokens = async (amount) => {
    try {
      setIsLoading(true);
      setTransactionStatus('📝 Approbation des tokens...');

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACTS.BLOOM_TOKEN,
            abi: BLOOM_TOKEN_ABI,
            functionName: 'approve',
            args: [CONTRACTS.STAKING_CONTRACT, toWei(amount)]
          }
        ]
      });

      if (finalPayload.status === 'error') {
        throw new Error(finalPayload.message || 'Erreur lors de l\'approbation');
      }

      setTransactionStatus('✅ Approbation réussie !');
      return finalPayload.transaction_id;

    } catch (error) {
      console.error('Erreur approbation:', error);
      setTransactionStatus(`❌ ${error.message}`);
      throw error;
    }
  };

  // Fonction pour staker des tokens
  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setTransactionStatus('❌ Montant invalide');
      return;
    }

    if (parseFloat(stakeAmount) < parseFloat(minimumStake)) {
      setTransactionStatus(`❌ Montant minimum: ${minimumStake} BLOOM`);
      return;
    }

    try {
      setIsLoading(true);
      setTransactionStatus('🔄 Préparation du staking...');

      // 1. D'abord approuver les tokens
      await approveTokens(stakeAmount);

      // 2. Ensuite staker
      setTransactionStatus('🔒 Staking en cours...');

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACTS.STAKING_CONTRACT,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [toWei(stakeAmount)]
          }
        ]
      });

      if (finalPayload.status === 'error') {
        throw new Error(finalPayload.message || 'Erreur lors du staking');
      }

      setTransactionStatus('✅ Staking réussi !');
      setStakeAmount('');
      
      // Rafraîchir les données
      setTimeout(() => {
        loadUserData();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Erreur staking:', error);
      setTransactionStatus(`❌ ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour unstaker
  const handleUnstake = async (stakeIndex) => {
    try {
      setIsLoading(true);
      setTransactionStatus('🔓 Unstaking en cours...');

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACTS.STAKING_CONTRACT,
            abi: STAKING_ABI,
            functionName: 'unstake',
            args: [stakeIndex]
          }
        ]
      });

      if (finalPayload.status === 'error') {
        throw new Error(finalPayload.message || 'Erreur lors de l\'unstaking');
      }

      setTransactionStatus('✅ Unstaking réussi !');
      
      // Rafraîchir les données
      setTimeout(() => {
        loadUserData();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Erreur unstaking:', error);
      setTransactionStatus(`❌ ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour claim les récompenses
  const handleClaimRewards = async (stakeIndex) => {
    try {
      setIsLoading(true);
      setTransactionStatus('🎁 Récupération des récompenses...');

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACTS.STAKING_CONTRACT,
            abi: STAKING_ABI,
            functionName: 'claimRewards',
            args: [stakeIndex]
          }
        ]
      });

      if (finalPayload.status === 'error') {
        throw new Error(finalPayload.message || 'Erreur lors du claim');
      }

      setTransactionStatus('✅ Récompenses récupérées !');
      
      // Rafraîchir les données
      setTimeout(() => {
        loadUserData();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Erreur claim:', error);
      setTransactionStatus(`❌ ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les données utilisateur (simulation pour l'exemple)
  const loadUserData = useCallback(async () => {
    // Dans une vraie implémentation, vous feriez des calls read-only au contrat
    // Pour l'exemple, nous simulons des données
    setBloomBalance('10000.50');
    setStakedAmount('5000.00');
    setPendingRewards('125.75');
    setUserStakes([
      {
        amount: '2500000000000000000000', // 2500 BLOOM en wei
        stakeTime: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 jours
        isActive: true,
        rewards: '75000000000000000000' // 75 BLOOM en wei
      },
      {
        amount: '2500000000000000000000', // 2500 BLOOM en wei
        stakeTime: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 jours
        isActive: true,
        rewards: '50750000000000000000' // 50.75 BLOOM en wei
      }
    ]);
  }, []);

  // Charger les données au montage
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center py-8">
          <div className="flex items-center justify-center mb-4">
            <Lock className="h-12 w-12 text-yellow-400 mr-3" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              BLOOM Staking
            </h1>
          </div>
          <p className="text-gray-300 text-lg">
            Stakez vos tokens BLOOM et gagnez {rewardRate}% APY
          </p>
        </div>

        {/* Status de transaction */}
        {transactionStatus && (
          <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-pulse">{transactionStatus}</div>
            </div>
          </div>
        )}

        {/* Stats générales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Balance BLOOM</p>
                <p className="text-2xl font-bold text-green-400">{formatAmount(bloomBalance, 0)}</p>
              </div>
              <Wallet className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Staké</p>
                <p className="text-2xl font-bold text-blue-400">{formatAmount(stakedAmount, 0)}</p>
              </div>
              <Lock className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Récompenses</p>
                <p className="text-2xl font-bold text-yellow-400">{formatAmount(pendingRewards, 0)}</p>
              </div>
              <Gift className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Section Staking */}
        <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <TrendingUp className="h-6 w-6 mr-2 text-yellow-400" />
            Nouveau Staking
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Montant à staker (BLOOM)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder={`Minimum: ${minimumStake} BLOOM`}
                  className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                  disabled={isLoading}
                />
                <button
                  onClick={() => setStakeAmount(bloomBalance)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-400 text-sm hover:text-yellow-300 transition-colors"
                  disabled={isLoading}
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="bg-black/20 rounded-xl p-4 border border-yellow-400/20">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400 mr-2" />
                <span className="text-sm font-medium text-yellow-400">Informations</span>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Montant minimum: {minimumStake} BLOOM</li>
                <li>• Taux de récompense: {rewardRate}% APY</li>
                <li>• Durée de verrouillage: 30 jours</li>
                <li>• Les récompenses sont calculées en temps réel</li>
              </ul>
            </div>

            <button
              onClick={handleStake}
              disabled={isLoading || !stakeAmount || parseFloat(stakeAmount) <= 0}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-4 px-6 rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent" />
                  <span>Transaction en cours...</span>
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  <span>Staker les Tokens</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mes Stakes */}
        <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Clock className="h-6 w-6 mr-2 text-blue-400" />
            Mes Stakes Actifs
          </h2>

          {userStakes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun stake actif</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userStakes.map((stake, index) => {
                const daysSinceStake = Math.floor((Date.now() - stake.stakeTime) / (1000 * 60 * 60 * 24));
                const canUnstake = daysSinceStake >= 30;
                
                return (
                  <div key={index} className="bg-black/40 rounded-xl p-4 border border-white/10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold text-white">
                            {formatAmount(stake.amount)} BLOOM
                          </span>
                          {canUnstake ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-400" />
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          <p>Staké il y a {daysSinceStake} jours</p>
                          <p>Récompenses pending: {formatAmount(stake.rewards)} BLOOM</p>
                          {!canUnstake && (
                            <p className="text-yellow-400">
                              Déblocage dans {30 - daysSinceStake} jours
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleClaimRewards(index)}
                          disabled={isLoading || parseFloat(stake.rewards) <= 0}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          <Gift className="h-4 w-4" />
                          <span>Claim</span>
                        </button>

                        <button
                          onClick={() => handleUnstake(index)}
                          disabled={isLoading || !canUnstake}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          <Unlock className="h-4 w-4" />
                          <span>Unstake</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Informations supplémentaires */}
        <div className="bg-black/20 rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-bold mb-4 text-gray-300">Comment ça marche ?</h3>
          <div className="text-sm text-gray-400 space-y-2">
            <p>1. <strong>Stakez</strong> vos tokens BLOOM pour une durée minimum de 30 jours</p>
            <p>2. <strong>Gagnez</strong> {rewardRate}% APY sur vos tokens stakés</p>
            <p>3. <strong>Récupérez</strong> vos récompenses à tout moment</p>
            <p>4. <strong>Unstakez</strong> après la période de verrouillage</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Staking;