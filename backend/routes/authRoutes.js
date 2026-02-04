const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const emailService = require('../services/emailService');

// ========== EMAIL APPROVAL ENDPOINT (FOR EMAIL LINKS) ==========
// This handles the email links that admins click to approve users
router.get('/api/approve/:token', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { token } = req.params;
    console.log(`📧 Email approval link clicked for token: ${token}`);
    
    // Find user by approval token
    const userResult = await client.query(
      `SELECT id, username, email, full_name, status 
       FROM pipeline_dashboard.users 
       WHERE approval_token = $1 AND status = 'pending_approval'`,
      [token]
    );
    
    if (userResult.rows.length === 0) {
      // Show nice HTML error page
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Approval Link</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { background: #f8d7da; color: #721c24; padding: 30px; border-radius: 10px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Invalid Approval Link</h1>
            <p>This approval link is invalid, has expired, or the user has already been approved.</p>
            <p>Please contact the administrator if you believe this is an error.</p>
            <br>
            <a href="${process.env.FRONTEND_URL || 'https://platform.power-transitions.com'}/login" 
               style="background:#6c757d;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
              Go to Login
            </a>
          </div>
        </body>
        </html>
      `);
    }
    
    const user = userResult.rows[0];
    
    // Start transaction
    await client.query('BEGIN');
    
    // Update user status to active
    await client.query(
      `UPDATE pipeline_dashboard.users 
       SET status = 'active', 
           approval_token = NULL,
           approved_at = NOW(),
           approved_by = 'email_link'
       WHERE id = $1`,
      [user.id]
    );
    
    // Insert audit log
    await client.query(
      `INSERT INTO pipeline_dashboard.audit_logs 
       (user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        'account_approved',
        JSON.stringify({ 
          approved_by: 'email_link', 
          approval_method: 'email_token',
          token_used: token.substring(0, 8) + '...'
        }),
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent') || 'unknown'
      ]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Send approval email to user
    await emailService.sendApprovalEmail({
      username: user.username,
      email: user.email,
      full_name: user.full_name || user.username,
      role: 'user',
      approval_date: new Date().toLocaleDateString()
    });
    
    // Show success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Account Approved - Power Pipeline</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; }
          .success { background: #d4edda; color: #155724; padding: 40px; border-radius: 15px; max-width: 600px; margin: 0 auto; }
          .user-info { background: white; padding: 20px; margin: 25px 0; border-radius: 10px; text-align: left; }
          .button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1 style="margin-top: 0;">✅ Account Approved Successfully!</h1>
          
          <div class="user-info">
            <h3 style="margin-top: 0; color: #333;">User Details:</h3>
            <p><strong>Username:</strong> ${user.username}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Full Name:</strong> ${user.full_name || 'Not provided'}</p>
            <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Active</span></p>
            <p><strong>Approved:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>✅ An approval email has been sent to: <strong>${user.email}</strong></p>
          <p>✅ The user can now login to the Power Pipeline Dashboard.</p>
          
          <br>
          <a href="${process.env.FRONTEND_URL || 'https://platform.power-transitions.com'}/login" class="button">
            Go to Login Page
          </a>
          
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            <em>Power Pipeline Dashboard - Account Approval System</em>
          </p>
        </div>
      </body>
      </html>
    `);
    
    console.log(`✅ User ${user.username} (${user.email}) approved via email link`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Email approval error:', error);
    
    // Show error page
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <body style="text-align:center;padding:50px;font-family:Arial;">
        <h1 style="color:#dc3545;">⚠️ Server Error</h1>
        <p>An error occurred while processing the approval.</p>
        <p>Please try again or contact the administrator.</p>
      </body>
      </html>
    `);
  } finally {
    client.release();
  }
});

// ========== REGISTRATION ENDPOINT ==========
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { username, email, password, full_name } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, email, and password are required' 
      });
    }
    
    // Validate email domain - ONLY allow @power-transitions.com
    const emailDomain = email.split('@')[1];
    if (emailDomain !== 'power-transitions.com') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only @power-transitions.com email addresses are allowed for registration' 
      });
    }
    
    // Check if user already exists
    const userCheck = await client.query(
      'SELECT id FROM pipeline_dashboard.users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Username or email already exists' 
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Generate approval token
    const approvalToken = crypto.randomBytes(32).toString('hex');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Insert user with pending status
    const userResult = await client.query(
      `INSERT INTO pipeline_dashboard.users 
       (username, email, password_hash, full_name, status, role, created_at, approval_token)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       RETURNING id, username, email, full_name, status, role, created_at`,
      [
        username, 
        email, 
        hashedPassword, 
        full_name || null, 
        'pending_approval', 
        'user', 
        approvalToken
      ]
    );
    
    const newUser = userResult.rows[0];
    
    // Insert audit log
    await client.query(
      `INSERT INTO pipeline_dashboard.audit_logs 
       (user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newUser.id,
        'registration_request',
        JSON.stringify({ 
          username, 
          email, 
          status: 'pending_approval' 
        }),
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent') || 'unknown'
      ]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Send registration email to user
    const emailResult = await emailService.sendRegistrationEmail({
      username: newUser.username,
      email: newUser.email,
      full_name: newUser.full_name
    });

const backendUrl = process.env.BACKEND_URL || 'https://pt-power-pipeline-api.azurewebsites.net';
//const approvalLink = `${backendUrl}/api/admin/approve/${approvalToken}`;

const approvalLink = `${backendUrl}/admin/approve/${approvalToken}`;
  
    
    await emailService.sendAdminNotification(
      newUser, 
      approvalLink  
    );
    
    res.status(201).json({
      success: true,
      message: 'Registration submitted for admin approval. You will receive an email once approved.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        status: newUser.status
      },
      emailSent: emailResult.success,
      debug: process.env.NODE_ENV === 'development' ? {
        approvalToken: approvalToken,
        approvalLink: approvalLink,
        note: 'In production, admin receives email with this link'
      } : undefined
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  } finally {
    client.release();
  }
});

// ========== REDIRECT FOR OLD EMAIL LINKS (Backward Compatibility) ==========
// If someone has an old email with the wrong link, redirect them
router.get('/admin/approve/:token', async (req, res) => {
  const { token } = req.params;
  const user = req.query.user || '';
  
  // Redirect to the correct API endpoint
  const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'https://pt-power-pipeline-dashboard.azurestaticapps.net';
  const redirectUrl = `${backendUrl}/api/approve/${token}${user ? `?user=${encodeURIComponent(user)}` : ''}`;
  
  res.redirect(redirectUrl);
});

// ========== FORGOT PASSWORD ENDPOINT ==========
router.post('/forgot-password', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    // Validate email domain
    const emailDomain = email.split('@')[1];
    if (emailDomain !== 'power-transitions.com') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only @power-transitions.com email addresses are allowed' 
      });
    }
    
    // Check if user exists and is active
    const userResult = await client.query(
      `SELECT id, username, email FROM pipeline_dashboard.users 
       WHERE email = $1 AND status = 'active'`,
      [email]
    );
    
    if (userResult.rows.length === 0) {
      // Don't reveal if user exists or not
      return res.json({ 
        success: true, 
        message: 'If your email exists in our system, you will receive a reset link' 
      });
    }
    
    const user = userResult.rows[0];
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    
    // Store reset token
    await client.query(
      `UPDATE pipeline_dashboard.users 
       SET reset_token = $1, reset_token_expiry = $2
       WHERE id = $3`,
      [resetToken, resetTokenExpiry, user.id]
    );
    
    // Send password reset email
    const emailResult = await emailService.sendPasswordResetEmail(user, resetToken);
    
    // Insert audit log
    await client.query(
      `INSERT INTO pipeline_dashboard.audit_logs 
       (user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        'password_reset_requested',
        JSON.stringify({ email_sent: emailResult.success }),
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent') || 'unknown'
      ]
    );
    
    res.json({
      success: true,
      message: 'Password reset email sent if the email exists in our system'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error processing reset request' 
    });
  } finally {
    client.release();
  }
});

// ========== GET PENDING APPROVALS (FOR ADMIN PANEL) ==========
router.get('/admin/pending-approvals', async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Verify admin authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token and check admin role
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userCheck = await client.query(
      `SELECT role FROM pipeline_dashboard.users WHERE id = $1 AND status = 'active'`,
      [decoded.userId]
    );
    
    if (userCheck.rows.length === 0 || userCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    // Get pending approvals
    const result = await client.query(
      `SELECT id, username, email, full_name, created_at 
       FROM pipeline_dashboard.users 
       WHERE status = 'pending_approval'
       ORDER BY created_at DESC`
    );
    
    res.json({
      success: true,
      pendingUsers: result.rows
    });
    
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching pending approvals' 
    });
  } finally {
    client.release();
  }
});

// ========== APPROVAL ENDPOINT (MISSING - ADD THIS) ==========
router.get('/api/approve/:token', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { token } = req.params;
    console.log(`📧 Approval request for token: ${token}`);
    
    // Find user by approval token
    const userResult = await client.query(
      `SELECT u.id, u.username, u.email, u.status, t.token
       FROM pipeline_dashboard.users u
       JOIN pipeline_dashboard.approval_tokens t ON u.id = t.user_id
       WHERE t.token = $1 AND u.status = 'pending_approval'`,
      [token]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired approval token'
      });
    }
    
    const user = userResult.rows[0];
    
    // Start transaction
    await client.query('BEGIN');
    
    // Update user status to active
    await client.query(
      `UPDATE pipeline_dashboard.users 
       SET status = 'active', 
           approved_at = NOW(),
           approved_by = 'system'
       WHERE id = $1`,
      [user.id]
    );
    
    // Remove used token
    await client.query(
      `DELETE FROM pipeline_dashboard.approval_tokens 
       WHERE token = $1`,
      [token]
    );
    
    // Insert audit log
    await client.query(
      `INSERT INTO pipeline_dashboard.audit_logs 
       (user_id, action, details)
       VALUES ($1, 'account_approved', $2)`,
      [user.id, JSON.stringify({ method: 'email_token', token: token.substring(0, 10) + '...' })]
    );
    
    await client.query('COMMIT');
    
    // Send approval email
    await emailService.sendApprovalEmail({
      username: user.username,
      email: user.email,
      role: 'user'
    });
    
    // Return success
    res.json({
      success: true,
      message: `User ${user.username} approved successfully`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: 'active'
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during approval'
    });
  } finally {
    client.release();
  }
});


// ========== TEST ENDPOINT ==========
router.get('/test-approval', async (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes are working',
    endpoints: {
      register: 'POST /auth/register',
      emailApproval: 'GET /api/approve/:token',
      forgotPassword: 'POST /auth/forgot-password',
      pendingApprovals: 'GET /auth/admin/pending-approvals (admin only)'
    },
    note: 'Email links should go to: /api/approve/{token}'
  });
});

module.exports = router;
