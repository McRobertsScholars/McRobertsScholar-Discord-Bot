const nodemailer = require("nodemailer");
const config = require("../utils/config");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
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
        throw new Error(`Missing SMTP credentials - HOST: ${!!config.SMTP_HOST}, USER: ${!!config.SMTP_USER}, PASS: ${!!config.SMTP_PASS}`);
      }
      
      await this.setupSMTP();
      logger.info("Email service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize email service:", error);
      throw error;
    }
  }

  async setupSMTP() {
    logger.info(`Setting up SMTP transporter for ${config.SMTP_USER}`);
    
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: false, // Use STARTTLS
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      tls: {
        // Don't fail on invalid certs (helps with some environments)
        rejectUnauthorized: false
      },
      // Add connection timeout
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    // Verify the connection configuration
    try {
      await this.transporter.verify();
      logger.info("SMTP connection verified successfully");
    } catch (error) {
      logger.error("SMTP verification failed:", error);
      throw error;
    }
  }

  async sendEmail(to, subject, text, html = null) {
    try {
      if (!this.transporter) {
        throw new Error("Email transporter not initialized");
      }

      const mailOptions = {
        from: `"McRoberts Scholars Bot" <${config.SMTP_USER}>`,
        to,
        subject,
        text,
        html: html || text,
      };

      logger.info(`Sending email to ${to}...`);
      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent successfully to ${to} - Message ID: ${result.messageId}`);
      return result;
    } catch (error) {
      logger.error(`❌ Failed to send email to ${to}:`, error);
      
      // More detailed error logging
      if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEOUT') {
        logger.error('Connection timeout - check network and firewall settings');
      } else if (error.code === 'EAUTH') {
        logger.error('Authentication failed - App Password may be incorrect or revoked');
      }
      
      throw error;
    }
  }

  async sendBulkEmail(recipients, subject, text, html = null) {
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
      }
    }
    logger.info(`Bulk email complete - Sent: ${results.length}, Failed: ${errors.length}`);
    return { results, errors };
  }

  // Add a test method similar to your working script
  async testConnection() {
    try {
      await this.transporter.verify();
      logger.info("✅ Email service connection test successful!");
      return true;
    } catch (error) {
      logger.error("❌ Email service connection test failed:", error);
      return false;
    }
  }
}

module.exports = new EmailService();
