import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AdminApproval.css';

const AdminApproval = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedRole, setSelectedRole] = useState('operator');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchPendingUsers();
    } else {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pending users: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setPendingUsers(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to load pending users');
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to load pending users' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId, userEmail) => {
    try {
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          userId: userId,
          email: userEmail,
          role: selectedRole 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to approve user: ${response.status}`);
      }
      
      const data = await response.json();
      
      setMessage({ 
        type: 'success', 
        text: data.message || 'User approved successfully!' 
      });
      
      // Remove approved user from list
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error approving user:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to approve user' 
      });
    }
  };

  const handleReject = async (userId, userEmail, reason) => {
    try {
      const response = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          userId: userId,
          email: userEmail,
          reason: reason || 'No reason provided'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to reject user: ${response.status}`);
      }
      
      const data = await response.json();
      
      setMessage({ 
        type: 'success', 
        text: data.message || 'User rejected successfully!' 
      });
      
      // Remove rejected user from list
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedUser(null);
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error rejecting user:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to reject user' 
      });
    }
  };

  const openRejectModal = (user) => {
    setSelectedUser(user);
    setShowRejectModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleResendApprovalEmail = async (userId, username, email) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/resend-approval`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to resend approval email');
      }
      
      const data = await response.json();
      setMessage({ 
        type: 'success', 
        text: data.message || `Approval email resent to admin for ${username}` 
      });
      
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error resending approval email:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to resend approval email' 
      });
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="access-denied">
        <h2>🔒 Access Denied</h2>
        <p>Administrator privileges required to access this page.</p>
        <button 
          className="back-btn"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="admin-approval-container">
      <div className="admin-approval-header">
        <h1>👑 User Approval Portal</h1>
        <p className="subtitle">Approve or reject new user registrations</p>
        <div className="admin-info">
          <span className="admin-badge">Admin: {user.username}</span>
        </div>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? '✅' : '⚠️'} {message.text}
        </div>
      )}

      <div className="approval-controls">
        <div className="role-selector">
          <label htmlFor="defaultRole">Default approval role:</label>
          <select
            id="defaultRole"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="role-select"
          >
            <option value="operator">Operator</option>
            <option value="engineer">Engineer</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Administrator</option>
          </select>
          <span className="help-text">Selected role will be assigned to approved users</span>
        </div>
        
        <div className="control-buttons">
          <button 
            className="refresh-btn"
            onClick={fetchPendingUsers}
            disabled={loading}
          >
            {loading ? '⏳ Refreshing...' : '⟳ Refresh List'}
          </button>
          <button 
            className="stats-btn"
            onClick={() => navigate('/admin/stats')}
          >
            📊 View Stats
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading pending users...</p>
        </div>
      ) : pendingUsers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎉</div>
          <h3>No Pending Approvals</h3>
          <p>All user registrations have been processed.</p>
          <button 
            className="view-all-btn"
            onClick={() => navigate('/admin/users')}
          >
            View All Users
          </button>
        </div>
      ) : (
        <div className="pending-users-list">
          <div className="list-header">
            <div className="header-item user-info">User Information</div>
            <div className="header-item registration-date">Registration Date</div>
            <div className="header-item status">Status</div>
            <div className="header-item actions">Actions</div>
          </div>
          
          {pendingUsers.map((pendingUser) => (
            <div key={pendingUser.id} className="pending-user-card">
              <div className="user-info">
                <div className="user-name">
                  <strong>{pendingUser.full_name || 'No name provided'}</strong>
                  <span className="user-email">({pendingUser.email})</span>
                </div>
                <div className="user-details">
                  <span className="username">Username: {pendingUser.username}</span>
                  {pendingUser.registration_ip && (
                    <span className="user-ip">IP: {pendingUser.registration_ip}</span>
                  )}
                </div>
              </div>
              
              <div className="registration-date">
                {formatDate(pendingUser.created_at)}
              </div>
              
              <div className="status">
                <span className="status-badge pending">⏳ Pending</span>
              </div>
              
              <div className="actions">
                <div className="role-selector-inline">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="role-select-small"
                  >
                    <option value="operator">Operator</option>
                    <option value="engineer">Engineer</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                
                <div className="action-buttons">
                  <button
                    className="approve-btn"
                    onClick={() => handleApprove(pendingUser.id, pendingUser.email)}
                    title="Approve this user"
                  >
                    ✓ Approve
                  </button>
                  
                  <button
                    className="reject-btn"
                    onClick={() => openRejectModal(pendingUser)}
                    title="Reject this user"
                  >
                    ✗ Reject
                  </button>
                  
                  <button
                    className="resend-btn"
                    onClick={() => handleResendApprovalEmail(pendingUser.id, pendingUser.username, pendingUser.email)}
                    title="Resend approval email to admin"
                  >
                    ↻ Resend Email
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>✗ Reject User Registration</h3>
            <p>
              Are you sure you want to reject <strong>{selectedUser.full_name || selectedUser.username}</strong> ({selectedUser.email})?
            </p>
            
            <div className="form-group">
              <label htmlFor="rejectionReason">Reason for rejection (optional):</label>
              <textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a reason for rejection..."
                rows="3"
                className="reason-textarea"
              />
              <small>This reason will be logged but not sent to the user.</small>
            </div>
            
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedUser(null);
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-reject-btn"
                onClick={() => handleReject(selectedUser.id, selectedUser.email, rejectionReason)}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-footer">
        <div className="stats">
          <span className="stat">
            <strong>{pendingUsers.length}</strong> pending approval{pendingUsers.length !== 1 ? 's' : ''}
          </span>
          <span className="stat-separator">•</span>
          <span className="stat">
            Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <div className="footer-links">
          <button className="footer-link" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <span className="separator">•</span>
          <button className="footer-link" onClick={() => navigate('/admin/users')}>
            👥 Manage All Users
          </button>
          <span className="separator">•</span>
          <button className="footer-link" onClick={() => navigate('/admin/stats')}>
            📊 View Statistics
          </button>
        </div>
        
        <p className="security-notice">
          <strong>⚠️ Security Notice:</strong> All approval/rejection actions are logged and audited.
          Only approve @power-transitions.com emails.
        </p>
      </div>
    </div>
  );
};

export default AdminApproval;
