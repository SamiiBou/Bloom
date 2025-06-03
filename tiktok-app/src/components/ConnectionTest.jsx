import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import './ConnectionTest.css';

const ConnectionTest = () => {
  const [tests, setTests] = useState([
    { name: 'Backend Health Check', status: 'pending', message: '' },
    { name: 'API Connection', status: 'pending', message: '' },
    { name: 'CORS Configuration', status: 'pending', message: '' },
    { name: 'Video Routes', status: 'pending', message: '' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState('pending');

  const updateTest = (index, status, message) => {
    setTests(prev => prev.map((test, i) => 
      i === index ? { ...test, status, message } : test
    ));
  };

  const runTests = async () => {
    setIsRunning(true);
    setOverallStatus('running');

    // Test 1: Backend Health Check
    try {
      const healthResponse = await apiService.healthCheck();
      updateTest(0, 'success', `Backend is running (${healthResponse.environment})`);
    } catch (error) {
      updateTest(0, 'error', `Backend not accessible: ${error.message}`);
      setIsRunning(false);
      setOverallStatus('error');
      return;
    }

    // Test 2: API Connection
    try {
      await fetch(`${apiService.baseURL.replace('/api', '')}/health`);
      updateTest(1, 'success', 'API endpoint accessible');
    } catch (error) {
      updateTest(1, 'error', `API connection failed: ${error.message}`);
    }

    // Test 3: CORS Configuration
    try {
      const response = await fetch(`${apiService.baseURL.replace('/api', '')}/health`, {
        method: 'GET',
        headers: {
          'Origin': window.location.origin
        }
      });
      if (response.ok) {
        updateTest(2, 'success', 'CORS properly configured');
      } else {
        updateTest(2, 'warning', 'CORS might have issues');
      }
    } catch (error) {
      updateTest(2, 'error', `CORS test failed: ${error.message}`);
    }

    // Test 4: Video Routes (should return 401 without auth)
    try {
      await apiService.getVideos();
      updateTest(3, 'success', 'Video routes accessible');
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        updateTest(3, 'success', 'Video routes protected (401 - as expected)');
      } else {
        updateTest(3, 'warning', `Video routes: ${error.message}`);
      }
    }

    setIsRunning(false);
    
    // Determine overall status
    const hasErrors = tests.some(test => test.status === 'error');
    const hasWarnings = tests.some(test => test.status === 'warning');
    
    if (hasErrors) {
      setOverallStatus('error');
    } else if (hasWarnings) {
      setOverallStatus('warning');
    } else {
      setOverallStatus('success');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'running': return '🔄';
      default: return '⏳';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'warning': return '#FF9800';
      case 'running': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  return (
    <div className="connection-test">
      <div className="test-header">
        <h2>🔗 Frontend ↔ Backend Connection Test</h2>
        <button 
          onClick={runTests} 
          disabled={isRunning}
          className="test-button"
        >
          {isRunning ? '🔄 Running Tests...' : '🧪 Run Tests'}
        </button>
      </div>

      <div className="test-results">
        {tests.map((test, index) => (
          <div 
            key={index} 
            className="test-item"
            style={{ borderLeftColor: getStatusColor(test.status) }}
          >
            <div className="test-name">
              <span className="test-icon">{getStatusIcon(test.status)}</span>
              {test.name}
            </div>
            {test.message && (
              <div className="test-message" style={{ color: getStatusColor(test.status) }}>
                {test.message}
              </div>
            )}
          </div>
        ))}
      </div>

      {overallStatus !== 'pending' && (
        <div className={`overall-status ${overallStatus}`}>
          <h3>
            {getStatusIcon(overallStatus)} Overall Status: {overallStatus.toUpperCase()}
          </h3>
          {overallStatus === 'success' && (
            <p>🎉 All tests passed! Frontend is properly connected to backend.</p>
          )}
          {overallStatus === 'warning' && (
            <p>⚠️ Connection established but some issues detected.</p>
          )}
          {overallStatus === 'error' && (
            <p>❌ Connection failed. Check backend server and configuration.</p>
          )}
        </div>
      )}

      <div className="test-info">
        <h4>📋 What this tests:</h4>
        <ul>
          <li><strong>Backend Health Check:</strong> Verifies backend server is running</li>
          <li><strong>API Connection:</strong> Tests basic API connectivity</li>
          <li><strong>CORS Configuration:</strong> Ensures cross-origin requests work</li>
          <li><strong>Video Routes:</strong> Checks if API routes are accessible</li>
        </ul>
      </div>
    </div>
  );
};

export default ConnectionTest; 