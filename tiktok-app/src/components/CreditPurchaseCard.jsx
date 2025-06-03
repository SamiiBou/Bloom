import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import './CreditPurchaseCard.css';

const CreditPurchaseCard = ({ 
  isOpen, 
  onClose, 
  credits, 
  onPurchase, 
  isLoading,
  compact = false 
}) => {
  const [selectedOption, setSelectedOption] = useState(1); // Index du pack sélectionné
  
  // Packs de crédits avec design optimisé
  const creditPacks = [
    { 
      id: 1, 
      credits: 35, 
      wld: 1, 
      label: 'Starter',
      popular: false,
      savings: null 
    },
    { 
      id: 2, 
      credits: 175, 
      wld: 5, 
      label: 'Popular',
      popular: true,
      savings: 'Save 14%' 
    },
    { 
      id: 3, 
      credits: 350, 
      wld: 10, 
      label: 'Pro',
      popular: false,
      savings: 'Save 28%' 
    }
  ];

  const selectedPack = creditPacks[selectedOption];

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.95,
      y: 10
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 500,
        damping: 30
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95,
      y: 10,
      transition: {
        duration: 0.15,
        ease: "easeOut"
      }
    }
  };

  const handlePurchase = () => {
    onPurchase(selectedPack.credits);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className={`credit-purchase-card ${compact ? 'compact' : ''}`}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          layout
        >
          {/* Header minimaliste */}
          {!compact && (
            <div className="purchase-card-header">
              <h3 className="purchase-card-title">Get Credits</h3>
              <button 
                className="purchase-card-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Balance actuelle - Design subtil */}
          <div className="current-balance">
            <div className="balance-info">
              <span className="balance-label">Current balance</span>
              <div className="balance-amount">
                <Sparkles size={16} className="balance-icon" />
                <span className="balance-value">{credits}</span>
                <span className="balance-unit">credits</span>
              </div>
            </div>
          </div>

          {/* Options de pack - Design Apple Cards */}
          <div className="credit-packs">
            {creditPacks.map((pack, index) => (
              <motion.button
                key={pack.id}
                className={`pack-option ${selectedOption === index ? 'selected' : ''} ${pack.popular ? 'popular' : ''}`}
                onClick={() => setSelectedOption(index)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {pack.popular && (
                  <div className="popular-badge">Most Popular</div>
                )}
                
                <div className="pack-content">
                  <div className="pack-credits">
                    <span className="pack-number">{pack.credits}</span>
                    <span className="pack-unit">credits</span>
                  </div>
                  
                  <div className="pack-pricing">
                    <span className="pack-price">{pack.wld} WLD</span>
                    {pack.savings && (
                      <span className="pack-savings">{pack.savings}</span>
                    )}
                  </div>
                </div>

                <div className={`selection-indicator ${selectedOption === index ? 'visible' : ''}`}>
                  <div className="indicator-dot"></div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Prix par crédit - Information subtile */}
          <div className="pricing-info">
            <span className="info-text">
              {(selectedPack.wld / selectedPack.credits * 35).toFixed(3)} WLD per credit
            </span>
          </div>

          {/* Bouton d'achat - Style Apple */}
          <motion.button
            className={`purchase-button ${isLoading ? 'loading' : ''}`}
            onClick={handlePurchase}
            disabled={isLoading}
            whileHover={!isLoading ? { scale: 1.01 } : {}}
            whileTap={!isLoading ? { scale: 0.99 } : {}}
          >
            {isLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <span>Processing...</span>
              </div>
            ) : (
              <>
                <span className="button-text">
                  Purchase {selectedPack.credits} credits
                </span>
                <span className="button-price">
                  for {selectedPack.wld} WLD
                </span>
              </>
            )}
          </motion.button>

          {/* Footer info - Très subtil */}
          <div className="purchase-footer">
            <p className="footer-text">
              Secure payment via World App
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreditPurchaseCard; 