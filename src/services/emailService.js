const nodemailer = require("nodemailer");
const config = require("../utils/config");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    // Don't await initialization - let it happen in background
    this.initializeTransporter();
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
    
    // Use exact same configuration as your working test
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // use STARTTLS
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      tls: {
        // Do not fail on invalid certs (useful for some environments)
        rejectUnauthorized: false
      },
      // Don't set connection timeouts for initial setup
      // Only set timeout on actual send
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
        // Add timeout for individual send operations
        timeout: 15000, // 15 seconds like your working test
      };

      logger.info(`Attempting to send email to ${to}...`);
      
      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent successfully to ${to} - Message ID: ${result.messageId}`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Failed to send email to ${to}:`, error.message);
      
      // More detailed error logging
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

    const results = [];
    const errors = [];

    logger.info(`Starting bulk email send to ${recipients.length} recipients`);

    for (const recipient of recipients) {
      try {
        await this.sendEmail(recipient.email, subject, text, html);
        results.push({ email: recipient.email, status: "sent" });
        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        errors.push({ email: recipient.email, error: error.message });
        logger.error(`Failed to send to ${recipient.email}: ${error.message}`);
      }
    }

    logger.info(`Bulk email complete - Sent: ${results.length}, Failed: ${errors.length}`);
    
    if (errors.length > 0) {
      logger.error("Failed recipients:", errors);
    }
    
    return { results, errors };
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