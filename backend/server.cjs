// Load environment variables FIRST
require("dotenv").config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const projectRoutes = require('./routes/projects');
const expertAnalysisRoutes = require('./routes/expertAnalysisRoutes');
const database = require('./utils/db');
const pool = database.getPool();
const app = express();
const PORT = process.env.PORT || 8080;

// Set schema for all connections
pool.on('connect', (client) => {
  client.query(`SET search_path TO ${process.env.DB_SCHEMA || 'pipeline_dashboard'}`);
});

// Debug mode
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

// Email service constants
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const SALT_ROUNDS = 12;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ababalola@power-transitions.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://platform.power-transitions.com';

class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = 'noreply@power-transitions.com';
    this.initialized = false;
    this.mode = 'ethereal';
    this.etherealAccount = null;

    if (DEBUG_MODE) {
      console.log('🔧 Email Service: Debug mode detected');
    }
  }

  async initialize() {
    console.log('\n🔧 Initializing Email Service...\n');

    if (DEBUG_MODE) {
      console.log('🔧 Using DEBUG email service (emails logged to console)');
      this.mode = 'debug';
      this.initialized = true;
      return true;
    }

    console.log('1. Testing Office 365 SMTP...');
    const office365Works = await this.tryOffice365();

    if (office365Works) {
      this.mode = 'office365';
      console.log('✅ Using OFFICE 365 SMTP');
      this.initialized = true;
      return true;
    }

    console.log('⚠️ Office 365 SMTP blocked by IT policies');
    console.log('💡 Using Ethereal SMTP for immediate testing...\n');

    try {
      console.log('2. Creating Ethereal test account...');
      this.etherealAccount = await nodemailer.createTestAccount();

      console.log(`✅ Account: ${this.etherealAccount.user}`);
      console.log('📧 View sent emails at: https://ethereal.email/\n');

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: this.etherealAccount.user,
          pass: this.etherealAccount.pass
        }
      });

      await this.transporter.verify();
      console.log('✅ Ethereal SMTP connection verified');

      const testResult = await this.sendTestEmail();
      if (testResult.success) {
        console.log('🎉 Temporary email service ready!');
        this.initialized = true;
        this.mode = 'ethereal';
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Ethereal initialization failed:', error.message);
      return false;
    }
  }

  async tryOffice365() {
    const office365Config = {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: 'noreply@power-transitions.com',
        pass: process.env.EMAIL_PASSWORD || 'N*273989079320ul'
      },
      tls: { rejectUnauthorized: false }
    };

    try {
      const testTransporter = nodemailer.createTransport(office365Config);
      await testTransporter.verify();

      await testTransporter.sendMail({
        from: `"Test" <noreply@power-transitions.com>`,
        to: ADMIN_EMAIL,
        subject: 'Test',
        text: 'Test'
      });

      this.transporter = testTransporter;
      return true;
    } catch (error) {
      return false;
    }
  }

  async sendTestEmail() {
    try {
      if (DEBUG_MODE) {
        console.log('\n📧 [DEBUG EMAIL - TEST]:');
        console.log('   To:', ADMIN_EMAIL);
        console.log('   Subject: Power Pipeline - Email Service Test');
        console.log('   Mode: debug\n');
        return { success: true, debug: true };
      }

      const info = await this.transporter.sendMail({
        from: `"Power Pipeline" <${this.fromEmail}>`,
        to: ADMIN_EMAIL,
        subject: `✅ Power Pipeline Email Test (${this.mode})`,
        html: `
          <h1>Email Service Working</h1>
          <p>Mode: <strong>${this.mode.toUpperCase()}</strong></p>
          <p>Domain Restriction: <strong>ACTIVE</strong> (only @power-transitions.com)</p>
          <p>IT Action Required: Enable Office 365 SMTP AUTH</p>
        `
      });

      console.log(`✅ Test email sent to ${ADMIN_EMAIL}`);
      if (this.mode === 'ethereal') {
        console.log(`📧 Preview: https://ethereal.email/message/${info.messageId}`);
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  validateEmailDomain(email) {
    if (!email || typeof email !== 'string') return false;
    try {
      const emailDomain = email.toLowerCase().split('@')[1];
      return emailDomain === 'power-transitions.com';
    } catch (error) {
      return false;
    }
  }

  async sendEmail(to, subject, html, text = '') {
    if (!this.initialized) {
      console.error('❌ Email service not ready');
      return { success: false, error: 'Email service not ready' };
    }

    if (DEBUG_MODE || this.mode === 'debug') {
      console.log('\n📧 [DEBUG EMAIL]:');
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Valid Domain: ${this.validateEmailDomain(to) ? '✅' : '❌'}`);
      console.log(`   HTML Preview: ${html.substring(0, 100)}...\n`);
      return { success: true, debug: true };
    }

    if (!this.validateEmailDomain(to)) {
      console.error(`🚫 REJECTED: Email domain not allowed for ${to}`);
      return {
        success: false,
        error: `Only @power-transitions.com email addresses are allowed`
      };
    }

    try {
      console.log(`📧 Sending email to ${to} (via ${this.mode})`);

      const mailOptions = {
        from: `"Power Pipeline System" <${this.fromEmail}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || this.htmlToText(html)
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`✅ Email sent to ${to}`);

      if (this.mode === 'ethereal') {
        console.log(`📧 Preview: https://ethereal.email/message/${info.messageId}`);
        return {
          success: true,
          messageId: info.messageId,
          previewUrl: `https://ethereal.email/message/${info.messageId}`
        };
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Email failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}


//const EmailService = require('./emailService-office365.js');
const emailService = new EmailService();
let emailServiceReady = false;

(async () => {
  try {
    emailServiceReady = await emailService.initialize();
    console.log(
      emailServiceReady
        ? `✅ Email service initialized (Mode: ${emailService.mode})`
        : '❌ Email service failed to initialize'
    );
  } catch (error) {
    console.error('Email service init error:', error);
  }
})();

if (DEBUG_MODE) {
  console.log('🔧 DEBUG MODE ENABLED');

  app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    if (req.method === 'POST' && req.path === '/api/auth/register') {
      console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
  });
}
app.use(helmet());
app.set('trust proxy', 1); 

const allowedOrigins = [
  'https://platform.power-transitions.com',
  'https://pt-power-pipeline-dashboard.azurestaticapps.net',
  'https://lively-water-022a59110.6.azurestaticapps.net',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://localhost:5175'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

app.options('*', cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('dev'));

const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Power Pipeline API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    database: 'PostgreSQL',
    auth: 'JWT Authentication',
    email_service: emailServiceReady ? `Active (${emailService.mode})` : 'Inactive'
  });
});

// ========== TEST ENDPOINTS ==========
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Power Pipeline API is running!',
    schema: process.env.DB_SCHEMA || 'pipeline_dashboard',
    admin_email: ADMIN_EMAIL,
    email_service: emailServiceReady ? `Active (${emailService.mode})` : 'Inactive',
    domain_restriction: 'Only @power-transitions.com allowed',
    debug_mode: DEBUG_MODE ? 'ENABLED' : 'DISABLED'
  });
});

// ============================================
// DEBUG ENDPOINTS (ADDED - CRITICAL FOR DEBUGGING)
// ============================================
app.get('/api/debug/db-connection', async (req, res) => {
  try {
    const envVars = {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      NODE_ENV: process.env.NODE_ENV,
      DEBUG_MODE: process.env.DEBUG_MODE
    };

    const client = await pool.connect();
    try {
      const dbInfo = await client.query(`
        SELECT
          current_database() as current_db,
          current_schema() as current_schema,
          version() as pg_version
      `);

      res.json({
        success: true,
        environment_variables: envVars,
        database_info: dbInfo.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/echo', (req, res) => {
  if (DEBUG_MODE) {
    console.log('📨 Echo endpoint called:', req.body);
  }
  res.json({
    success: true,
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// AUTH ROUTES
// ============================================

// REGISTER NEW USER
app.post('/api/auth/register', async (req, res) => {
  if (DEBUG_MODE) {
    console.log('\n🔵 REGISTRATION REQUEST RECEIVED');
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }

  const client = await pool.connect();

  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      if (DEBUG_MODE) console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (password.length < 8) {
      if (DEBUG_MODE) console.log('❌ Password too short');
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    const emailDomain = email.toLowerCase().split('@')[1];
    if (emailDomain !== 'power-transitions.com') {
      if (DEBUG_MODE) console.log(`❌ Invalid email domain: ${emailDomain}`);
      return res.status(400).json({
        success: false,
        message: 'Only @power-transitions.com email addresses are allowed for registration'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (DEBUG_MODE) console.log('❌ Invalid email format');
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (DEBUG_MODE) console.log('✅ Basic validation passed');

    await client.query('BEGIN');
    if (DEBUG_MODE) console.log('✅ Transaction started');

    const usernameLower = username.toLowerCase();
    const emailLower = email.toLowerCase();

    const existingUser = await client.query(
      `SELECT id, username, email FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       WHERE LOWER(username) = $1 OR LOWER(email) = $2`,
      [usernameLower, emailLower]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');

      const existing = existingUser.rows[0];
      let conflictMessage = '';

      if (existing.username.toLowerCase() === usernameLower) {
        conflictMessage = `Username "${existing.username}" is already registered`;
      } else if (existing.email.toLowerCase() === emailLower) {
        conflictMessage = `Email "${existing.email}" is already registered`;
      } else {
        conflictMessage = 'Username or email already exists';
      }

      if (DEBUG_MODE) {
        console.log('❌ Registration conflict:', conflictMessage);
      }

      return res.status(409).json({
        success: false,
        message: conflictMessage
      });
    }

    if (DEBUG_MODE) console.log('✅ User does not exist');

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    if (DEBUG_MODE) console.log('✅ Password hashed');

    const newUser = await client.query(
      `INSERT INTO ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       (username, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name, role, status, created_at`,
      [username, email, passwordHash, full_name || '', 'pending', 'pending_approval']
    );

    const user = newUser.rows[0];
    if (DEBUG_MODE) console.log(`✅ User created with ID: ${user.id}`);

    const approvalToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.approval_tokens
       (user_id, token, token_type, admin_email, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, approvalToken, 'admin_approval', ADMIN_EMAIL, expiresAt]
    );

    if (DEBUG_MODE) console.log(`✅ Approval token generated: ${approvalToken.substring(0, 20)}...`);

    if (emailServiceReady) {
      const userEmailHtml = `
        <h2>Registration Submitted Successfully</h2>
        <p>Thank you for registering with Power Pipeline Dashboard!</p>
        <p>Your registration has been submitted for administrator approval.</p>

        <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin:20px 0;">
          <h3>What happens next?</h3>
          <ol>
            <li>An administrator will review your registration</li>
            <li>You will receive another email once your account is approved</li>
            <li>Approval typically takes 1-2 business days</li>
            <li>You can then log in with your credentials</li>
          </ol>
        </div>

        <p><strong>Your Registration Details:</strong></p>
        <ul>
          <li><strong>Username:</strong> ${username}</li>
          <li><strong>Email:</strong> ${email}</li>
          ${full_name ? `<li><strong>Full Name:</strong> ${full_name}</li>` : ''}
          <li><strong>Status:</strong> Pending Approval</li>
        </ul>

        <p>If you have any questions, please contact the system administrator.</p>
      `;

      const userEmailResult = await emailService.sendEmail(
        email,
        'Registration Submitted for Approval - Power Pipeline Dashboard',
        userEmailHtml
      );

      if (userEmailResult.success) {
        if (DEBUG_MODE) console.log(`✅ Registration email sent to ${email}`);
      } else {
        console.log(`⚠️ Registration email failed: ${userEmailResult.error}`);
      }
    }

    if (emailServiceReady) {
      const backendUrl = process.env.BACKEND_URL || 'https://pt-power-pipeline-api.azurewebsites.net';
      const approvalLink = `${backendUrl}/api/admin/approve/${approvalToken}`;

      const adminEmailHtml = `
        <h2>New User Registration Requires Approval</h2>
        <p>A new user has registered and requires your approval:</p>
        <ul>
          <li><strong>Username:</strong> ${username}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Full Name:</strong> ${full_name || 'Not provided'}</li>
          <li><strong>Registration Date:</strong> ${new Date(user.created_at).toLocaleString()}</li>
        </ul>
        <p><a href="${approvalLink}" style="background:#3498db;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
          Review and Approve User
        </a></p>
        <p><small>This link expires in 24 hours.</small></p>
      `;

      const adminEmailResult = await emailService.sendEmail(
        ADMIN_EMAIL,
        `[Action Required] New User Registration - ${username}`,
        adminEmailHtml
      );

      if (adminEmailResult.success) {
        if (DEBUG_MODE) console.log(`✅ Admin notification sent to ${ADMIN_EMAIL}`);
      } else {
        console.log(`⚠️ Admin notification failed: ${adminEmailResult.error}`);
      }
    }

    await client.query('COMMIT');
    if (DEBUG_MODE) console.log('✅ Transaction committed');

    res.status(201).json({
      success: true,
      message: 'Registration submitted for admin approval. You will receive an email once approved.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status
      },
      email_service: {
        active: emailServiceReady,
        mode: emailService.mode,
        note:
          emailService.mode === 'ethereal'
            ? 'Using temporary service while waiting for Office 365 SMTP fix'
            : emailService.mode === 'debug'
            ? 'Debug mode - emails logged to console'
            : 'Using Office 365 SMTP'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);

    if (DEBUG_MODE) {
      console.error('❌ REGISTRATION ERROR:', error);
      console.error('Error stack:', error.stack);
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: DEBUG_MODE && process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
    if (DEBUG_MODE) console.log('🔚 Request completed\n');
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, ip_address, user_agent, device_fingerprint } = req.body;

    const userResult = await pool.query(
      `SELECT * FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users WHERE (username = $1 OR email = $1)
       AND status = 'active' AND is_active = true`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or account not approved'
      });
    }

    const user = userResult.rows[0];

    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not approved yet. Please wait for admin approval.'
      });
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    await pool.query(
      `UPDATE ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users SET last_login = NOW(), login_count = login_count + 1 WHERE id = $1`,
      [user.id]
    );

    await pool.query(
      `INSERT INTO ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.login_logs
       (user_id, ip_address, user_agent, device_fingerprint, login_time)
       VALUES ($1, $2, $3, $4, NOW())`,
      [user.id, ip_address, user_agent, device_fingerprint]
    );

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      status: user.status,
      last_login: user.last_login,
      login_count: user.login_count + 1,
      approved_at: user.approved_at
    };

    res.json({
      success: true,
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const emailDomain = email.toLowerCase().split('@')[1];
    if (emailDomain !== 'power-transitions.com') {
      return res.status(400).json({
        success: false,
        message: 'Only @power-transitions.com email addresses are allowed'
      });
    }

    const userResult = await pool.query(
      `SELECT id, username, email, full_name FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users WHERE email = $1 AND status = 'active' AND is_active = true`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link'
      });
    }

    const user = userResult.rows[0];

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await pool.query(
      `UPDATE ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3`,
      [resetTokenHash, resetTokenExpiry, user.id]
    );

    if (emailServiceReady) {
      const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;

      const resetEmailHtml = `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Power Pipeline Dashboard account.</p>
        <p><a href="${resetUrl}" style="background:#3498db;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
          Reset Password
        </a></p>
        <p><small>This link expires in 1 hour. If you didn't request this, please ignore this email.</small></p>
        <p><strong>Username:</strong> ${user.username}</p>
      `;

      const emailResult = await emailService.sendEmail(
        user.email,
        'Password Reset Request - Power Pipeline Dashboard',
        resetEmailHtml
      );

      if (emailResult.success) {
        console.log(`✅ Password reset email sent to ${user.email}`);
      } else {
        console.log(`⚠️ Password reset email failed: ${emailResult.error}`);
      }
    }

    res.json({
      success: true,
      message: 'Password reset link sent to your email.',
      email_service: {
        active: emailServiceReady,
        mode: emailService.mode
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing request'
    });
  }
});

// RESET PASSWORD
app.post('/api/auth/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const userResult = await pool.query(
      `SELECT id, email FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       WHERE reset_password_token = $1
       AND reset_password_expires > NOW()
       AND status = 'active'
       AND is_active = true`,
      [tokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;

    const passwordHash = await hashPassword(password);

    await pool.query(
      `UPDATE ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       SET password_hash = $1,
           reset_password_token = NULL,
           reset_password_expires = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId]
    );

    if (emailServiceReady) {
      const confirmationHtml = `
        <h2>Password Reset Successful</h2>
        <p>Your password has been successfully reset.</p>
        <div style="background:#d4edda;padding:15px;border-radius:8px;margin:20px 0;">
          <p><strong>Account:</strong> ${userEmail}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p>You can now log in with your new password.</p>
        <p>If you did not make this change, please contact the system administrator immediately.</p>
      `;

      await emailService.sendEmail(
        userEmail,
        'Password Reset Successful - Power Pipeline Dashboard',
        confirmationHtml
      );
    }

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error resetting password'
    });
  }
});

// VERIFY TOKEN
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.json({ valid: false });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const userResult = await pool.query(
      `SELECT id, username, email, full_name, role, status, last_login, login_count
       FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       WHERE id = $1 AND status = 'active' AND is_active = true`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.json({ valid: false });
    }

    res.json({
      valid: true,
      user: userResult.rows[0]
    });
  } catch (error) {
    res.json({ valid: false });
  }
});

// LOGOUT
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { token } = req.body;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        await pool.query(
          `UPDATE ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.login_logs
           SET logout_time = NOW(),
               session_duration = EXTRACT(EPOCH FROM (NOW() - login_time))
           WHERE user_id = $1
           AND logout_time IS NULL
           ORDER BY login_time DESC
           LIMIT 1`,
          [decoded.userId]
        );
      } catch (error) {
        console.warn('Logout session update failed:', error.message);
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ success: true, message: 'Logged out' });
  }
});

// Share the pool with routes
app.set('pool', pool);

// Drop down list
const dropdownOptionsRouter = require('./routes/dropdownOptions');
app.use('/api/dropdown-options', dropdownOptionsRouter);

// ============================================
// ADMIN ROUTES (MOVED HERE - BEFORE 404 HANDLER)
// ============================================

// ADDED: Debug admin route to test if routes are working
app.get('/api/admin/debug-test', (req, res) => {
  console.log('🔍 /api/admin/debug-test called');
  res.json({
    success: true,
    message: 'Admin test route is working!',
    timestamp: new Date().toISOString(),
    path: '/api/admin/debug-test',
    note: 'If this works, admin routes are being registered correctly'
  });
});

// ADDED: Admin route without authentication for testing
app.get('/api/admin/no-auth-test', (req, res) => {
  res.json({
    success: true,
    message: 'Admin route without authentication works',
    note: 'Use this to test if routes are accessible without auth'
  });
});

// Existing admin routes (keep these)
app.get('/api/admin/pending-users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const pendingUsers = await pool.query(
      `SELECT id, username, email, full_name, created_at
       FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       WHERE status = 'pending_approval'
       ORDER BY created_at DESC`
    );

    res.json(pendingUsers.rows);
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users'
    });
  }
});

app.post('/api/admin/approve-user/:id', authenticateToken, isAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { role = 'operator' } = req.body;
    const adminId = req.user.userId;

    await client.query('BEGIN');

    const userQuery = await client.query(
      `SELECT id, username, email, status, role FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
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

    await client.query(
      `UPDATE ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       SET status = 'active',
           role = $1,
           approved_by = $2,
           approved_at = NOW(),
           is_active = true
       WHERE id = $3`,
      [role, adminId, id]
    );

    await client.query(
      `INSERT INTO ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.admin_actions
        (admin_id, target_user_id, action_type, previous_status, new_status, previous_role, new_role)
       VALUES ($1, $2, 'approve', $3, 'active', $4, $5)`,
      [adminId, id, user.status, user.role, role]
    );

    if (emailServiceReady) {
      const emailHtml = `
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

        <p><a href="${FRONTEND_URL}/login"
           style="background:#28a745;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
          Log In Now
        </a></p>

        <p>You can now log in with your credentials.</p>
      `;

      await emailService.sendEmail(user.email, 'Account Approved - Power Pipeline Dashboard', emailHtml);
    }

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

app.post('/api/admin/reject-user/:id', authenticateToken, isAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { reason = '' } = req.body;
    const adminId = req.user.userId;

    await client.query('BEGIN');

    const userQuery = await client.query(
      `SELECT id, username, email, status FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
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

    await client.query(
      `UPDATE ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       SET status = 'rejected',
           rejection_reason = $1,
           is_active = false
       WHERE id = $2`,
      [reason, id]
    );

    await client.query(
      `INSERT INTO ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.admin_actions
        (admin_id, target_user_id, action_type, previous_status, new_status, notes)
       VALUES ($1, $2, 'reject', $3, 'rejected', $4)`,
      [adminId, id, user.status, reason]
    );

    if (emailServiceReady) {
      const emailHtml = `
        <h2>Registration Update</h2>
        <p>Your registration for Power Pipeline Dashboard has been reviewed.</p>

        <div style="background:#f8d7da;padding:15px;border-radius:8px;margin:20px 0;">
          <h3 style="color:#721c24;">Status: Not Approved</h3>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>Your account registration has not been approved at this time.</p>
        </div>

        <p>If you believe this is an error, please contact the system administrator.</p>
      `;

      await emailService.sendEmail(user.email, 'Registration Status - Power Pipeline Dashboard', emailHtml);
    }

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

// CRITICAL: This is the approval endpoint for email links
app.get('/api/admin/approve/:token', async (req, res) => {
  const client = await pool.connect();

  try {
    const { token } = req.params;

    const tokenQuery = await client.query(
      `SELECT at.*, u.username, u.email, u.full_name, u.status
       FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.approval_tokens at
       JOIN ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users u ON at.user_id = u.id
       WHERE at.token = $1 AND at.token_type = 'admin_approval'
       AND at.expires_at > NOW() AND at.used = false`,
      [token]
    );

    if (tokenQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired approval token'
      });
    }

    const tokenData = tokenQuery.rows[0];

    if (tokenData.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: 'User is not pending approval'
      });
    }

    await client.query('BEGIN');

    const adminQuery = await client.query(
      `SELECT id FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users WHERE role = 'admin' AND status = 'active' LIMIT 1`
    );

    const adminId = adminQuery.rows[0]?.id || 1;

    await client.query(
      `UPDATE ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       SET status = 'active',
           role = 'operator',
           approved_by = $1,
           approved_at = NOW(),
           is_active = true
       WHERE id = $2`,
      [adminId, tokenData.user_id]
    );

    await client.query(
      `UPDATE ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.approval_tokens
       SET used = true, used_at = NOW()
       WHERE id = $1`,
      [tokenData.id]
    );

    await client.query(
      `INSERT INTO ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.admin_actions
        (admin_id, target_user_id, action_type, previous_status, new_status, previous_role, new_role)
       VALUES ($1, $2, 'approve', 'pending_approval', 'active', 'pending', 'operator')`,
      [adminId, tokenData.user_id]
    );

    if (emailServiceReady) {
      const emailHtml = `
        <h2>Your Account Has Been Approved!</h2>
        <p>Good news! Your Power Pipeline Dashboard account has been approved.</p>

        <div style="background:#d4edda;padding:15px;border-radius:8px;margin:20px 0;">
          <h3 style="color:#155724;">✅ Account Details:</h3>
          <ul>
            <li><strong>Username:</strong> ${tokenData.username}</li>
            <li><strong>Email:</strong> ${tokenData.email}</li>
            <li><strong>Role:</strong> Operator</li>
            <li><strong>Status:</strong> Active</li>
            <li><strong>Approval Date:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
        </div>

        <p><a href="${FRONTEND_URL}/login"
           style="background:#28a745;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
          Log In Now
        </a></p>
      `;

      await emailService.sendEmail(tokenData.email, 'Account Approved - Power Pipeline Dashboard', emailHtml);
    }

    await client.query('COMMIT');

    const successUrl = `${FRONTEND_URL}/login?message=User+${encodeURIComponent(
      tokenData.username
    )}+has+been+approved`;

    res.redirect(successUrl);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin approval error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to process approval'
    });
  } finally {
    client.release();
  }
});

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, role, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, username, email, full_name, role, status,
             approved_at, last_login, login_count, created_at,
             (SELECT COUNT(*) FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users) as total_count
      FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
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

    const result = await pool.query(query, params);

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

app.get('/api/auth/registration-status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const query = await pool.query(
      `SELECT status, approved_at, rejection_reason
       FROM ${process.env.DB_SCHEMA || 'pipeline_dashboard'}.users
       WHERE email = $1`,
      [email]
    );

    if (query.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No registration found with this email'
      });
    }

    res.json({
      success: true,
      status: query.rows[0].status,
      approved_at: query.rows[0].approved_at,
      rejection_reason: query.rows[0].rejection_reason
    });
  } catch (error) {
    console.error('Registration status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check registration status'
    });
  }
});

app.get('/api/test-email', async (req, res) => {
  try {
    if (!emailServiceReady) {
      return res.json({
        success: false,
        message: 'Email service not initialized'
      });
    }

    const testHtml = `
      <h2>Test Email</h2>
      <p>This is a test email from Power Pipeline Dashboard.</p>
      <p><strong>Mode:</strong> ${emailService.mode}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Debug Mode:</strong> ${DEBUG_MODE ? 'ENABLED' : 'DISABLED'}</p>
    `;

    const result = await emailService.sendEmail(ADMIN_EMAIL, 'Power Pipeline - Email Service Test', testHtml);

    res.json({
      success: result.success,
      message: result.success ? 'Test email sent' : 'Test email failed',
      details: {
        mode: emailService.mode,
        to: ADMIN_EMAIL,
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        error: result.error,
        debug: result.debug || false
      },
      note: DEBUG_MODE
        ? 'Debug mode - emails logged to console'
        : emailService.mode === 'ethereal'
        ? 'Using temporary service. Office 365 pending IT fix.'
        : 'Using Office 365 SMTP'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

app.use('/api/projects', projectRoutes);

app.use('/api', expertAnalysisRoutes);

app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const route = middleware.route;
      routes.push({
        path: route.path,
        methods: Object.keys(route.methods),
        type: 'direct'
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const route = handler.route;
          routes.push({
            path: route.path,
            methods: Object.keys(route.methods),
            type: 'router'
          });
        }
      });
    }
  });
  
  res.json({
    success: true,
    totalRoutes: routes.length,
    adminRoutes: routes.filter(r => r.path.includes('admin')),
    allRoutes: routes
  });
});


// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  const statusCode = err.status || 500;
  const response = {
    success: false,
    error: err.message || 'Internal Server Error'
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

// 404 Handler - MUST BE LAST (after all other routes)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log('🚀 POWER PIPELINE API SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(70));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Projects API: http://localhost:${PORT}/api/projects`);
  console.log(`📈 Expert Analysis API: http://localhost:${PORT}/api/expert-analysis`);
  console.log(`⚡ Transmission API: http://localhost:${PORT}/api/transmission-interconnection`);
  console.log(`🗄️ Using schema: ${process.env.DB_SCHEMA || 'pipeline_dashboard'}`);
  console.log(`👤 Admin email: ${ADMIN_EMAIL}`);
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
  console.log(`📧 Email mode: ${emailServiceReady ? `Active (${emailService.mode})` : 'Inactive'}`);
  console.log(`🔧 Debug mode: ${DEBUG_MODE ? 'ENABLED' : 'DISABLED'}`);

  if (emailService.mode === 'ethereal') {
    console.log(`📧 View sent emails at: https://ethereal.email/`);
    console.log(`💡 Temporary service active while waiting for Office 365 SMTP fix`);
  }

  console.log('='.repeat(70));
  console.log('📋 Available Endpoints:');
  console.log('- GET  /health - Server health check');
  console.log('- GET  /api/test - Server status');
  console.log('- GET  /api/admin/debug-test - Admin debug route');
  console.log('- POST /api/auth/register - Register new user (with email)');
  console.log('- POST /api/auth/login - Login (approved users only)');
  console.log('- POST /api/auth/forgot-password - Request password reset');
  console.log('- GET  /api/admin/pending-users - Get pending users (admin)');
  console.log('- GET  /api/admin/approve/:token - Approve user via email link');
  console.log('- GET  /api/test-email - Test email service');
  console.log('- GET  /api/projects - Projects API');
  console.log('- GET  /api/expert-analysis - Expert analysis API');
  console.log('- POST /api/expert-analysis - Save expert analysis');
  console.log('- GET  /api/transmission-interconnection - Transmission data API');
  console.log('- POST /api/transmission-interconnection - Save transmission data');
  console.log('='.repeat(70));
  console.log('✅ Ready to accept requests!');
  console.log('='.repeat(70));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
