import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Register.css';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationId, setRegistrationId] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    if (!formData.username || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    
    const result = await register({
      username: formData.username,
      email: formData.email,
      password: formData.password,
      full_name: formData.full_name
    });
    
    if (result.success) {
      setSuccess(result.message);
      // Store registration email for status checking
      setRegistrationId(formData.email);
      
      // Clear form
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        full_name: ''
      });
    } else {
      setError(result.message);
    }
    
    setIsLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckStatus = () => {
    if (registrationId) {
      navigate('/login');
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        {/* Header */}
        <div className="register-header">
          <h1>Create Account</h1>
          <p className="register-subtitle">Join Power Transitions Platform</p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="username">
                <span className="label-icon">👤</span>
                Username *
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Choose a username"
                required
                className="form-input"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">
                <span className="label-icon">✉️</span>
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your.email@example.com"
                required
                className="form-input"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="full_name">
                <span className="label-icon">👋</span>
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Your full name (optional)"
                className="form-input"
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">
                <span className="label-icon">🔒</span>
                Password *
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
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
                Confirm Password *
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                required
                className="form-input"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
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
              <div className="success-header">
                ✅ Registration Submitted for Approval
              </div>
              <p className="success-details">
                {success}
              </p>
              <div className="approval-process">
                <h4>Next Steps:</h4>
                <ol>
                  <li>An admin has been notified of your registration</li>
                  <li>You will receive an email at <strong>{registrationId}</strong> once approved</li>
                  <li>Approval typically takes 1-2 business days</li>
                  <li>You can try logging in after receiving approval email</li>
                </ol>
              </div>
              <div className="success-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCheckStatus}
                >
                  Proceed to Login
                </button>
                <button
                  type="button"
                  className="tertiary-button"
                  onClick={() => {
                    setSuccess('');
                    setRegistrationId('');
                  }}
                >
                  Register Another Account
                </button>
              </div>
            </div>
          )}

          {/* Submit Button - Only show if not successful */}
          {!success && (
            <button 
              type="submit" 
              className="register-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Submitting for Approval...
                </>
              ) : (
                'Submit for Approval'
              )}
            </button>
          )}

          {/* Security Notice */}
          <div className="security-notice">
            <p>
              <strong>🔒 Approval Process:</strong> All new accounts require admin approval 
              for security compliance. You'll receive email notifications throughout the process.
            </p>
           
          </div>
        </form>

        {/* Footer Links */}
        <div className="register-footer">
          <p className="login-link">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
          <div className="footer-links">
            <Link to="/forgot-password" className="footer-link">Forgot Password?</Link>
            <span className="separator">•</span>
            <a href="#" className="footer-link">Terms of Service</a>
            <span className="separator">•</span>
            <a href="#" className="footer-link">Privacy Policy</a>
          </div>
          <p className="copyright">
            © 2026 Power Transitions Platform. Critical Infrastructure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
