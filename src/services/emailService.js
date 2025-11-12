const nodemailer = require("nodemailer")
const { google } = require("googleapis")
const logger = require("../utils/logger")
const config = require("../utils/config")

class EmailService {
  async waitForInit() {
    while (!this.isInitialized) {
      await new Promise((res) => setTimeout(res, 100))
    }
  }

  constructor() {
    this.gmail = null
    this.isInitialized = false
    this.oAuth2Client = null
    this.lastTokenRefresh = null
    this.tokenRefreshInterval = null
    this.transporter = null
  }

  async initializeGmail() {
    try {
      logger.info("📧 Initializing Email Service...")

      if (!config.SMTP_USER || !config.SMTP_PASS) {
        logger.error("❌ SMTP credentials not set. Emails cannot be sent.")
        return
      }

      // Create SMTP transporter
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
        rejectUnauthorized: config.SMTP_REJECT_UNAUTHORIZED,
      })

      // Verify connection
      try {
        await this.transporter.verify()
        logger.info("✅ SMTP connection verified successfully")
      } catch (err) {
        logger.warn("⚠️ SMTP verification failed, will retry on first email send:", err.message)
      }

      this.isInitialized = true
      logger.info("✅ Email Service initialized successfully.")
    } catch (err) {
      logger.error("❌ Failed to initialize Email Service:", err)
      this.isInitialized = false
    }
  }

  async sendEmail(to, subject, text, html = null) {
    if (!this.isInitialized || !this.transporter) throw new Error("Email Service not initialized")

    try {
      const mailOptions = {
        from: `McRoberts Scholars Bot <${config.SMTP_USER}>`,
        to,
        subject,
        text,
        html: html || text,
        replyTo: config.SMTP_USER,
      }

      const res = await this.transporter.sendMail(mailOptions)
      logger.info(`✅ Email sent to ${to} (Message ID: ${res.messageId})`)
      return res
    } catch (err) {
      logger.error(`❌ Failed to send email to ${to}:`, err.message)
      throw err
    }
  }

  async sendBulkEmail(recipients, subject, text, html = null) {
    if (!this.isInitialized || !this.transporter) throw new Error("Email Service not initialized")

    const results = []
    const errors = []

    for (const r of recipients) {
      const to = typeof r === "string" ? r : r.email
      if (!to) continue
      try {
        const res = await this.sendEmail(to, subject, text, html)
        results.push({ email: to, status: "sent", messageId: res.messageId })
      } catch (err) {
        errors.push({ email: to, error: err.message })
      }
    }

    logger.info(`✅ Bulk email process finished: ${results.length} sent, ${errors.length} failed`)
    return { results, errors }
  }

  async sendTestEmail(to = config.SMTP_USER) {
    return this.sendEmail(to, "Test Email", "This is a test email from McRoberts Scholars Bot.")
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      smtpUser: config.SMTP_USER || "Not set",
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
    }
  }

  destroy() {
    if (this.transporter) {
      this.transporter.close()
    }
  }
}

// Auto-initialize
const emailService = new EmailService()
emailService.initializeGmail().catch(console.error)

module.exports = emailService
