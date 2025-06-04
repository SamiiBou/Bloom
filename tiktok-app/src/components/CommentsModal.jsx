import React, { useState, useEffect } from 'react';
import { X, Send, Heart, MessageCircle } from 'lucide-react';
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

  // Load comments when modal opens
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
        setError('Error loading comments');
      }
    } catch (err) {
      console.error('Error loading comments:', err);
      setError('Error loading comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      setError('You must be signed in to comment');
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
        // Add the new comment at the top of the list
        const comment = response.data.comment;
        setComments(prev => [comment, ...prev]);
        setNewComment('');
      } else {
        setError('Error adding comment');
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Error adding comment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}min ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
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
            {comment.user?.displayName || comment.user?.username || 'User'}
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
            Reply
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
            <div className="modal-header">
              <h3>Comments ({comments.length})</h3>
              <button className="close-btn" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div className="comments-modal-content">
              {loading ? (
                <div className="comments-loading">
                  <div className="spinner" />
                  <p>Loading comments...</p>
                </div>
              ) : error ? (
                <div className="comments-error">
                  <p>{error}</p>
                  <button onClick={loadComments}>Retry</button>
                </div>
              ) : comments.length === 0 ? (
                <div className="no-comments">
                  <MessageCircle size={48} />
                  <p>No comments yet</p>
                  <p>Be the first to comment!</p>
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
                    placeholder="Add a comment..."
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
                <p>Sign in to comment</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommentsModal; 