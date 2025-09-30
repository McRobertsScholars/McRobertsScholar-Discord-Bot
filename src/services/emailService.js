const nodemailer = require("nodemailer")
const config = require("../utils/config")
const logger = require("../utils/logger")

class EmailService {
  constructor() {
    this.transporter = null
    this.initializeTransporter()
  }

  async initializeTransporter() {
    try {
      logger.info("Attempting to initialize email service...");
      // Only log SMTP related config now
      logger.info(`SMTP_HOST status: ${config.SMTP_HOST ? 'set' : 'not set'}`);
      logger.info(`SMTP_PORT status: ${config.SMTP_PORT ? 'set' : 'not set'}`);
      logger.info(`SMTP_USER status: ${config.SMTP_USER ? 'set' : 'not set'}`);
      logger.info(`SMTP_PASS status: ${config.SMTP_PASS ? 'set' : 'not set'}`);

      if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
        // Use SMTP
        this.setupSMTP();
      } else {
        throw new Error("No email configuration found (missing SMTP credentials)");
      }

      logger.info("Email service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize email service:", error);
      throw error; // Rethrow to ensure it's visible in main bot logs
    }
  }

  setupSMTP() {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: false, // TLS is used, but not SSL/implicit TLS
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }

  async sendEmail(to, subject, text, html = null) {
    try {
      if (!this.transporter) {
        throw new Error("Email transporter not initialized")
      }

      const mailOptions = {
        from: `"McRoberts Scholars Bot" <${config.SMTP_USER}>`, // Use a friendly name with the SMTP user
        to,
        subject,
        text,
        html: html || text,
        // Add a timeout to detect hanging send operations
        timeout: 10000, // 10 seconds
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}`);
      return result
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  async sendBulkEmail(recipients, subject, text, html = null) {
    const results = []
    const errors = []

    for (const recipient of recipients) {
      try {
        await this.sendEmail(recipient.email, subject, text, html)
        results.push({ email: recipient.email, status: "sent" })

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        errors.push({ email: recipient.email, error: error.message })
      }
    }

    return { results, errors }
  }
}

module.exports = new EmailService()
