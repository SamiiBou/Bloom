import React, { useState } from 'react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import apiService from '../services/api';
import bloomTokenImage from '../assets/bloom_token.png';
import './HumanVerificationModal.css';

const HumanVerificationModal = ({ isOpen, onClose, onVerificationSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('intro'); // 'intro', 'verifying', 'success'

  const handleVerifyHuman = async () => {
    if (!MiniKit.isInstalled()) {
      setError('World App not detected. Please open this app in World App.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('verifying');

    try {
      // Configuration de la vérification World ID
      const verifyPayload = {
        action: 'verifyhuman', // Votre action ID du Developer Portal
        signal: undefined, // Optionnel
        verification_level: VerificationLevel.Orb, // Orb pour la vérification humaine
      };

      console.log('🔍 Starting World ID verification with payload:', verifyPayload);

      // Lancer la vérification World ID via MiniKit
      const { finalPayload } = await MiniKit.commandsAsync.verify(verifyPayload);

      if (finalPayload.status === 'error') {
        throw new Error(finalPayload.error || 'World ID verification failed');
      }

      console.log('✅ World ID verification successful:', finalPayload);

      // Première étape : vérifier la preuve avec notre backend
      const verifyResponse = await apiService.verifyWorldID({
        proof: finalPayload.proof,
        merkle_root: finalPayload.merkle_root,
        nullifier_hash: finalPayload.nullifier_hash,
        verification_level: finalPayload.verification_level,
        action: 'verifyhuman',
        app_id: 'app_f957956822118ea9a349f25a28f41176', // Votre App ID
      });

      if (verifyResponse.status !== 'success') {
        throw new Error(verifyResponse.message || 'Backend verification failed');
      }

      // Deuxième étape : mettre à jour le profil utilisateur
      const updateResponse = await apiService.updateHumanVerification({
        nullifier_hash: finalPayload.nullifier_hash,
        verification_level: finalPayload.verification_level,
      });

      if (updateResponse.status !== 'success') {
        throw new Error(updateResponse.message || 'Failed to update user profile');
      }

      console.log('🎉 Human verification completed with bonus:', updateResponse.data);

      setStep('success');
      
      // Notifier le parent de la réussite avec les données du bonus
      setTimeout(() => {
        onVerificationSuccess?.(updateResponse.data);
        onClose();
      }, 3000);

    } catch (err) {
      console.error('❌ Human verification error:', err);
      setError(err.message || 'Verification failed. Please try again.');
      setStep('intro');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="human-verification-overlay">
      <div className="human-verification-modal">
        {step === 'intro' && (
          <>
            <div className="modal-header">
              <button className="close-btn" onClick={onClose} disabled={isLoading}>
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="verification-card">
                {/* Image centrale plus grosse */}
                <div className="token-image-container">
                  <img src={bloomTokenImage} alt="Bloom Token" className="bloom-token-image" />
                </div>

                {/* Texte principal plus petit */}
                <div className="verification-text">
                  <p className="verify-humanity-text">VERIFY YOUR HUMANITY</p>
                  <p className="unlock-text">and unlock exclusive rewards</p>
                </div>

                {/* Avantages minimalistes */}
                <div className="rewards-simple">
                  <span className="reward-simple">10 Bloom Tokens</span>
                  <span className="reward-separator">+</span>
                  <span className="reward-simple">2x Tokens while watching</span>
                </div>

                {/* Message d'erreur */}
                {error && (
                  <div className="error-message">
                    <span>{error}</span>
                  </div>
                )}

                {/* Bouton principal avec fond noir */}
                <button 
                  className="verify-btn"
                  onClick={handleVerifyHuman}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Verifying...
                    </>
                  ) : (
                    'Verify with World ID'
                  )}
                </button>

                <div className="powered-by">
                  Powered by World ID
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'verifying' && (
          <div className="modal-content verifying">
            <div className="verification-progress">
              <div className="progress-animation">
                <div className="spinner-large"></div>
              </div>
              <h3>Verifying...</h3>
              <p>Please complete in World App</p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="modal-content success">
            <div className="success-animation">
              <div className="checkmark">✅</div>
            </div>
            <h3>🎉 Verified!</h3>
            <p>You're now earning 2x tokens</p>
            <div className="success-rewards">
              <div className="success-item">
                <img src={bloomTokenImage} alt="Bloom Token" className="success-token-icon" />
                <span>+10 Bloom Tokens</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HumanVerificationModal; 