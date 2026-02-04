import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setIsLoading(true);
    
    const result = await forgotPassword(email);
    
    if (result.success) {
      setSuccess(result.message);
    } else {
      setError(result.message);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        {/* Header */}
        <div className="forgot-password-header">
          <h1>Reset Password</h1>
          <p className="forgot-password-subtitle">Recover your Power Pipeline account</p>
        </div>

        {/* Instructions */}
        <div className="instructions">
          <p>Enter your email address and we'll send you a link to reset your password.</p>
        </div>

        {/* Forgot Password Form */}
        <form onSubmit={handleSubmit} className="forgot-password-form">
          <div className="form-group">
            <label htmlFor="email">
              <span className="label-icon">✉️</span>
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
              className="form-input"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="success-message">
              ✅ {success}
              <p className="email-note">
                <strong>Note:</strong> In development mode, check your console for the reset link.
                In production, you'll receive an email.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Sending Reset Link...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>

          {/* Security Notice */}
          <div className="security-notice">
            <p>
              <strong>🔒 Security Notice:</strong> The reset link will expire in 1 hour. 
              If you don't receive an email, check your spam folder.
            </p>
          </div>
        </form>

        {/* Footer Links */}
        <div className="forgot-password-footer">
          <div className="action-links">
            <Link to="/login" className="action-link">
              ← Back to Login
            </Link>
            <Link to="/register" className="action-link">
              Create New Account →
            </Link>
          </div>
          <div className="footer-links">
            <Link to="/" className="footer-link">Return to Home</Link>
            <span className="separator">•</span>
            <a href="#" className="footer-link">Contact Support</a>
          </div>
          <p className="copyright">
            © 2026 Power Pipeline Systems. Critical Infrastructure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;