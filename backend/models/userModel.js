// userModel.js - Basic structure
const db = require('./db'); // Your database connection

class UserModel {
  // Get pending users
  async getPendingUsers(filters = {}) {
    const query = `
      SELECT id, username, email, full_name, created_at, registration_ip
      FROM users
      WHERE status = 'pending'
      ${filters.search ? `AND (username ILIKE $1 OR email ILIKE $1)` : ''}
      ORDER BY created_at DESC
      LIMIT $${filters.search ? '2' : '1'}
      OFFSET $${filters.search ? '3' : '2'}
    `;
    
    const params = [];
    if (filters.search) params.push(`%${filters.search}%`);
    params.push(filters.limit || 50);
    params.push(filters.offset || 0);
    
    const result = await db.query(query, params);
    return result.rows;
  }
  
  // Approve user by ID
  async approveUserById(userId) {
    const query = `
      UPDATE users 
      SET status = 'approved', 
          approved_at = NOW(),
          approved_by = $2
      WHERE id = $1 AND status = 'pending'
      RETURNING id, username, email, status, approved_at
    `;
    
    const result = await db.query(query, [userId, 'admin']);
    return result.rows[0];
  }
  
  // Approve user by token (from email link)
  async approveUserByToken(token) {
    const query = `
      UPDATE users 
      SET status = 'approved', 
          approved_at = NOW(),
          approval_token = NULL
      WHERE approval_token = $1 AND status = 'pending'
      RETURNING id, username, email, status, approved_at
    `;
    
    const result = await db.query(query, [token]);
    return result.rows[0];
  }
  
  // Reject user
  async rejectUserById(userId, reason) {
    const query = `
      UPDATE users 
      SET status = 'rejected', 
          rejected_at = NOW(),
          rejection_reason = $2,
          approved_by = $3
      WHERE id = $1 AND status = 'pending'
      RETURNING id, username, email, status, rejected_at
    `;
    
    const result = await db.query(query, [userId, reason || 'No reason provided', 'admin']);
    return result.rows[0];
  }
  
  // Get user by ID
  async getUserById(userId) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }
  
  // Generate approval token
  async generateApprovalToken(userId) {
    const token = require('crypto').randomBytes(32).toString('hex');
    
    const query = `
      UPDATE users 
      SET approval_token = $1 
      WHERE id = $2
      RETURNING approval_token
    `;
    
    const result = await db.query(query, [token, userId]);
    return token;
  }
  
  // Get user statistics
  async getUserStats() {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_users,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_users,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_users,
        MIN(created_at) as first_registration,
        MAX(created_at) as last_registration
      FROM users
    `;
    
    const result = await db.query(query);
    return result.rows[0];
  }
}

module.exports = new UserModel();
