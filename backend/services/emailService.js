const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    // SMTP Configuration for Office365
    this.transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // Use TLS
      requireTLS: true,
      auth: {
        user: 'noreply@power-transitions.com',
        pass: 'N*273989079320ul'
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false 
      },
      connectionTimeout: 10000, 
      greetingTimeout: 10000,
      socketTimeout: 10000
    });
    
    // Verify connection on startup
    this.verifyConnection();
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection established successfully');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection failed:', error.message);
      console.log('⚠️  Emails will not be sent. Check your SMTP credentials.');
      return false;
    }
  }

  // Validate email domain - ONLY allow @power-transitions.com
  validateEmailDomain(email) {
    if (!email || typeof email !== 'string') return false;
    
    try {
      const emailDomain = email.toLowerCase().split('@')[1];
      return emailDomain === 'power-transitions.com';
    } catch (error) {
      return false;
    }
  }

  // Windows-compatible path resolution for email templates
  async loadTemplate(templateName, data = {}) {
    try {
      // Get the directory where this script is located
      const currentDir = __dirname;
      
      // Build the template path - works on both Windows and Unix
      const templatePath = path.join(currentDir, 'email-templates', `${templateName}.html`);
      
      console.log(`📄 Looking for template at: ${templatePath}`);
      
      // Check if file exists
      try {
        await fs.access(templatePath);
      } catch (err) {
        console.warn(`⚠️ Template file not found: ${templateName}.html, using default template`);
        return this.getDefaultTemplate(templateName, data);
      }
      
      // Read the template file
      let template = await fs.readFile(templatePath, 'utf8');
      
      // Add default data
      const templateData = {
        ...data,
        current_year: new Date().getFullYear(),
        frontend_url: process.env.FRONTEND_URL || 'https://platform.power-transitions.com',
        approval_date: data.approval_date || new Date().toLocaleDateString(),
        registration_date: data.registration_date || new Date().toLocaleDateString(),
        expiry_time: data.expiry_time || '1 hour'
      };
      
      // Replace all placeholders
      Object.keys(templateData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'gi');
        template = template.replace(regex, templateData[key]);
      });
      
      return template;
    } catch (error) {
      console.error(`❌ Error loading template ${templateName}:`, error);
      return this.getDefaultTemplate(templateName, data);
    }
  }

  // Get default template if file doesn't exist
  getDefaultTemplate(templateName, data) {
    const currentYear = new Date().getFullYear();
    const frontendUrl = process.env.FRONTEND_URL || 'https://platform.power-transitions.com';
    
    const templates = {
      'registration-received': `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .status-box { background: #e8f4fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Power Pipeline Dashboard</h1>
              <h2>Registration Received</h2>
            </div>
            <div class="content">
              <h3>Hello ${data.username || 'User'},</h3>
              <p>Your registration has been received and is pending admin approval.</p>
              <div class="status-box">
                <strong>Status:</strong> Pending Approval<br>
                <strong>Username:</strong> ${data.username}<br>
                <strong>Email:</strong> ${data.email}
              </div>
              <p>You will receive another email once your account is approved.</p>
              <p>Approval typically takes 1-2 business days.</p>
            </div>
            <div class="footer">
              <p>© ${currentYear} Power Pipeline Systems. Critical Infrastructure.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      
      'account-approved': `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Approved!</h1>
            </div>
            <div class="content">
              <h3>Welcome ${data.username || 'User'},</h3>
              <p>Your account has been approved by the administrator.</p>
              <p>You can now login to the Power Pipeline Dashboard.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${frontendUrl}/login" class="button">Login Now</a>
              </div>
              <p><strong>Login Details:</strong></p>
              <ul>
                <li>Username: ${data.username}</li>
                <li>Go to: ${frontendUrl}/login</li>
              </ul>
            </div>
            <div class="footer">
              <p>© ${currentYear} Power Pipeline Systems. Critical Infrastructure.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      
      'admin-approval-notification': `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Registration Requires Approval</h1>
            </div>
            <div class="content">
              <h3>Hello Administrator,</h3>
              <p>A new user has registered and requires your approval.</p>
              <div class="alert">
                <strong>Registration Details:</strong><br>
                Username: ${data.username}<br>
                Email: ${data.email}<br>
                Full Name: ${data.full_name || 'Not provided'}<br>
                Date: ${new Date().toLocaleString()}
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.approval_link || frontendUrl + '/admin/review'}" class="button">Review Registration</a>
              </div>
              <p>Direct approval link:<br>
              <a href="${data.approval_link}">${data.approval_link}</a></p>
            </div>
            <div class="footer">
              <p>© ${currentYear} Power Pipeline Systems. Critical Infrastructure.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      
      'password-reset': `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .button { display: inline-block; background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h3>Hello ${data.username || 'User'},</h3>
              <p>Click the button below to reset your password. This link expires in 1 hour.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.reset_link}" class="button">Reset Password</a>
              </div>
              <p>Or copy this link:<br>
              <code style="background: #f0f0f0; padding: 10px; display: block; word-break: break-all;">${data.reset_link}</code></p>
              <p><strong>Note:</strong> If you didn't request this, ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${currentYear} Power Pipeline Systems. Critical Infrastructure.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    return templates[templateName] || `<p>${JSON.stringify(data)}</p>`;
  }

  // Send email with error handling
  async sendEmail(to, subject, templateName, data = {}) {
    try {
      // Validate recipient email domain
      if (!this.validateEmailDomain(to)) {
        throw new Error(`Email domain not allowed. Only @power-transitions.com emails are permitted. Received: ${to}`);
      }

      // Load template
      const html = await this.loadTemplate(templateName, data);
      
      // Create mail options
      const mailOptions = {
        from: '"Power Pipeline System" <noreply@power-transitions.com>',
        to: to,
        subject: subject,
        html: html,
        text: this.htmlToText(html),
        replyTo: process.env.ADMIN_EMAIL || 'ababalola@power-transitions.com',
        headers: {
          'X-Priority': templateName === 'admin-approval-notification' ? '1' : '3',
          'X-Mailer': 'Power Pipeline Dashboard 1.0'
        }
      };

      console.log(`📧 Attempting to send email to: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Template: ${templateName}`);

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully to ${to}`);
      console.log(`   Message ID: ${info.messageId}`);
      
      this.logEmail(to, templateName, subject, 'sent');
      
      return { 
        success: true, 
        messageId: info.messageId,
        message: `Email sent to ${to}`
      };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      
      this.logEmail(to, templateName, subject, 'failed', error.message);
      
      return { 
        success: false, 
        error: error.message,
        details: `Failed to send ${templateName} email to ${to}`
      };
    }
  }

  // Convert HTML to plain text (fallback)
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  // Log email activity
  logEmail(to, template, subject, status, error = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      to: to,
      template: template,
      subject: subject,
      status: status,
      error: error
    };
    
    console.log(`📋 Email Log:`, JSON.stringify(logEntry, null, 2));
  }

  // Public methods for specific email types
  
  async sendRegistrationEmail(userData) {
    console.log(`📨 Sending registration email to: ${userData.email}`);
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
    console.log(`📨 Sending approval email to: ${userData.email}`);
    return this.sendEmail(
      userData.email,
      'Power Pipeline Dashboard - Account Approved',
      'account-approved',
      {
        username: userData.username,
        email: userData.email,
        role: userData.role || 'Standard User'
      }
    );
  }

  async sendAdminNotification(userData, approvalLink) {
    const adminEmail = process.env.ADMIN_EMAIL || 'ababalola@power-transitions.com';
    console.log(`📨 Sending admin notification to: ${adminEmail}`);
    
    return this.sendEmail(
      adminEmail,
      'URGENT: New User Registration Requires Approval',
      'admin-approval-notification',
      {
        username: userData.username,
        email: userData.email,
        full_name: userData.full_name || 'Not provided',
        registration_date: userData.created_at || new Date().toISOString(),
        approval_link: approvalLink
      }
    );
  }

  async sendPasswordResetEmail(userData, resetToken) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    console.log(`📨 Sending password reset email to: ${userData.email}`);
    
    return this.sendEmail(
      userData.email,
      'Power Pipeline Dashboard - Password Reset',
      'password-reset',
      {
        username: userData.username,
        email: userData.email,
        reset_link: resetLink,
        expiry_time: '1 hour'
      }
    );
  }

// Create and export singleton instance
const emailService = new EmailService();

module.exports = emailService;
