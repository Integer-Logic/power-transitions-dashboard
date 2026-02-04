import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import axios from 'axios';

// Create context outside component
const AuthContext = createContext(null);

// Separate hook outside component
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Main provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Initialize from localStorage
    const storedUser = localStorage.getItem('pipeline_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('pipeline_token'));

  // ⭐⭐ CRITICAL: Use environment variable with fallback ⭐⭐
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Configure axios defaults once
  useEffect(() => {
    console.log('🔧 AuthContext using API_URL:', API_URL);
    axios.defaults.baseURL = API_URL;
    axios.defaults.headers.common['Content-Type'] = 'application/json';
    
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [API_URL, token]);

  // Check for existing session on mount
  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('pipeline_token');
      const storedUser = localStorage.getItem('pipeline_user');
      
      if (storedToken && storedUser) {
        try {
          // Verify token with backend
          const response = await axios.post('/api/auth/verify', { token: storedToken }, {
            timeout: 5000
          });
          
          if (response.data.valid) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            console.log('✅ Token verified, user authenticated');
          } else {
            // Token invalid, clear storage
            console.log('❌ Token invalid, clearing storage');
            localStorage.removeItem('pipeline_token');
            localStorage.removeItem('pipeline_user');
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          console.error('Token verification failed:', error.message);
          localStorage.removeItem('pipeline_token');
          localStorage.removeItem('pipeline_user');
          setToken(null);
          setUser(null);
        }
      } else {
        console.log('No stored token or user found');
      }
      setLoading(false);
    };

    verifyToken();
  }, []);

  const register = async (userData) => {
    try {
      console.log('🔵 Registering user via:', API_URL);
      
      const response = await axios.post('/api/auth/register', {
        ...userData,
        status: 'pending_approval'
      }, {
        timeout: 10000
      });

      return { 
        success: true, 
        message: response.data.message || 'Registration submitted for admin approval.'
      };
      
    } catch (error) {
      console.error('Registration error:', error);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Registration request timed out.';
      } else if (error.response) {
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Cannot connect to server. Check if backend is running.';
      }
      
      return { 
        success: false, 
        message: errorMessage
      };
    }
  };

  const checkRegistrationStatus = async (email) => {
    try {
      const response = await axios.get(`/api/auth/registration-status/${encodeURIComponent(email)}`);
      return { success: true, status: response.data.status };
    } catch (error) {
      return { success: false, message: 'Could not check registration status' };
    }
  };

  const login = async (credentials) => {
    try {
      console.log('🔐 Attempting login via:', API_URL);
      
      // Simplified client info - remove IP fetching for now
      const clientInfo = {
        ip_address: '127.0.0.1',
        user_agent: navigator.userAgent,
        device_fingerprint: generateDeviceFingerprint()
      };

      // ⭐⭐ SIMPLIFIED: Remove complex IP fetching that might fail ⭐⭐
      const response = await axios.post('/api/auth/login', {
        ...credentials,
        ...clientInfo
      }, {
        timeout: 10000
      });

      // Check if login was successful
      if (response.status === 200 || response.status === 201) {
        const { token: newToken, user: userData } = response.data;
        
        console.log('✅ Login successful, storing token and user');
        
        // Store token and user
        localStorage.setItem('pipeline_token', newToken);
        localStorage.setItem('pipeline_user', JSON.stringify(userData));
        
        // Update axios defaults
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Update state
        setToken(newToken);
        setUser(userData);
        
        return { 
          success: true, 
          user: userData,
          token: newToken
        };
      } else {
        // Login failed but server responded
        return {
          success: false,
          message: response.data?.message || 'Login failed.'
        };
      }
      
    } catch (error) {
      console.error('❌ Login error:', error);
      
      let errorMessage = 'Login failed. Please check credentials.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Login request timed out.';
      } else if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Invalid credentials or account not approved.';
        } else if (error.response.status === 404) {
          errorMessage = 'Login endpoint not found. Check backend URL.';
        } else {
          errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = `Cannot connect to server at ${API_URL}. Check:\n1. Backend is running\n2. Network connection`;
      }
      
      return { 
        success: false, 
        message: errorMessage
      };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await axios.post('/api/auth/forgot-password', { email }, {
        timeout: 10000
      });

      return { 
        success: true, 
        message: response.data.message || 'Password reset email sent'
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to process request' 
      };
    }
  };

  const resetPassword = async (token, password) => {
    try {
      const response = await axios.post(`/api/auth/reset-password/${token}`, { password }, {
        timeout: 10000
      });

      return { 
        success: true, 
        message: response.data.message || 'Password reset successful'
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to reset password' 
      };
    }
  };

  const logout = async () => {
    // Call logout API if token exists
    if (token) {
      try {
        await axios.post('/api/auth/logout', { token });
      } catch (error) {
        console.warn('Logout API call failed:', error.message);
      }
    }
    
    // Clear local storage
    localStorage.removeItem('pipeline_token');
    localStorage.removeItem('pipeline_user');
    
    // Clear axios headers
    delete axios.defaults.headers.common['Authorization'];
    
    // Reset state
    setToken(null);
    setUser(null);
    
    // Redirect to login
    window.location.href = '/login';
  };

  // Admin functions
  const getPendingUsers = async () => {
    try {
      const response = await axios.get('/api/admin/pending-users');
      return { success: true, users: response.data };
    } catch (error) {
      console.error('Get pending users error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to fetch pending users' 
      };
    }
  };

  const approveUser = async (userId, role = 'operator') => {
    try {
      const response = await axios.post(`/api/admin/approve-user/${userId}`, { role });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Approve user error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to approve user' 
      };
    }
  };

  const rejectUser = async (userId, reason = '') => {
    try {
      const response = await axios.post(`/api/admin/reject-user/${userId}`, { reason });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Reject user error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to reject user' 
      };
    }
  };

  // Generate a simple device fingerprint
  const generateDeviceFingerprint = () => {
    try {
      const navigatorInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`
      };
      
      const infoString = JSON.stringify(navigatorInfo);
      return btoa(infoString).substring(0, 32);
    } catch (error) {
      return 'device-' + Date.now();
    }
  };

  // Test backend connection
  const testBackendConnection = async () => {
    try {
      const response = await axios.get('/health', {
        timeout: 5000
      });
      
      return {
        success: response.status === 200,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        apiUrl: API_URL
      };
    }
  };

  // Memoize the context value
  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    register,
    login,
    logout,
    forgotPassword,
    resetPassword,
    checkRegistrationStatus,
    getPendingUsers,
    approveUser,
    rejectUser,
    testBackendConnection,
    isAuthenticated: !!token,
    apiUrl: API_URL // Expose for debugging
  }), [user, token, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
