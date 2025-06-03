import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { X, Send, Heart, Trash2, MessageCircle, AlertCircle, Check } from 'lucide-react';
import './Comments.css';

const Comments = ({ videoId, isOpen, onClose, commentsCount: initialCommentsCount }) => {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount || 0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const commentsContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Charger les commentaires
  const loadComments = async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiService.getComments(videoId, pageNum, 20);
      
      if (response.status === 'success') {
        const newComments = response.data.comments || [];
        
        if (append) {
          setComments(prev => [...prev, ...newComments]);
        } else {
          setComments(newComments);
        }
        
        setHasMore(response.data.pagination?.hasMore || false);
        setCommentsCount(response.data.comments?.length || newComments.length);
      } else {
        setError('Erreur lors du chargement des commentaires');
      }
    } catch (err) {
      console.error('Erreur lors du chargement des commentaires:', err);
      setError(err.message || 'Erreur lors du chargement des commentaires');
    } finally {
      setLoading(false);
    }
  };

  // Ajouter un commentaire
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim() || !isAuthenticated) {
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
        setCommentsCount(prev => prev + 1);
        setNewComment('');
        
        // Scroll vers le haut pour voir le nouveau commentaire
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = 0;
        }
      } else {
        setError(response.message || 'Erreur lors de l\'ajout du commentaire');
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout du commentaire:', err);
      setError(err.message || 'Erreur lors de l\'ajout du commentaire');
    } finally {
      setSubmitting(false);
    }
  };

  // Supprimer un commentaire
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
      return;
    }
    
    try {
      await apiService.deleteComment(videoId, commentId);
      setComments(prev => prev.filter(comment => comment._id !== commentId));
      setCommentsCount(prev => prev - 1);
    } catch (err) {
      console.error('Erreur lors de la suppression du commentaire:', err);
      setError('Erreur lors de la suppression du commentaire');
    }
  };

  // Charger plus de commentaires
  const loadMoreComments = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadComments(nextPage, true);
    }
  };

  // Charger les commentaires quand le composant s'ouvre
  useEffect(() => {
    if (isOpen && videoId) {
      setComments([]);
      setPage(1);
      loadComments(1, false);
    }
  }, [isOpen, videoId]);

  // Focus sur l'input quand les commentaires s'ouvrent
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  // Gérer le scroll pour charger plus de commentaires
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loading) {
      loadMoreComments();
    }
  };

  // Formatage de la date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'À l\'instant';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Il y a ${minutes}min`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `Il y a ${hours}h`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `Il y a ${days}j`;
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="comments-overlay">
      <div className="comments-container">
        {/* Header */}
        <div className="comments-header">
          <h3>Commentaires ({commentsCount})</h3>
          <button 
            className="comments-close-button"
            onClick={onClose}
            aria-label="Fermer les commentaires"
          >
            <X size={20} />
          </button>
        </div>

        {/* Liste des commentaires */}
        <div 
          className="comments-list"
          ref={commentsContainerRef}
          onScroll={handleScroll}
        >
          {loading && comments.length === 0 && (
            <div className="comments-loading">
              <div className="spinner"></div>
              <span>Chargement des commentaires...</span>
            </div>
          )}

          {error && comments.length === 0 && (
            <div className="comments-error">
              <AlertCircle size={24} />
              <p>{error}</p>
              <button onClick={() => loadComments(1, false)}>Réessayer</button>
            </div>
          )}

          {comments.length === 0 && !loading && !error && (
            <div className="comments-empty">
              <MessageCircle size={32} />
              <p>Aucun commentaire pour le moment</p>
              <p>Soyez le premier à commenter !</p>
            </div>
          )}

          {comments.map((comment) => (
            <div key={comment._id} className="comment-item">
              <div className="comment-avatar">
                {comment.user?.avatar ? (
                  <img 
                    src={comment.user.avatar} 
                    alt={comment.user.username}
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {(comment.user?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-username">
                    @{comment.user?.username || 'Utilisateur'}
                  </span>
                  <span className="comment-date">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                
                <p className="comment-text">{comment.text}</p>
                
                <div className="comment-actions">
                  <button className="comment-like-button">
                    <Heart size={20} /> {comment.likes?.length || 0}
                  </button>
                  
                  {user && comment.user?._id === user.id && (
                    <button 
                      className="comment-delete-button"
                      onClick={() => handleDeleteComment(comment._id)}
                    >
                      <Trash2 size={20} /> Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Indicateur de chargement pour plus de commentaires */}
          {loading && comments.length > 0 && (
            <div className="comments-loading-more">
              <div className="spinner"></div>
            </div>
          )}

          {!hasMore && comments.length > 0 && (
            <div className="comments-end">
              <Check size={20} />
              <p>Vous avez vu tous les commentaires !</p>
            </div>
          )}
        </div>

        {/* Formulaire d'ajout de commentaire */}
        {isAuthenticated ? (
          <form className="comment-form" onSubmit={handleSubmitComment}>
            <div className="comment-input-container">
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="comment-input"
                maxLength={500}
                disabled={submitting}
              />
              <button
                type="submit"
                className="comment-submit-button"
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? <div className="spinner"></div> : <Send size={14} />}
              </button>
            </div>
            
            {error && (
              <div className="comment-form-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </form>
        ) : (
          <div className="comment-login-prompt">
            <MessageCircle size={24} />
            <p>Connectez-vous pour commenter</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Comments;