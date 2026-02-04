import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './ResetPassword.css';

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Basic token validation
    if (!token || token.length !== 64) {
      setIsValidToken(false);
      setError('Invalid or expired reset token');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    const result = await resetPassword(token, password);
    
    if (result.success) {
      setSuccess(result.message + ' Redirecting to login...');
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } else {
      setError(result.message);
      setIsLoading(false);
    }
  };

  if (!isValidToken) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="reset-password-header">
            <h1>Invalid Reset Link</h1>
            <p className="reset-password-subtitle">The password reset link is invalid or has expired</p>
          </div>
          
          <div className="error-message">
            ⚠️ {error}
          </div>
          
          <div className="instructions">
            <p>Please request a new password reset link from the login page.</p>
          </div>
          
          <div className="action-links">
            <Link to="/forgot-password" className="action-link">
              Request New Reset Link
            </Link>
            <Link to="/login" className="action-link">
              Back to Login
            </Link>
          </div>
          
          <p className="copyright">
            © 2026 Power Pipeline Systems. Critical Infrastructure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        {/* Header */}
        <div className="reset-password-header">
          <h1>Set New Password</h1>
          <p className="reset-password-subtitle">Create a new password for your account</p>
        </div>

        {/* Instructions */}
        <div className="instructions">
          <p>Enter your new password below. Make sure it's at least 8 characters long.</p>
        </div>

        {/* Reset Password Form */}
        <form onSubmit={handleSubmit} className="reset-password-form">
          <div className="form-group">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              New Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              className="form-input"
              disabled={isLoading}
              autoComplete="new-password"
            />
            <div className="password-hint">
              Must be at least 8 characters long
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              <span className="label-icon">🔐</span>
              Confirm New Password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
              className="form-input"
              disabled={isLoading}
              autoComplete="new-password"
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
                Updating Password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>

          {/* Security Notice */}
          <div className="security-notice">
            <p>
              <strong>🔒 Security Tip:</strong> Use a strong password that you don't use elsewhere.
              Consider using a password manager.
            </p>
          </div>
        </form>

        {/* Footer Links */}
        <div className="reset-password-footer">
          <div className="action-links">
            <Link to="/login" className="action-link">
              ← Back to Login
            </Link>
          </div>
          <p className="copyright">
            © 2026 Power Pipeline Systems. Critical Infrastructure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;