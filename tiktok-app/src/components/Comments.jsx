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

  // Load comments
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
        setError('Error loading comments');
      }
    } catch (err) {
      console.error('Erreur lors du chargement des commentaires:', err);
      setError('Error loading comments');
    } finally {
      setLoading(false);
    }
  };

  // Add a comment
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
        // Add the new comment at the top of the list
        const comment = response.data.comment;
        setComments(prev => [comment, ...prev]);
        setCommentsCount(prev => prev + 1);
        setNewComment('');
        
        // Scroll to top to see the new comment
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = 0;
        }
      } else {
        setError('Error adding comment');
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout du commentaire:', err);
      setError('Error adding comment');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    try {
      await apiService.deleteComment(videoId, commentId);
      setComments(prev => prev.filter(comment => comment._id !== commentId));
      setCommentsCount(prev => prev - 1);
    } catch (err) {
      console.error('Erreur lors de la suppression du commentaire:', err);
      setError('Error deleting comment');
    }
  };

  // Load more comments
  const loadMoreComments = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadComments(nextPage, true);
    }
  };

  // Load comments when component opens
  useEffect(() => {
    if (isOpen && videoId) {
      setComments([]);
      setPage(1);
      loadComments(1, false);
    }
  }, [isOpen, videoId]);

  // Focus on input when comments open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  // Handle scroll to load more comments
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loading) {
      loadMoreComments();
    }
  };

  // Date formatting
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}min ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
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
          <h3>Comments ({commentsCount})</h3>
          <button 
            className="comments-close-button"
            onClick={onClose}
            aria-label="Close comments"
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
              <span>Loading comments...</span>
            </div>
          )}

          {error && comments.length === 0 && (
            <div className="comments-error">
              <AlertCircle size={24} />
              <p>{error}</p>
              <button onClick={() => loadComments(1, false)}>Retry</button>
            </div>
          )}

          {comments.length === 0 && !loading && !error && (
            <div className="comments-empty">
              <MessageCircle size={32} />
              <p>No comments yet</p>
              <p>Be the first to comment!</p>
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
                    @{comment.user?.username || 'User'}
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
                      <Trash2 size={20} /> Delete
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
              <p>You've seen all comments!</p>
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
                placeholder="Add a comment..."
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
            <p>Sign in to comment</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Comments;