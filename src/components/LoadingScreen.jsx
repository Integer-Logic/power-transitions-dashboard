import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="spinner-large"></div>
        <h2>Power Transitions Platform</h2>
        <p>Loading secure session...</p>
        <div className="loading-details">
          <span className="security-badge">🔒 Secure Connection</span>
          <span className="security-badge">⚡ Authenticating</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
