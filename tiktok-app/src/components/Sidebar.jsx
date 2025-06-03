import React from 'react';
import { X, User, Settings, HelpCircle, Moon, Bell, Shield, Heart, Bookmark, Clock, Home, PlayCircle, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, currentPage, onPageChange }) => {
  const navigationItems = [
    { icon: Home, label: 'Home', action: 'home' },
    { icon: PlayCircle, label: 'Video Catalog', action: 'videos' },
    { icon: Compass, label: 'Explore', action: 'discover' },
  ];

  const menuItems = [
    { icon: User, label: 'My Profile', action: 'profile' },
    { icon: Heart, label: 'My Likes', action: 'likes' },
    { icon: Bookmark, label: 'Favorites', action: 'favorites' },
    { icon: Clock, label: 'History', action: 'history' },
    { icon: Bell, label: 'Notifications', action: 'notifications' },
    { icon: Shield, label: 'Privacy', action: 'privacy' },
    { icon: Moon, label: 'Dark Mode', action: 'theme', toggle: true },
    { icon: Settings, label: 'Settings', action: 'settings' },
    { icon: HelpCircle, label: 'Help', action: 'help' }
  ];

  const handleNavigationClick = (action) => {
    if (onPageChange) {
      onPageChange(action);
    }
    onClose();
  };

  const handleItemClick = (action) => {
    if (action === 'profile' && onPageChange) {
      onPageChange('profile');
    } else {
      console.log(`Action: ${action}`);
      // Here you can add logic for each action
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="sidebar"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="sidebar-header">
              <div className="sidebar-user">
                <img 
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face" 
                  alt="User" 
                  className="sidebar-avatar"
                />
                <div className="sidebar-user-info">
                  <h3 className="sidebar-username">@my_username</h3>
                  <p className="sidebar-stats">1.2M followers • 89 following</p>
                </div>
              </div>
              <button className="sidebar-close" onClick={onClose}>
                <X size={24} />
              </button>
            </div>

            <div className="sidebar-content">
              {/* Main navigation */}
              <div className="sidebar-section">
                <h4 className="sidebar-section-title">Navigation</h4>
                <div className="sidebar-menu">
                  {navigationItems.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.action;
                    return (
                      <motion.button
                        key={item.action}
                        className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleNavigationClick(item.action)}
                        whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* User menu */}
              <div className="sidebar-section">
                <h4 className="sidebar-section-title">My Account</h4>
                <div className="sidebar-menu">
                  {menuItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <motion.button
                        key={item.action}
                        className="sidebar-menu-item"
                        onClick={() => handleItemClick(item.action)}
                        whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (navigationItems.length + index) * 0.05 }}
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                        {item.toggle && (
                          <div className="toggle-switch">
                            <div className="toggle-slider"></div>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div className="sidebar-footer">
                <p className="sidebar-version">Version 1.0.0</p>
                <p className="sidebar-copyright">© 2024 TikTok Clone</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sidebar; 