const nodemailer = require("nodemailer");
const config = require("../utils/config");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
  }

  async initializeTransporter() {
    try {
      logger.info("📧 Initializing EmailService...");

      if (!config.SMTP_USER || !config.SMTP_PASS) {
        logger.error("❌ SMTP_USER or SMTP_PASS not set. Emails cannot be sent.");
        return;
      }

      const baseOptions = config.SMTP_HOST.includes("gmail.com")
        ? { service: 'gmail', auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } }
        : { host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE, auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } };

      this.transporter = nodemailer.createTransport({
        ...baseOptions,
        requireTLS: true,
        tls: { rejectUnauthorized: config.SMTP_REJECT_UNAUTHORIZED },
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });

      this.isInitialized = true;
      logger.info("✅ EmailService initialized successfully.");
    } catch (err) {
      logger.error("❌ Failed to initialize EmailService:", err);
      this.isInitialized = false;
    }
  }

  async sendEmail(to, subject, text, html = null) {
    if (!this.isInitialized || !this.transporter) throw new Error("Email transporter not initialized");

    try {
      const mailOptions = {
        from: `"McRoberts Scholars Bot" <${config.SMTP_USER}>`,
        to,
        subject,
        text,
        html: html || text,
        timeout: 15000
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent to ${to} (Message ID: ${result.messageId})`);
      return result;
    } catch (err) {
      logger.error(`❌ Failed to send email to ${to}:`, err.message);
      throw err;
    }
  }

  async sendBulkEmail(recipients, subject, text, html = null) {
    if (!this.isInitialized) throw new Error("Email transporter not initialized");

    const emails = recipients.map(r => (typeof r === "string" ? r : r.email)).filter(Boolean);
    if (!emails.length) throw new Error("No valid recipients provided");

    try {
      const result = await this.transporter.sendMail({
        from: `"McRoberts Scholars Bot" <${config.SMTP_USER}>`,
        to: config.SMTP_USER,
        bcc: emails.join(","),
        subject,
        text,
        html: html || text,
        timeout: 15000
      });
      logger.info(`✅ Bulk email sent to ${emails.length} recipients (Message ID: ${result.messageId})`);
      return { results: emails.map(e => ({ email: e, status: 'sent' })), errors: [] };
    } catch (err) {
      logger.error(`❌ Bulk email failed: ${err.message}`);
      return { results: [], errors: emails.map(e => ({ email: e, error: err.message })) };
    }
  }

  async sendTestEmail(to = "tadjellcraft@gmail.com") {
    return this.sendEmail(
      to,
      "Test Email",
      "This is a test email from EmailService."
    );
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      smtpUser: config.SMTP_USER || "Not set"
    };
  }
}

// auto-initialize
const emailService = new EmailService();
emailService.initializeTransporter().catch(console.error);

module.exports = emailService;
