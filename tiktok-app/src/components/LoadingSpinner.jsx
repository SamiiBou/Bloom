import React from 'react';
import { motion } from 'framer-motion';
import './LoadingSpinner.css';

const LoadingSpinner = ({ text = "Chargement...", size = "medium", variant = "minimal" }) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  if (variant === "minimal") {
    return (
      <div className="minimal-loading-container">
        <motion.div 
          className={`minimal-spinner ${sizeClasses[size]}`}
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          <motion.div
            className="spinner-dot"
            animate={{ 
              y: [0, -8, 0],
            }}
            transition={{ 
              duration: 0.8, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 0
            }}
          />
          <motion.div
            className="spinner-dot"
            animate={{ 
              y: [0, -8, 0],
            }}
            transition={{ 
              duration: 0.8, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 0.1
            }}
          />
          <motion.div
            className="spinner-dot"
            animate={{ 
              y: [0, -8, 0],
            }}
            transition={{ 
              duration: 0.8, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 0.2
            }}
          />
        </motion.div>
        {text && (
          <motion.p 
            className="loading-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {text}
          </motion.p>
        )}
      </div>
    );
  }

  // Variant pulse pour une alternative
  if (variant === "pulse") {
    return (
      <div className="minimal-loading-container">
        <motion.div 
          className={`pulse-spinner ${sizeClasses[size]}`}
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 1, 0.3]
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        />
        {text && (
          <motion.p 
            className="loading-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {text}
          </motion.p>
        )}
      </div>
    );
  }

  // Variant circle (plus moderne que l'ancien spinner)
  return (
    <div className="minimal-loading-container">
      <motion.div 
        className={`circle-spinner ${sizeClasses[size]}`}
        animate={{ rotate: 360 }}
        transition={{ 
          duration: 1.2, 
          repeat: Infinity, 
          ease: "linear" 
        }}
      />
      {text && (
        <motion.p 
          className="loading-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

export default LoadingSpinner; 