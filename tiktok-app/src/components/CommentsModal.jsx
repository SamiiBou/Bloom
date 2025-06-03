import React, { useState, useEffect } from 'react';
import { X, Send, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './CommentsModal.css';

const CommentsModal = ({ isOpen, onClose, videoId, initialCommentsCount = 0 }) => {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Charger les commentaires quand le modal s'ouvre
  useEffect(() => {
    if (isOpen && videoId) {
      loadComments();
    }
  }, [isOpen, videoId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getComments(videoId);
      
      if (response.status === 'success') {
        setComments(response.data.comments || []);
      } else {
        setError('Erreur lors du chargement des commentaires');
      }
    } catch (err) {
      console.error('Erreur lors du chargement des commentaires:', err);
      setError('Erreur lors du chargement des commentaires');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      setError('Vous devez être connecté pour commenter');
      return;
    }

    if (!newComment.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      
      const response = await apiService.addComment(videoId, newComment.trim());
      
      if (response.status === 'success') {
        // Ajouter le nouveau commentaire en haut de la liste
        const comment = response.data.comment;
        setComments(prev => [comment, ...prev]);
        setNewComment('');
      } else {
        setError(response.message || 'Erreur lors de l\'ajout du commentaire');
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout du commentaire:', err);
      setError('Erreur lors de l\'ajout du commentaire');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'À l\'instant';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}min`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}j`;
    }
  };

  const CommentItem = ({ comment }) => (
    <div className="comment-item">
      <div className="comment-avatar">
        {comment.user?.avatar ? (
          <img src={comment.user.avatar} alt={comment.user.username} />
        ) : (
          <div className="avatar-placeholder">
            {(comment.user?.username || 'U').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      
      <div className="comment-content">
        <div className="comment-header">
          <span className="comment-username">
            {comment.user?.displayName || comment.user?.username || 'Utilisateur'}
          </span>
          <span className="comment-time">
            {formatDate(comment.createdAt)}
          </span>
        </div>
        
        <p className="comment-text">{comment.text}</p>
        
        <div className="comment-actions">
          <button className="comment-like-btn">
            <Heart size={14} />
            <span>{comment.likes?.length || 0}</span>
          </button>
          <button className="comment-reply-btn">
            Répondre
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="comments-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          <motion.div
            className="comments-modal"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="comments-modal-header">
              <h3>Commentaires ({comments.length})</h3>
              <button className="close-btn" onClick={onClose}>
                <X size={24} />
              </button>
            </div>

            <div className="comments-modal-content">
              {loading ? (
                <div className="comments-loading">
                  <div className="spinner"></div>
                  <p>Chargement des commentaires...</p>
                </div>
              ) : error ? (
                <div className="comments-error">
                  <p>{error}</p>
                  <button onClick={loadComments}>Réessayer</button>
                </div>
              ) : comments.length === 0 ? (
                <div className="no-comments">
                  <p>Aucun commentaire pour le moment</p>
                  <p>Soyez le premier à commenter !</p>
                </div>
              ) : (
                <div className="comments-list">
                  {comments.map((comment) => (
                    <CommentItem key={comment._id} comment={comment} />
                  ))}
                </div>
              )}
            </div>

            {isAuthenticated && (
              <form className="comment-form" onSubmit={handleSubmitComment}>
                <div className="comment-input-container">
                  <div className="user-avatar-small">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.username} />
                    ) : (
                      <div className="avatar-placeholder">
                        {(user?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <input
                    type="text"
                    placeholder="Ajouter un commentaire..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={submitting}
                    maxLength={500}
                  />
                  
                  <button
                    type="submit"
                    disabled={!newComment.trim() || submitting}
                    className="send-btn"
                  >
                    {submitting ? (
                      <div className="spinner-small"></div>
                    ) : (
                      <Send size={20} />
                    )}
                  </button>
                </div>
                
                {error && (
                  <div className="comment-error">
                    {error}
                  </div>
                )}
              </form>
            )}

            {!isAuthenticated && (
              <div className="login-prompt">
                <p>Connectez-vous pour commenter</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommentsModal; 