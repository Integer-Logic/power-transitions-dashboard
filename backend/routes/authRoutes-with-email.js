const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');

// Import the working email service
const emailService = require('../services/emailService-temporary');

// Initialize email service when server starts
let emailServiceReady = false;

(async () => {
  try {
    emailServiceReady = await emailService.initialize();
    console.log(emailServiceReady ? '✅ Email service initialized' : '❌ Email service failed');
  } catch (error) {
    console.error('Email service init error:', error);
  }
})();

// Registration endpoint with email notifications
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
        JSON.stringify({ username, email, status: 'pending_approval' }),
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent') || 'unknown'
      ]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    // ========== EMAIL NOTIFICATIONS ==========
    
    // Send registration email to user
    if (emailServiceReady) {
      try {
        const emailResult = await emailService.sendRegistrationEmail({
          username: newUser.username,
          email: newUser.email,
          full_name: newUser.full_name
        });
        
        if (emailResult.success) {
          console.log(`✅ Registration email sent to ${newUser.email}`);
          console.log(`📧 Preview: ${emailResult.previewUrl || 'N/A'}`);
        } else {
          console.log(`⚠️ Registration email failed: ${emailResult.error}`);
        }
      } catch (emailError) {
        console.error('Registration email error:', emailError);
      }
    }
    
    // Send admin notification
    if (emailServiceReady) {
      try {
      const approvalLink = `${process.env.FRONTEND_URL || 'https://platform.power-transitions.com'}/admin/review/${approvalToken}`;
        const adminResult = await emailService.sendAdminNotification(newUser, approvalToken);
        
        if (adminResult.success) {
          console.log(`✅ Admin notification sent`);
          console.log(`📧 Preview: ${adminResult.previewUrl || 'N/A'}`);
        } else {
          console.log(`⚠️ Admin notification failed: ${adminResult.error}`);
        }
      } catch (emailError) {
        console.error('Admin notification error:', emailError);
      }
    }
    
    // ========== RESPONSE ==========
    
    const response = {
      success: true,
      message: 'Registration submitted for admin approval. You will receive an email once approved.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        status: newUser.status
      },
      notes: {
        emailService: emailServiceReady ? 'active' : 'inactive',
        mode: emailService.mode || 'unknown',
        domainRestriction: 'Only @power-transitions.com emails allowed'
      }
    };
    
    // Add preview links in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        approvalToken: approvalToken,
        emailServiceMode: emailService.mode,
        testNote: 'Using temporary email service while waiting for Office 365 SMTP fix'
      };
    }
    
    res.status(201).json(response);
    
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

// Admin approval endpoint
router.get('/admin/approve/:token', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { token } = req.params;
    
    // Find user by approval token
    const userResult = await client.query(
      `SELECT id, username, email, full_name, status 
       FROM pipeline_dashboard.users 
       WHERE approval_token = $1 AND status = 'pending_approval'`,
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
           approval_token = NULL,
           approved_at = NOW(),
           approved_by = 'system'
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
        JSON.stringify({ approved_by: 'system', approval_method: 'token_link' }),
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent') || 'unknown'
      ]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Send approval email to user
    if (emailServiceReady) {
      try {
        const approvalResult = await emailService.sendApprovalEmail({
          username: user.username,
          email: user.email,
          full_name: user.full_name
        });
        
        if (approvalResult.success) {
          console.log(`✅ Approval email sent to ${user.email}`);
          console.log(`📧 Preview: ${approvalResult.previewUrl || 'N/A'}`);
        } else {
          console.log(`⚠️ Approval email failed: ${approvalResult.error}`);
        }
      } catch (emailError) {
        console.error('Approval email error:', emailError);
      }
    }
    
    // Get the username for the success page
    const username = req.query.user || user.username;
    
    // Redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL || 'https://platform.power-transitions.com';
    res.redirect(`${frontendUrl}/approval-success?user=${encodeURIComponent(username)}`);
    
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

// Forgot password endpoint
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
    if (emailServiceReady) {
      try {
        const resetResult = await emailService.sendPasswordResetEmail(user, resetToken);
        
        if (resetResult.success) {
          console.log(`✅ Password reset email sent to ${user.email}`);
          console.log(`📧 Preview: ${resetResult.previewUrl || 'N/A'}`);
        } else {
          console.log(`⚠️ Password reset email failed: ${resetResult.error}`);
        }
      } catch (emailError) {
        console.error('Password reset email error:', emailError);
      }
    }
    
    // Insert audit log
    await client.query(
      `INSERT INTO pipeline_dashboard.audit_logs 
       (user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        'password_reset_requested',
        JSON.stringify({ method: 'email', email_sent: emailServiceReady }),
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent') || 'unknown'
      ]
    );
    
    res.json({
      success: true,
      message: 'Password reset email sent if the email exists in our system',
      notes: {
        emailService: emailServiceReady ? 'active' : 'inactive',
        mode: emailService.mode || 'unknown'
      }
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

// Test endpoint to check email service
router.get('/test-email', async (req, res) => {
  try {
    if (!emailServiceReady) {
      return res.json({ 
        success: false, 
        message: 'Email service not initialized' 
      });
    }
    
    const testUser = {
      username: 'testuser',
      email: 'ababalola@power-transitions.com',
      full_name: 'Test User'
    };
    
    const result = await emailService.sendRegistrationEmail(testUser);
    
    res.json({
      success: result.success,
      message: result.success ? 'Test email sent' : 'Test email failed',
      details: {
        mode: emailService.mode,
        to: testUser.email,
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        error: result.error
      },
      note: 'This is using temporary email service. Office 365 pending IT fix.'
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Test failed', 
      error: error.message 
    });
  }
});

module.exports = router;
