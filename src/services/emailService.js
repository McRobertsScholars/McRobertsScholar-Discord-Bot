const nodemailer = require("nodemailer");
const config = require("../utils/config");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    console.log("📧 EmailService instance created.");
    // ❌ remove this.initializeTransporter();  <-- don't connect on startup
  }

  async initializeTransporter() {
    try {
      logger.info("Initializing email service...");
      
      // Debug logging to verify cleaned values
      logger.info(`SMTP_HOST: ${config.SMTP_HOST}`);
      logger.info(`SMTP_PORT: ${config.SMTP_PORT}`);
      logger.info(`SMTP_USER: ${config.SMTP_USER}`);
      logger.info(`SMTP_PASS: ${config.SMTP_PASS ? '********' : 'not set'}`);

      if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
        logger.error(`Missing SMTP credentials - HOST: ${!!config.SMTP_HOST}, USER: ${!!config.SMTP_USER}, PASS: ${!!config.SMTP_PASS}`);
        this.isInitialized = false;
        return; // Don't throw - just log and return
      }

      // Setup SMTP WITHOUT verification (which causes timeouts on OnRender)
      this.setupSMTP();
      this.isInitialized = true;
      logger.info("Email service setup complete (verification skipped for OnRender compatibility)");
    } catch (error) {
      logger.error("Failed to initialize email service:", error);
      this.isInitialized = false;
      // Don't throw - let the app continue running
    }
  }

  setupSMTP() {
    logger.info(`Setting up SMTP transporter for ${config.SMTP_USER}`);
    
    const isGmail = (config.SMTP_HOST || '').includes('gmail.com') || !config.SMTP_HOST;
    const baseOptions = isGmail
      ? {
          service: 'gmail',
          auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          },
        }
      : {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT || 587,
          secure: !!config.SMTP_SECURE, // true for 465, false for STARTTLS
          auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          },
        };

    this.transporter = nodemailer.createTransport({
      ...baseOptions,
      requireTLS: true,
      tls: {
        rejectUnauthorized: config.SMTP_REJECT_UNAUTHORIZED !== false
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      // Critical: prevent 2-minute hangs on Render by setting timeouts at transport level
      connectionTimeout: 15000, // 15s to establish TCP/TLS
      greetingTimeout: 10000,   // 10s to get server greeting
      socketTimeout: 15000      // 15s for inactivity on socket
    });

    // DON'T verify here - it causes timeouts on OnRender
    // Verification will happen on first email send
  }

  async sendEmail(to, subject, text, html = null) {
    try {
      if (!this.transporter || !this.isInitialized) {
        logger.error("Email transporter not initialized properly");
        throw new Error("Email service not available");
      }
  
      const mailOptions = {
        from: `"McRoberts Scholars Bot" <${config.SMTP_USER}>`,
        to,
        subject,
        text,
        html: html || text,
        timeout: 15000, // 15s timeout
      };
  
      logger.info(`Attempting to send email to ${to}...`);
  
      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent successfully to ${to} - Message ID: ${result.messageId}`);
      return result;
  
    } catch (error) {
      logger.error(`❌ Failed to send email to ${to}:`, error.message);
  
      if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEOUT') {
        logger.error('Connection timeout - OnRender may be blocking SMTP. Consider using an email API service.');
      } else if (error.code === 'EAUTH') {
        logger.error('Authentication failed - App Password may be incorrect or revoked');
        logger.error(`Current user: ${config.SMTP_USER}`);
      } else if (error.code === 'ECONNREFUSED') {
        logger.error('Connection refused - SMTP port may be blocked');
      }
  
      throw error;
    }
  }
  

  async sendBulkEmail(recipients, subject, text, html = null) {
    if (!this.isInitialized) {
      logger.error("Email service not initialized - bulk email aborted");
      return { 
        results: [], 
        errors: recipients.map(r => ({ 
          email: r.email, 
          error: "Email service not available" 
        })) 
      };
    }

    try {
      const emails = recipients
        .map(r => (typeof r === 'string' ? r : r.email))
        .filter(Boolean);

      if (emails.length === 0) {
        throw new Error('No valid recipient emails provided');
      }

      const mailOptions = {
        from: `"McRoberts Scholars Bot" <${config.SMTP_USER}>`,
        to: config.SMTP_USER, // send to self; all real recipients in BCC
        bcc: emails.join(','),
        subject,
        text,
        html: html || text,
        // Additional per-send timeouts to avoid long hangs
        timeout: 15000
      };

      logger.info(`Sending single BCC email to ${emails.length} recipients`);
      const result = await this.transporter.sendMail(mailOptions);

      logger.info(`✅ Bulk BCC email sent. Message ID: ${result.messageId}`);
      return { results: emails.map(e => ({ email: e, status: 'sent' })), errors: [] };
    } catch (error) {
      logger.error('❌ Bulk BCC email failed:', error.message);
      if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEOUT') {
        logger.error('Connection timeout - Render may block direct SMTP. Consider Mailgun/SendGrid.');
      } else if (error.code === 'EAUTH') {
        logger.error('Authentication failed - check SMTP_USER and App Password');
      } else if (error.response) {
        logger.error(`SMTP response: ${error.response}`);
      }
      const emails = recipients.map(r => (typeof r === 'string' ? r : r.email)).filter(Boolean);
      return { results: [], errors: emails.map(e => ({ email: e, error: error.message })) };
    }
  }

  async sendTestEmail(to, subject, text, html = null) {
    const target = to || config.SMTP_USER;
    logger.info(`Sending test email to ${target}`);
    return this.sendEmail(target, subject, text, html);
  }

  // Test connection method that won't crash the app
  async testConnection() {
    if (!this.isInitialized) {
      logger.error("Email service not initialized");
      return false;
    }

    try {
      // Try sending a test email to yourself instead of verify()
      await this.sendEmail(
        config.SMTP_USER, // Send to self
        'Email Service Test',
        'This is an automated test to verify email service is working.',
        '<p>This is an automated test to verify email service is working.</p>'
      );
      logger.info("✅ Email service test successful!");
      return true;
    } catch (error) {
      logger.error("❌ Email service test failed:", error.message);
      return false;
    }
  }

  // Get service status without crashing
  getStatus() {
    return {
      initialized: this.isInitialized,
      hasTransporter: !!this.transporter,
      smtpUser: config.SMTP_USER || 'Not configured'
    };
  }
}

module.exports = new EmailService();