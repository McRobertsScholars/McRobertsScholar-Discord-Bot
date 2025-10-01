const { google } = require("googleapis");
const logger = require("../utils/logger");
const config = require("../utils/config");

class EmailService {
  constructor() {
    this.gmail = null;
    this.isInitialized = false;
  }

  async initializeGmail() {
    try {
      logger.info("📧 Initializing Gmail API EmailService...");

      if (!config.GMAIL_CLIENT_ID || !config.GMAIL_CLIENT_SECRET || !config.GMAIL_REFRESH_TOKEN || !config.GMAIL_USER) {
        logger.error("❌ Gmail API credentials not set. Emails cannot be sent.");
        return;
      }

      // Create OAuth2 client
      const oAuth2Client = new google.auth.OAuth2(
        config.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground" // redirect URI for refresh token use
      );

      oAuth2Client.setCredentials({
        refresh_token: config.GMAIL_REFRESH_TOKEN
      });

      // Gmail API instance
      this.gmail = google.gmail({ version: "v1", auth: oAuth2Client });
      this.isInitialized = true;
      logger.info("✅ Gmail API initialized successfully.");
    } catch (err) {
      logger.error("❌ Failed to initialize Gmail API:", err);
      this.isInitialized = false;
    }
  }

  async sendEmail(to, subject, text, html = null) {
    if (!this.isInitialized || !this.gmail) throw new Error("Gmail API not initialized");

    try {
      const messageParts = [
        `From: "McRoberts Scholars Bot" <${config.GMAIL_USER}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        html || text
      ];

      const rawMessage = Buffer.from(messageParts.join("\n"))
        .toString("base64")
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: rawMessage }
      });

      logger.info(`✅ Email sent to ${to} (Message ID: ${res.data.id})`);
      return res.data;
    } catch (err) {
      logger.error(`❌ Failed to send email to ${to}:`, err.message);
      throw err;
    }
  }

  async sendBulkEmail(recipients, subject, text, html = null) {
    if (!this.isInitialized || !this.gmail) throw new Error("Gmail API not initialized");

    const results = [];
    const errors = [];

    for (const r of recipients) {
      const to = typeof r === "string" ? r : r.email;
      if (!to) continue;
      try {
        const res = await this.sendEmail(to, subject, text, html);
        results.push({ email: to, status: "sent", messageId: res.id });
      } catch (err) {
        errors.push({ email: to, error: err.message });
      }
    }

    logger.info(`✅ Bulk email process finished: ${results.length} sent, ${errors.length} failed`);
    return { results, errors };
  }

  async sendTestEmail(to = config.GMAIL_USER) {
    return this.sendEmail(to, "Test Email", "This is a test email from Gmail API EmailService.");
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      gmailUser: config.GMAIL_USER || "Not set"
    };
  }
}

// Auto-initialize
const emailService = new EmailService();
emailService.initializeGmail().catch(console.error);

module.exports = emailService;
