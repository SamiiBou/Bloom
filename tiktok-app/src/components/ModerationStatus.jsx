import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Clock, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';
import './ModerationStatus.css';

const ModerationStatus = ({ moderation, compact = false }) => {
  if (!moderation) return null;

  const getStatusConfig = (status) => {
    switch (status) {
      case 'APPROVED':
        return {
          icon: CheckCircle,
          color: '#34C759',
          bgColor: '#ECFDF5',
          title: 'Content Approved',
          message: 'Your video has been approved and is now publicly visible.',
          className: 'approved'
        };
      case 'FLAGGED':
      case 'REJECTED':
        return {
          icon: XCircle,
          color: '#FF3B30',
          bgColor: '#FEF2F2',
          title: 'Content Rejected',
          message: 'Your video has been rejected because it does not comply with our community guidelines.',
          className: 'rejected'
        };
      case 'PENDING':
        return {
          icon: Clock,
          color: '#FF9500',
          bgColor: '#FFFBEB',
          title: 'Under Review',
          message: 'Your video is being analyzed. This may take a few minutes.',
          className: 'pending'
        };
      case 'MANUAL_REVIEW':
        return {
          icon: AlertTriangle,
          color: '#007AFF',
          bgColor: '#F3F4F6',
          title: 'Manual Review Required',
          message: 'Your video requires manual review by our team.',
          className: 'review'
        };
      default:
        return {
          icon: AlertTriangle,
          color: '#6B7280',
          bgColor: '#F9FAFB',
          title: 'Statut inconnu',
          message: 'Le statut de modération n\'est pas disponible.',
          className: 'unknown'
        };
    }
  };

  const config = getStatusConfig(moderation.status);
  const IconComponent = config.icon;

  if (compact) {
    return (
      <motion.div 
        className={`moderation-status-compact ${config.className}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <IconComponent size={16} color={config.color} />
        <span className="status-text">{config.title}</span>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className={`moderation-status-card ${config.className}`}
      style={{ backgroundColor: config.bgColor }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="status-header">
        <div className="status-icon-container">
          <Shield size={20} color={config.color} className="shield-icon" />
          <IconComponent size={24} color={config.color} className="status-icon" />
        </div>
        <div className="status-info">
          <h3 className="status-title" style={{ color: config.color }}>
            {config.title}
          </h3>
          <p className="status-message">{config.message}</p>
        </div>
      </div>

      {moderation.confidence !== undefined && (
        <div className="confidence-section">
          <div className="confidence-label">
            Niveau de confiance: {(moderation.confidence * 100).toFixed(1)}%
          </div>
          <div className="confidence-bar">
            <motion.div 
              className="confidence-fill"
              style={{ backgroundColor: config.color }}
              initial={{ width: 0 }}
              animate={{ width: `${moderation.confidence * 100}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
        </div>
      )}

      {moderation.detectedIssues && moderation.detectedIssues.length > 0 && (
        <div className="detected-issues">
          <h4>Problèmes détectés:</h4>
          <div className="issues-list">
            {moderation.detectedIssues.map((issue, index) => (
              <span key={index} className="issue-tag">
                {getIssueLabel(issue)}
              </span>
            ))}
          </div>
        </div>
      )}

      {moderation.needsReview && (
        <div className="review-notice">
          <AlertTriangle size={16} />
          <span>This video requires manual review by our team.</span>
        </div>
      )}

      {moderation.message && (
        <div className="moderation-message">
          <p>{moderation.message}</p>
        </div>
      )}
    </motion.div>
  );
};

const getIssueLabel = (issue) => {
  const labels = {
    'adult_content': 'Contenu adulte',
    'violent_content': 'Violence',
    'racy_content': 'Contenu suggestif',
    'safe_search_adult': 'SafeSearch: Adulte',
    'safe_search_violence': 'SafeSearch: Violence',
    'safe_search_racy': 'SafeSearch: Suggestif',
    'moderation_error': 'Analysis error'
  };
  return labels[issue] || issue;
};

export default ModerationStatus; 