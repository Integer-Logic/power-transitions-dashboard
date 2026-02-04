// adminController.js
const userModel = require('../models/userModel');
const emailService = require('../services/emailService');

// ========== ADMIN CONTROLLER FUNCTIONS ==========

/**
 * GET /api/admin/pending - Get all pending user registrations
 */
const getPendingUsers = async (req, res) => {
  try {
    console.log('📥 GET /api/admin/pending - Request received');
    
    // Extract query parameters
    const filters = {
      limit: req.query.limit || 50,
      offset: req.query.offset || 0,
      search: req.query.search || ''
    };

    // Get pending users from database
    const pendingUsers = await userModel.getPendingUsers(filters);
    
    // Get total count for pagination
    const totalCount = await userModel.getPendingUsersCount(filters);

    // Send response
    res.status(200).json({
      success: true,
      message: 'Pending users retrieved successfully',
      count: pendingUsers.length,
      total: totalCount,
      data: pendingUsers,
      pagination: {
        limit: parseInt(filters.limit),
        offset: parseInt(filters.offset),
        total: totalCount,
        hasMore: (parseInt(filters.offset) + pendingUsers.length) < totalCount
      }
    });
    
    console.log(`✅ GET /api/admin/pending - Returned ${pendingUsers.length} pending users`);
  } catch (error) {
    console.error('❌ Error in getPendingUsers controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pending users',
      message: error.message
    });
  }
};

/**
 * POST /api/admin/approve - Approve a user registration
 */
const approveUser = async (req, res) => {
  try {
    const { userId, email, token } = req.body;
    console.log(`📥 POST /api/admin/approve - Approving user: ${userId || email}`);
    
    // Validate required parameters
    if (!userId && !email && !token) {
      return res.status(400).json({
        success: false,
        error: 'Either userId, email, or approval token is required'
      });
    }

    let user;
    
    // Handle different approval methods
    if (token) {
      // Token-based approval (from email link)
      user = await userModel.approveUserByToken(token);
    } else if (userId) {
      // User ID approval (from admin panel)
      user = await userModel.approveUserById(userId);
    } else if (email) {
      // Email approval
      user = await userModel.approveUserByEmail(email);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found or already approved'
      });
    }

    // Send approval email to user
    const emailResult = await emailService.sendApprovalEmail({
      username: user.username,
      email: user.email,
      role: user.role || 'Standard User'
    });

    res.status(200).json({
      success: true,
      message: 'User approved successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          status: user.status,
          approved_at: user.approved_at
        },
        emailSent: emailResult.success,
        emailMessage: emailResult.message
      }
    });
    
    console.log(`✅ POST /api/admin/approve - Approved user: ${user.username} (${user.email})`);
  } catch (error) {
    console.error('❌ Error in approveUser controller:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message === 'Invalid approval token') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to approve user',
      message: error.message
    });
  }
};

/**
 * POST /api/admin/approve/:token - Approve user via token (GET endpoint for email links)
 */
const approveUserByToken = async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`📥 GET /api/admin/approve/${token} - Token approval request`);
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Approval token is required'
      });
    }

    // Approve user by token
    const user = await userModel.approveUserByToken(token);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired approval token'
      });
    }

    // Send approval email
    await emailService.sendApprovalEmail({
      username: user.username,
      email: user.email,
      role: user.role || 'Standard User'
    });

    // Return success page HTML (for email links)
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Account Approved - Power Pipeline</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { background: #d4edda; color: #155724; padding: 20px; border-radius: 10px; }
          .button { background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Account Approved Successfully!</h1>
          <p>The account for <strong>${user.username}</strong> (${user.email}) has been approved.</p>
          <p>An approval email has been sent to the user.</p>
          <br>
         <a href="${process.env.FRONTEND_URL || 'https://platform.power-transitions.com'}/admin/review" class="button">Return to Admin Panel</a>
        </div>
      </body>
      </html>
    `);
    
    console.log(`✅ GET /api/admin/approve/${token} - Approved user via token: ${user.username}`);
  } catch (error) {
    console.error(`❌ Error in approveUserByToken controller:`, error);
    
    // Return error page HTML
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Approval Failed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 10px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Approval Failed</h1>
          <p>${error.message || 'Invalid or expired approval token'}</p>
          <p>Please contact your administrator.</p>
        </div>
      </body>
      </html>
    `);
  }
};

/**
 * POST /api/admin/reject - Reject a user registration
 */
const rejectUser = async (req, res) => {
  try {
    const { userId, email, reason } = req.body;
    console.log(`📥 POST /api/admin/reject - Rejecting user: ${userId || email}`);
    
    // Validate required parameters
    if (!userId && !email) {
      return res.status(400).json({
        success: false,
        error: 'Either userId or email is required'
      });
    }

    let user;
    
    // Handle different rejection methods
    if (userId) {
      user = await userModel.rejectUserById(userId, reason);
    } else if (email) {
      user = await userModel.rejectUserByEmail(email, reason);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User rejected successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          status: user.status,
          rejection_reason: reason,
          rejected_at: user.rejected_at
        }
      }
    });
    
    console.log(`✅ POST /api/admin/reject - Rejected user: ${user.username} (${user.email})`);
  } catch (error) {
    console.error('❌ Error in rejectUser controller:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to reject user',
      message: error.message
    });
  }
};

/**
 * GET /api/admin/users - Get all users (approved, pending, rejected)
 */
const getAllUsers = async (req, res) => {
  try {
    console.log('📥 GET /api/admin/users - Request received');
    
    // Extract query parameters
    const filters = {
      status: req.query.status, // 'pending', 'approved', 'rejected', 'all'
      role: req.query.role,
      search: req.query.search || '',
      limit: req.query.limit || 100,
      offset: req.query.offset || 0,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'DESC'
    };

    // Get users from database
    const users = await userModel.getAllUsers(filters);
    
    // Get total count for pagination
    const totalCount = await userModel.getUsersCount(filters);

    // Get statistics
    const stats = await userModel.getUserStats();

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      count: users.length,
      total: totalCount,
      data: users,
      stats: stats,
      pagination: {
        limit: parseInt(filters.limit),
        offset: parseInt(filters.offset),
        total: totalCount,
        hasMore: (parseInt(filters.offset) + users.length) < totalCount
      },
      filters: filters
    });
    
    console.log(`✅ GET /api/admin/users - Returned ${users.length} users`);
  } catch (error) {
    console.error('❌ Error in getAllUsers controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users',
      message: error.message
    });
  }
};

/**
 * GET /api/admin/stats - Get admin dashboard statistics
 */
const getAdminStats = async (req, res) => {
  try {
    console.log('📥 GET /api/admin/stats - Request received');
    
    const stats = await userModel.getUserStats();
    
    res.status(200).json({
      success: true,
      message: 'Admin statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ GET /api/admin/stats - Statistics retrieved');
  } catch (error) {
    console.error('❌ Error in getAdminStats controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin statistics',
      message: error.message
    });
  }
};

/**
 * POST /api/admin/users/:id/resend-approval - Resend approval email
 */
const resendApprovalEmail = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 POST /api/admin/users/${id}/resend-approval - Request received`);
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Get user details
    const user = await userModel.getUserById(parseInt(id));
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (user.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'User is not pending approval'
      });
    }

    // Generate new approval token
    const approvalToken = await userModel.generateApprovalToken(parseInt(id));
    
    // Build approval link for email
//const approvalLink = `${process.env.FRONTEND_URL || 'https://platform.power-transitions.com'}/admin/review/${approvalToken}`;
const approvalLink = `${process.env.BACKEND_URL || 'https://pt-power-pipeline-api.azurewebsites.net'}/admin/approve/${approvalToken}`;

    // Send admin notification with new link
    const emailResult = await emailService.sendAdminNotification(
      user,
      approvalLink
    );

    res.status(200).json({
      success: true,
      message: 'Approval email resent successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        emailSent: emailResult.success,
        emailMessage: emailResult.message,
        approvalLink: approvalLink 
      }
    });
    
    console.log(`✅ POST /api/admin/users/${id}/resend-approval - Email resent to admin for user: ${user.username}`);
  } catch (error) {
    console.error(`❌ Error in resendApprovalEmail controller:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend approval email',
      message: error.message
    });
  }
};

// Export all controller functions
module.exports = {
  getPendingUsers,
  approveUser,
  approveUserByToken,
  rejectUser,
  getAllUsers,
  getAdminStats,
  resendApprovalEmail
};
