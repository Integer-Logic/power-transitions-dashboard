import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/powerTransitionLogo.png';
import './Login.css';

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(credentials);
    
    if (result.success) {
      // Redirect to dashboard
      navigate('/dashboard');
    } else {
      setError(result.message);
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  // Validation helpers
  const isUsernameValid = credentials.username.length >= 3;
  const isPasswordValid = credentials.password.length >= 6;

  // Demo credentials for testing (remove in production)
  const loadDemoCredentials = (role) => {
    const demos = {
      operator: { username: 'operator', password: 'PipelineSecure2024!' },
      engineer: { username: 'engineer', password: 'PipelineSecure2024!' },
      admin: { username: 'admin', password: 'PipelineSecure2024!' }
    };
    setCredentials(demos[role]);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="company-branding">
            <img 
              src={logo} 
              alt="Power Transitions Logo" 
              style={{ 
                height: "40px", 
                objectFit: "contain",
                filter: "brightness(0) invert(1)" 
              }} 
            />
          </div>
          <p className="login-subtitle">Login Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {/* Username Field */}
          <div className={`form-group ${touched.username && !isUsernameValid ? 'has-error' : ''} ${touched.username && isUsernameValid ? 'has-success' : ''}`}>
            <label htmlFor="username">
              <svg className="label-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Username
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleInputChange}
                onBlur={() => handleBlur('username')}
                placeholder="Enter your username"
                required
                className="form-input"
                disabled={isLoading}
                autoComplete="username"
              />
              {touched.username && isUsernameValid && (
                <span className="input-status success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              )}
            </div>
            {touched.username && !isUsernameValid && credentials.username.length > 0 && (
              <span className="field-error">Username must be at least 3 characters</span>
            )}
          </div>

          {/* Password Field */}
          <div className={`form-group ${touched.password && !isPasswordValid ? 'has-error' : ''} ${touched.password && isPasswordValid ? 'has-success' : ''}`}>
            <label htmlFor="password">
              <svg className="label-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Password
            </label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                onBlur={() => handleBlur('password')}
                placeholder="Enter your password"
                required
                className="form-input has-toggle"
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {touched.password && !isPasswordValid && credentials.password.length > 0 && (
              <span className="field-error">Password must be at least 6 characters</span>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Authenticating...
              </>
            ) : (
              'Secure Login'
            )}
          </button>

          {/* Security Notice */}
          <div className="security-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p>
              <strong>Security Notice:</strong> This system contains sensitive operational data.
              All access is logged and monitored. Unauthorized access is prohibited.
            </p>
          </div>
        </form>

        <div className="login-footer">
  <div className="footer-links">
    <Link to="/forgot-password" className="footer-link">Forgot Password?</Link> {/* UPDATE THIS */}
    <span className="separator">•</span>
    <Link to="/register" className="footer-link">Create Account</Link> {/* ADD THIS */}
    <span className="separator">•</span>
    <a href="#" className="footer-link">Emergency Procedures</a>
  </div>
  <p className="copyright">
    © 2026 Power Transitions Platform. Critical Infrastructure.
  </p>
</div>

      </div>
    </div>
  );
};

export default Login;
