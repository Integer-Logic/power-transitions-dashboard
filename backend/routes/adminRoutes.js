const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get pending users (admin only)
router.get('/pending-users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const query = await req.db.query(
      `SELECT id, username, email, full_name, created_at 
       FROM pipeline_dashboard.users 
       WHERE status = 'pending_approval'
       ORDER BY created_at DESC`
    );
    
    res.json(query.rows);
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pending users' 
    });
  }
});

// Approve user (admin only)
router.post('/approve-user/:id', authenticateToken, isAdmin, async (req, res) => {
  const client = await req.db.connect();
  
  try {
    const { id } = req.params;
    const { role = 'operator' } = req.body;
    const adminId = req.user.id;
    
    // Start transaction
    await client.query('BEGIN');
    
    // Get user current status
    const userQuery = await client.query(
      `SELECT id, username, email, status, role FROM pipeline_dashboard.users 
       WHERE id = $1`,
      [id]
    );
    
    if (userQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = userQuery.rows[0];
    
    if (user.status !== 'pending_approval') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `User is not pending approval (current status: ${user.status})` 
      });
    }
    
    // Update user
    await client.query(
      `UPDATE pipeline_dashboard.users 
       SET status = 'active', 
           role = $1,
           approved_by = $2,
           approved_at = NOW()
       WHERE id = $3`,
      [role, adminId, id]
    );
    
    // Log admin action
    await client.query(
      `INSERT INTO pipeline_dashboard.admin_actions 
        (admin_id, target_user_id, action_type, previous_status, new_status, previous_role, new_role) 
       VALUES ($1, $2, 'approve', $3, 'active', $4, $5)`,
      [adminId, id, user.status, user.role, role]
    );
    
    // Send approval email to user
    const emailContent = {
      to: user.email,
      subject: 'Account Approved - Power Pipeline Dashboard',
      html: `
        <h2>Your Account Has Been Approved!</h2>
        <p>Your Power Pipeline Dashboard account has been approved by an administrator.</p>
        
        <div style="background:#d4edda;padding:15px;border-radius:8px;margin:20px 0;">
          <h3 style="color:#155724;">Account Details:</h3>
          <ul>
            <li><strong>Username:</strong> ${user.username}</li>
            <li><strong>Role:</strong> ${role}</li>
            <li><strong>Status:</strong> Active</li>
            <li><strong>Approval Date:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
        </div>
        
       
       <a href="${process.env.FRONTEND_URL || 'https://platform.power-transitions.com'}/login"
           style="background:#28a745;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
          Log In Now
        </a></p>
        
        <p>You can now log in with your credentials.</p>
        <hr>
        <p><em>Power Pipeline Dashboard - Account Activation</em></p>
      `
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 [DEV] Approval email would be sent to: ${user.email}`);
    } else {
      await sendEmail(emailContent);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `User ${user.username} approved with ${role} role`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: role,
        status: 'active'
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to approve user' 
    });
  } finally {
    client.release();
  }
});

// Reject user (admin only)
router.post('/reject-user/:id', authenticateToken, isAdmin, async (req, res) => {
  const client = await req.db.connect();
  
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;
    const adminId = req.user.id;
    
    // Start transaction
    await client.query('BEGIN');
    
    // Get user details
    const userQuery = await client.query(
      `SELECT id, username, email, status FROM pipeline_dashboard.users 
       WHERE id = $1`,
      [id]
    );
    
    if (userQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = userQuery.rows[0];
    
    if (user.status !== 'pending_approval') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `User is not pending approval (current status: ${user.status})` 
      });
    }
    
    // Update user
    await client.query(
      `UPDATE pipeline_dashboard.users 
       SET status = 'rejected',
           rejection_reason = $1
       WHERE id = $2`,
      [reason, id]
    );
    
    // Log admin action
    await client.query(
      `INSERT INTO pipeline_dashboard.admin_actions 
        (admin_id, target_user_id, action_type, previous_status, new_status, notes) 
       VALUES ($1, $2, 'reject', $3, 'rejected', $4)`,
      [adminId, id, user.status, reason]
    );
    
    // Send rejection email to user
    const emailContent = {
      to: user.email,
      subject: 'Registration Status - Power Pipeline Dashboard',
      html: `
        <h2>Registration Update</h2>
        <p>Your registration for Power Pipeline Dashboard has been reviewed.</p>
        
        <div style="background:#f8d7da;padding:15px;border-radius:8px;margin:20px 0;">
          <h3 style="color:#721c24;">Status: Not Approved</h3>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>Your account registration has not been approved at this time.</p>
        </div>
        
        <p>If you believe this is an error, please contact the system administrator.</p>
        <hr>
        <p><em>Power Pipeline Dashboard - Registration Update</em></p>
      `
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 [DEV] Rejection email would be sent to: ${user.email}`);
    } else {
      await sendEmail(emailContent);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `User ${user.username} rejected`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: 'rejected'
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reject user' 
    });
  } finally {
    client.release();
  }
});

// Get all users for management (admin only)
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, role, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT id, username, email, full_name, role, status, 
             approved_at, last_login, login_count, created_at,
             (SELECT COUNT(*) FROM pipeline_dashboard.users) as total_count
      FROM pipeline_dashboard.users
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(role);
    }
    
    if (search) {
      paramCount++;
      query += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await req.db.query(query, params);
    
    res.json({
      success: true,
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0,
        totalPages: Math.ceil((result.rows[0]?.total_count || 0) / limit)
      }
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users' 
    });
  }
});

module.exports = router;
