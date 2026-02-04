import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

const ApprovalSuccess = () => {
  const { token } = useParams(); 
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Processing approval...');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [userInfo, setUserInfo] = useState({
    username: '',
    email: '',
    fullName: ''
  });
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const processApproval = async () => {
      try {
        if (token) {
          const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
          const response = await fetch(`${backendUrl}/api/admin/approve/${token}`);
          
          if (response.ok) {
            setSuccess(true);
            setMessage('Account approved successfully!');
          } else {
            setSuccess(false);
            setMessage('Approval failed. Please try again or contact support.');
          }
        } else {
          setSuccess(true);
          setMessage('Account approved successfully!');
        }
        
        const params = new URLSearchParams(location.search);
        const urlUser = params.get('user');
        const urlEmail = params.get('email');
        const urlName = params.get('name');
        
        if (urlUser) setUserInfo(prev => ({ ...prev, username: decodeURIComponent(urlUser) }));
        if (urlEmail) setUserInfo(prev => ({ ...prev, email: decodeURIComponent(urlEmail) }));
        if (urlName) setUserInfo(prev => ({ ...prev, fullName: decodeURIComponent(urlName) }));
        
      } catch (error) {
        console.error('Approval error:', error);
        setSuccess(false);
        setMessage('An error occurred during approval.');
      } finally {
        setLoading(false);
      }
    };

    processApproval();
  }, [token, location]);

  const handleNavigation = (path) => {
    setShowDropdown(false);
    navigate(path);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const renderUserInfo = () => {
    if (!userInfo.username && !userInfo.email && !userInfo.fullName) {
      return null;
    }
    
    return (
      <div style={styles.userInfo}>
        <h3 style={styles.userInfoTitle}>Approved User:</h3>
        {userInfo.username && (
          <p style={styles.userInfoItem}>
            <strong>Username:</strong> {userInfo.username}
          </p>
        )}
        {userInfo.email && (
          <p style={styles.userInfoItem}>
            <strong>Email:</strong> {userInfo.email}
          </p>
        )}
        {userInfo.fullName && (
          <p style={styles.userInfoItem}>
            <strong>Full Name:</strong> {userInfo.fullName}
          </p>
        )}
        <p style={styles.userInfoNote}>
          This user can now log in with their credentials.
        </p>
      </div>
    );
  };

  const isAdminContext = userInfo.email.includes('power-transitions.com') || 
                        location.pathname.includes('admin');

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>
          {loading ? '⏳' : (success ? '✅' : '❌')}
        </div>
        
        <h1>{loading ? 'Processing Approval...' : (success ? 'Account Approved!' : 'Approval Failed')}</h1>
        
        <p style={styles.message}>{message}</p>
        
        {success && renderUserInfo()}
        
        <div style={styles.actions}>
          <div style={styles.buttonGroup}>
            <button 
              onClick={toggleDropdown}
              style={styles.primaryButton}
              disabled={loading}
            >
              Next Steps ▾
            </button>
            
            {showDropdown && (
              <div style={styles.dropdown}>
                {isAdminContext ? (
                  <>
                    <button 
                      onClick={() => handleNavigation('/admin/approvals')}
                      style={styles.dropdownItem}
                    >
                      ⚙️ Admin Panel
                    </button>
                    <button 
                      onClick={() => handleNavigation('/admin/users')}
                      style={styles.dropdownItem}
                    >
                      👥 Manage Users
                    </button>
                    <button 
                      onClick={() => handleNavigation('/dashboard')}
                      style={styles.dropdownItem}
                    >
                      📊 Dashboard
                    </button>
                    <div style={styles.dropdownDivider}></div>
                  </>
                ) : null}
                
                <button 
                  onClick={() => handleNavigation('/login')}
                  style={styles.dropdownItem}
                >
                  🔐 Login
                </button>
                <button 
                  onClick={() => handleNavigation('/')}
                  style={styles.dropdownItem}
                >
                  🏠 Home
                </button>
                <button 
                  onClick={() => handleNavigation('/register')}
                  style={styles.dropdownItem}
                >
                  📝 Register
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div style={styles.footer}>
          <p>Power Transitions Platform</p>
          <p style={styles.version}>v1.0 • Secure Approval System</p>
        </div>
      </div>
      
      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div 
          style={styles.dropdownOverlay}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    position: 'relative',
  },
  card: {
    background: 'white',
    padding: '40px',
    borderRadius: '15px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
    maxWidth: '500px',
    width: '100%',
    position: 'relative',
    zIndex: 10,
  },
  icon: {
    fontSize: '4rem',
    marginBottom: '20px',
    animation: 'pulse 2s infinite',
  },
  message: {
    fontSize: '1.1rem',
    color: '#555',
    marginBottom: '30px',
    lineHeight: '1.6',
  },
  userInfo: {
    background: '#e8f5e9',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px',
    textAlign: 'left',
    borderLeft: '4px solid #28a745',
  },
  userInfoTitle: {
    marginTop: '0',
    marginBottom: '15px',
    color: '#155724',
    fontSize: '1.2rem',
  },
  userInfoItem: {
    margin: '8px 0',
    color: '#333',
  },
  userInfoNote: {
    marginTop: '15px',
    paddingTop: '15px',
    borderTop: '1px solid #c3e6cb',
    color: '#155724',
    fontStyle: 'italic',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
    position: 'relative',
  },
  buttonGroup: {
    position: 'relative',
  },
  primaryButton: {
    padding: '12px 30px',
    background: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    minWidth: '200px',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: '0',
    right: '0',
    background: 'white',
    borderRadius: '6px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    marginTop: '5px',
    overflow: 'hidden',
    zIndex: 1000,
    animation: 'slideDown 0.3s ease',
  },
  dropdownItem: {
    padding: '12px 20px',
    background: 'transparent',
    color: '#333',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #f0f0f0',
  },
  dropdownDivider: {
    height: '1px',
    background: '#e0e0e0',
    margin: '5px 0',
  },
  dropdownOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'transparent',
    zIndex: 5,
  },
  footer: {
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #eee',
    color: '#777',
    fontSize: '0.9rem',
  },
  version: {
    fontSize: '0.8rem',
    color: '#aaa',
    marginTop: '5px',
  },
};

// Add CSS animations
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`, styleSheet.cssRules.length);

styleSheet.insertRule(`
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`, styleSheet.cssRules.length);

// Add hover effects
styleSheet.insertRule(`
  .dropdown-item:hover {
    background: #f8f9fa;
  }
`, styleSheet.cssRules.length);

styleSheet.insertRule(`
  .primary-button:hover {
    background: #218838;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(40, 167, 69, 0.3);
  }
`, styleSheet.cssRules.length);

// Apply hover classes
setTimeout(() => {
  const primaryButton = document.querySelector('[style*="primaryButton"]');
  const dropdownItems = document.querySelectorAll('[style*="dropdownItem"]');
  
  if (primaryButton) primaryButton.classList.add('primary-button');
  dropdownItems.forEach(item => item.classList.add('dropdown-item'));
}, 100);

export default ApprovalSuccess;
