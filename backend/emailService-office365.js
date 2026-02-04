const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    // YOUR COMPANY OFFICE 365 CREDENTIALS
    this.config = {
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // Use STARTTLS
      requireTLS: true,
      auth: {
        user: 'noreply@power-transitions.com',
        pass: 'N*273989079320ul' // Your company password
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false // For testing, remove in production
      },
      // Connection settings
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    };
    
    this.transporter = null;
    this.fromEmail = 'noreply@power-transitions.com';
    this.initialized = false;
    
    // Validate the configuration
    this.validateConfig();
  }

  validateConfig() {
    console.log('🔧 Validating Office 365 SMTP Configuration...\n');
    
    // Check required fields
    if (!this.config.auth.user || !this.config.auth.pass) {
      console.error('❌ SMTP credentials missing!');
      console.log('   Please check your emailService.js configuration');
      return false;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.config.auth.user)) {
      console.error('❌ Invalid email format:', this.config.auth.user);
      return false;
    }
    
    console.log('✅ Configuration validated:');
    console.log(`   Server: ${this.config.host}:${this.config.port}`);
    console.log(`   From: ${this.fromEmail}`);
    console.log(`   User: ${this.config.auth.user}`);
    console.log(`   Domain Restriction: @power-transitions.com only\n`);
    
    return true;
  }

  async initialize() {
    console.log('🚀 Initializing Office 365 Email Service...\n');
    
    if (!this.validateConfig()) {
      console.error('❌ Cannot initialize with invalid configuration');
      return false;
    }
    
    try {
      // Create transporter with Office 365 config
      this.transporter = nodemailer.createTransport(this.config);
      
      // Add debug event listeners
      if (process.env.NODE_ENV === 'development') {
        this.transporter.on('log', (log) => {
          console.log(`   [SMTP] ${log.message}`);
        });
      }
      
      // Step 1: Verify SMTP connection
      console.log('1. Testing Office 365 SMTP connection...');
      await this.transporter.verify();
      console.log('✅ Office 365 SMTP connection verified');
      
      // Step 2: Send test email
      console.log('\n2. Sending test email...');
      const testResult = await this.sendTestEmail();
      
      if (testResult.success) {
        console.log('🎉 Office 365 Email Service initialized successfully!');
        console.log(`📧 Test email sent to: ${testResult.to}`);
        console.log(`   Message ID: ${testResult.messageId}`);
        this.initialized = true;
        return true;
      } else {
        console.log('⚠️ Test email failed:', testResult.error);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Office 365 SMTP initialization failed:', error.message);
      
      // Provide specific troubleshooting
      this.handleSmtpError(error);
      return false;
    }
  }

  handleSmtpError(error) {
    console.log('\n🔍 Office 365 SMTP Troubleshooting:');
    
    if (error.code === 'EAUTH') {
      console.log('🔐 AUTHENTICATION ERROR - Possible causes:');
      console.log('   1. Incorrect password');
      console.log('   2. MFA enabled (requires App Password)');
      console.log('   3. SMTP AUTH disabled for this mailbox');
      console.log('   4. Account locked or disabled');
      
      if (error.response && error.response.includes('535 5.7.139')) {
        console.log('\n💡 This is an Office 365 security policy error.');
        console.log('   Contact your IT admin to:');
        console.log('   1. Enable SMTP AUTH for noreply@power-transitions.com');
        console.log('   2. Or provide App Password if MFA is enabled');
      }
    }
    
    if (error.code === 'ECONNECTION') {
      console.log('🌐 CONNECTION ERROR - Possible causes:');
      console.log('   1. Network/firewall blocking port 587');
      console.log('   2. Office 365 SMTP server issue');
      console.log('   3. DNS resolution problem');
    }
    
    console.log('\n🚨 IMMEDIATE WORKAROUND:');
    console.log('   Until Office 365 is fixed, you can use:');
    console.log('   1. Ask IT to enable SMTP AUTH');
    console.log('   2. Or request App Password');
    console.log('   3. Or use Ethereal for testing (temporary)');
  }

  async sendTestEmail() {
    try {
      const testTo = 'ababalola@power-transitions.com';
      
      // Validate domain first
      if (!this.validateEmailDomain(testTo)) {
        return { 
          success: false, 
          error: 'Test email must be @power-transitions.com domain' 
        };
      }
      
      const testEmail = {
        from: `"Power Pipeline System" <${this.fromEmail}>`,
        to: testTo,
        subject: '✅ Power Pipeline - Office 365 SMTP Test',
        text: `This is a test email sent via your company Office 365 SMTP.\n\nTime: ${new Date().toLocaleString()}\nFrom: ${this.fromEmail}\nTo: ${testTo}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0078D4 0%, #005A9E 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Office 365 SMTP Test</h1>
                <p>Power Pipeline Dashboard</p>
              </div>
              <div class="content">
                <h2>✅ Test Successful!</h2>
                <p>Your Office 365 SMTP configuration is working correctly.</p>
                
                <div style="background: #e8f4fd; padding: 15px; border-left: 4px solid #0078D4; margin: 20px 0;">
                  <strong>Test Details:</strong><br>
                  <strong>Time:</strong> ${new Date().toLocaleString()}<br>
                  <strong>From:</strong> ${this.fromEmail}<br>
                  <strong>To:</strong> ${testTo}<br>
                  <strong>Server:</strong> smtp.office365.com:587<br>
                  <strong>Status:</strong> Connected
                </div>
                
                <p>This confirms that your Power Pipeline Dashboard can send:</p>
                <ul>
                  <li>User registration emails</li>
                  <li>Account approval notifications</li>
                  <li>Password reset emails</li>
                  <li>Admin notifications</li>
                </ul>
                
                <p><strong>Domain Restriction Active:</strong> Only @power-transitions.com emails will be accepted.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Power Pipeline Systems. Critical Infrastructure.</p>
                <p>This is an automated test message.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };
      
      const info = await this.transporter.sendMail(testEmail);
      
      return { 
        success: true, 
        messageId: info.messageId,
        to: testTo
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // === STRICT DOMAIN VALIDATION ===
  
  validateEmailDomain(email) {
    if (!email || typeof email !== 'string') {
      console.error('❌ Invalid email address');
      return false;
    }
    
    try {
      const emailDomain = email.toLowerCase().split('@')[1];
      const isValid = emailDomain === 'power-transitions.com';
      
      if (!isValid) {
        console.error(`❌ Email domain rejected: ${emailDomain}`);
        console.error(`   Only @power-transitions.com domains are allowed`);
      }
      
      return isValid;
    } catch (error) {
      console.error('❌ Error validating email domain:', error.message);
      return false;
    }
  }

  // === EMAIL TEMPLATE METHODS ===
  
  async loadTemplate(templateName, data = {}) {
    const templatesDir = path.join(__dirname, 'email-templates');
    const templatePath = path.join(templatesDir, `${templateName}.html`);
    
    try {
      // Check if template exists
      await fs.access(templatePath);
      
      // Read template
      let template = await fs.readFile(templatePath, 'utf8');
      
      // Add default data
      const templateData = {
        ...data,
        current_year: new Date().getFullYear(),
        frontend_url: process.env.FRONTEND_URL || 'https://platform.power-transitions.com',
        system_name: 'Power Pipeline Dashboard',
        company_name: 'Power Pipeline Systems',
        support_email: 'ababalola@power-transitions.com'
      };
      
      // Replace placeholders
      Object.keys(templateData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'gi');
        template = template.replace(regex, templateData[key]);
      });
      
      return template;
      
    } catch (error) {
      console.warn(`⚠️ Template ${templateName}.html not found, using default`);
      return this.getDefaultTemplate(templateName, data);
    }
  }

  getDefaultTemplate(templateName, data) {
    // Default templates that match your brand
    const templates = {
      'registration-received': `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #0078D4 0%, #005A9E 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 40px 30px; }
            .status-box { background: #e8f4fd; border-left: 4px solid #0078D4; padding: 20px; margin: 20px 0; }
            .footer { text-align: center; padding: 25px; color: #666; font-size: 12px; border-top: 1px solid #eee; background: #fafafa; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Power Pipeline Dashboard</h1>
              <h2>Registration Received</h2>
            </div>
            <div class="content">
              <h3>Hello {{username}},</h3>
              <p>Your registration for the Power Pipeline Dashboard has been received and is pending admin approval.</p>
              
              <div class="status-box">
                <strong>📋 Registration Status:</strong> Pending Approval<br>
                <strong>👤 Username:</strong> {{username}}<br>
                <strong>📧 Email:</strong> {{email}}<br>
                <strong>📅 Date:</strong> ${new Date().toLocaleDateString()}
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>An administrator will review your registration</li>
                <li>You'll receive an approval email once approved</li>
                <li>You can then login to the dashboard</li>
              </ol>
              
              <p>Approval typically takes 1-2 business days.</p>
              <p>For assistance, contact: {{support_email}}</p>
            </div>
            <div class="footer">
              <p>© {{current_year}} {{company_name}}. Critical Infrastructure.</p>
              <p>This is an automated message from {{system_name}}.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      
      'account-approved': `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 40px 30px; }
            .button { display: inline-block; background: #28a745; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
            .footer { text-align: center; padding: 25px; color: #666; font-size: 12px; border-top: 1px solid #eee; background: #fafafa; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Approved!</h1>
              <p>Power Pipeline Dashboard</p>
            </div>
            <div class="content">
              <h3>Welcome {{username}},</h3>
              <p>Your account has been approved by the administrator.</p>
              <p>You now have access to the Power Pipeline Dashboard.</p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{frontend_url}}/login" class="button">Login to Dashboard</a>
              </div>
              
              <p><strong>Login Details:</strong></p>
              <ul>
                <li>Username: <strong>{{username}}</strong></li>
                <li>Login URL: <a href="{{frontend_url}}/login">{{frontend_url}}/login</a></li>
                <li>Use the password you registered with</li>
              </ul>
              
              <p><strong>Security Notes:</strong></p>
              <ul>
                <li>Never share your credentials</li>
                <li>Log out after each session</li>
                <li>Contact support if you need assistance</li>
              </ul>
            </div>
            <div class="footer">
              <p>© {{current_year}} {{company_name}}. Critical Infrastructure.</p>
              <p>This is an automated message from {{system_name}}.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      
      'admin-approval-notification': `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 40px 30px; }
            .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background: #ff9800; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
            .footer { text-align: center; padding: 25px; color: #666; font-size: 12px; border-top: 1px solid #eee; background: #fafafa; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Registration Requires Approval</h1>
              <p>Power Pipeline Dashboard</p>
            </div>
            <div class="content">
              <h3>Hello Administrator,</h3>
              <p>A new user has registered and requires your approval.</p>
              
              <div class="alert-box">
                <strong>⚠️ Action Required</strong><br>
                <strong>Username:</strong> {{username}}<br>
                <strong>Email:</strong> {{email}}<br>
                <strong>Registration Date:</strong> ${new Date().toLocaleString()}<br>
                <strong>Status:</strong> Pending Approval
              </div>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{approval_link}}" class="button">Review & Approve Registration</a>
              </div>
              
              <p><strong>Direct Approval Link:</strong></p>
              <p><a href="{{approval_link}}">{{approval_link}}</a></p>
              
              <p><strong>Review Guidelines:</strong></p>
              <ul>
                <li>Verify user has @power-transitions.com email</li>
                <li>Approve if user is authorized personnel</li>
                <li>Reject if email domain is incorrect</li>
                <li>Contact user if more information is needed</li>
              </ul>
            </div>
            <div class="footer">
              <p>© {{current_year}} {{company_name}}. Critical Infrastructure.</p>
              <p>This is an automated notification from {{system_name}}.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      
      'password-reset': `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 40px 30px; }
            .button { display: inline-block; background: #2196F3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
            .security-alert { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; padding: 25px; color: #666; font-size: 12px; border-top: 1px solid #eee; background: #fafafa; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
              <p>Power Pipeline Dashboard</p>
            </div>
            <div class="content">
              <h3>Hello {{username}},</h3>
              <p>We received a request to reset your password for the Power Pipeline Dashboard.</p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{reset_link}}" class="button">Reset Password</a>
              </div>
              
              <p><strong>Or copy this link:</strong></p>
              <p style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; word-break: break-all;">
                {{reset_link}}
              </p>
              
              <p><strong>Important:</strong> This link expires in 1 hour.</p>
              
              <div class="security-alert">
                <strong>⚠️ Security Alert</strong><br>
                If you didn't request this password reset:
                <ul>
                  <li>Ignore this email</li>
                  <li>Your password will not be changed</li>
                  <li>Contact support if you're concerned</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>© {{current_year}} {{company_name}}. Critical Infrastructure.</p>
              <p>This is an automated message from {{system_name}}.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    return templates[templateName] || `<p>Email content for ${templateName}: ${JSON.stringify(data)}</p>`;
  }

  // === MAIN EMAIL SENDING METHOD ===
  
  async sendEmail(to, subject, templateName, data = {}) {
    if (!this.initialized || !this.transporter) {
      console.error('❌ Email service not initialized');
      return { success: false, error: 'Email service not ready' };
    }
    
    try {
      console.log(`\n📧 Preparing to send ${templateName} to: ${to}`);
      
      // STRICT DOMAIN VALIDATION - Only @power-transitions.com allowed
      if (!this.validateEmailDomain(to)) {
        return { 
          success: false, 
          error: `Only @power-transitions.com email addresses are allowed. Received: ${to}` 
        };
      }
      
      // Load template
      const html = await this.loadTemplate(templateName, data);
      const text = this.htmlToText(html);
      
      // Prepare email
      const mailOptions = {
        from: `"Power Pipeline System" <${this.fromEmail}>`,
        to: to,
        subject: subject,
        html: html,
        text: text,
        // Office 365 specific headers
        headers: {
          'X-Priority': '3',
          'X-Mailer': 'Power Pipeline Dashboard 1.0',
          'X-Company': 'Power Pipeline Systems',
          'X-Auto-Response-Suppress': 'All',
          'Precedence': 'bulk'
        },
        // DKIM signing would go here in production
        dkim: {
          domainName: 'power-transitions.com',
          keySelector: 'default',
          privateKey: '' // Add DKIM private key in production
        }
      };
      
      // Send email
      console.log(`   Sending via Office 365 SMTP...`);
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully to ${to}`);
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   Response: ${info.response}`);
      
      return {
        success: true,
        messageId: info.messageId,
        to: to,
        subject: subject
      };
      
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      return {
        success: false,
        error: error.message,
        to: to
      };
    }
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  // === SPECIFIC EMAIL METHODS ===
  
  async sendRegistrationEmail(userData) {
    return this.sendEmail(
      userData.email,
      'Power Pipeline Dashboard - Registration Received',
      'registration-received',
      {
        username: userData.username,
        email: userData.email,
        full_name: userData.full_name || userData.username
      }
    );
  }

  async sendApprovalEmail(userData) {
    return this.sendEmail(
      userData.email,
      'Power Pipeline Dashboard - Account Approved',
      'account-approved',
      {
        username: userData.username,
        email: userData.email
      }
    );
  }

  async sendAdminNotification(userData, approvalToken) {

    const approvalLink = `${process.env.FRONTEND_URL || 'https://platform.power-transitions.com'}/admin/review/${approvalToken}`;
    return this.sendEmail(
      process.env.ADMIN_EMAIL || 'ababalola@power-transitions.com',
      'URGENT: New User Registration Requires Approval',
      'admin-approval-notification',
      {
        username: userData.username,
        email: userData.email,
        approval_link: approvalLink
      }
    );
  }

  async sendPasswordResetEmail(userData, resetToken) {
    const resetLink = `${process.env.FRONTEND_URL || 'https://platform.power-transitions.com'}/reset-password/${resetToken}`;
    
    return this.sendEmail(
      userData.email,
      'Power Pipeline Dashboard - Password Reset',
      'password-reset',
      {
        username: userData.username,
        reset_link: resetLink
      }
    );
  }

  // === TEST METHOD ===
  
  async testEmailSystem() {
    console.log('\n🧪 Testing Office 365 Email System...\n');
    
    const testUser = {
      username: 'testuser',
      email: 'ababalola@power-transitions.com', // Must be @power-transitions.com
      full_name: 'Test User'
    };
    
    const tests = [
      {
        name: 'Registration Email',
        method: () => this.sendRegistrationEmail(testUser)
      },
      {
        name: 'Admin Notification',
        method: () => this.sendAdminNotification(testUser, 'test-approval-token-123')
      },
      {
        name: 'Account Approval Email',
        method: () => this.sendApprovalEmail(testUser)
      },
      {
        name: 'Password Reset Email',
        method: () => this.sendPasswordResetEmail(testUser, 'test-reset-token-456')
      }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      console.log(`📨 Testing: ${test.name}`);
      console.log(`   To: ${test.name.includes('Admin') ? 'ababalola@power-transitions.com' : testUser.email}`);
      
      const result = await test.method();
      
      if (result.success) {
        console.log(`✅ ${test.name} - PASSED`);
        console.log(`   Message ID: ${result.messageId}\n`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - FAILED: ${result.error}\n`);
        failed++;
      }
    }
    
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed > 0) {
      console.log('\n🚨 Office 365 SMTP issues detected.');
      console.log('💡 Contact your IT admin and ask them to:');
      console.log('   1. Enable SMTP AUTH for noreply@power-transitions.com');
      console.log('   2. Or provide an App Password if MFA is enabled');
      console.log('   3. Check if the mailbox can send emails');
    }
    
    return { passed, failed };
  }
}

// Create singleton instance
const emailService = new EmailService();

// Auto-initialize when imported
if (require.main === module) {
  // Run as standalone script
  (async () => {
    console.log('='.repeat(60));
    console.log('OFFICE 365 EMAIL SERVICE TEST');
    console.log('='.repeat(60));
    
    const initialized = await emailService.initialize();
    
    if (initialized) {
      console.log('\n✅ Office 365 Email Service is READY!');
      console.log('\n📋 Configuration:');
      console.log(`   From: noreply@power-transitions.com`);
      console.log(`   Server: smtp.office365.com:587`);
      console.log(`   Domain Restriction: @power-transitions.com only`);
      
      // Run tests if requested
      const runTests = process.argv.includes('--test');
      if (runTests) {
        await emailService.testEmailSystem();
      }
    } else {
      console.log('\n❌ Email service failed to initialize');
      console.log('\n🚨 CONTACT YOUR IT ADMIN:');
      console.log('   Ask them to enable SMTP AUTH for noreply@power-transitions.com');
      console.log('   Or provide App Password if MFA is enabled');
    }
  })();
} else {
  // Export for use in other files
  module.exports = emailService;
}
