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
        logger.error("Missing credentials:", {
          SMTP_USER: config.SMTP_USER ? "✓ Set" : "✗ Missing",
          SMTP_PASS: config.SMTP_PASS ? "✓ Set" : "✗ Missing",
          SMTP_HOST: config.SMTP_HOST,
          SMTP_PORT: config.SMTP_PORT,
        })
        return
      }

      // Create SMTP transporter
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST || "smtp.gmail.com",
        port: config.SMTP_PORT || 587,
        secure: config.SMTP_SECURE !== false ? (config.SMTP_PORT === 465 ? true : false) : false, // Only secure on 465
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certs
        },
        connectionTimeout: 5000, // Reduced from 10s
        socketTimeout: 5000,
        greetingTimeout: 5000,
        pool: {
          maxConnections: 1,
          maxMessages: Number.POSITIVE_INFINITY,
          rateDelta: 1000,
          rateLimit: 5,
        },
      })

      // Verify connection
      try {
        await this.transporter.verify()
        logger.info("✅ SMTP connection verified successfully")
      } catch (err) {
        logger.warn("⚠️ SMTP verification failed, will retry on first email send:")
        logger.warn("SMTP Configuration:", {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          user: config.SMTP_USER,
          passLength: config.SMTP_PASS ? config.SMTP_PASS.length : 0,
          passHasSpaces: config.SMTP_PASS ? config.SMTP_PASS.includes(" ") : false,
        })
        logger.warn("SMTP Error Details:", {
          code: err.code,
          message: err.message,
          response: err.response,
          responseCode: err.responseCode,
        })
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

      const res = await Promise.race([
        this.transporter.sendMail(mailOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Email send timeout after 30 seconds")), 30000)),
      ])
      logger.info(`✅ Email sent to ${to} (Message ID: ${res.messageId})`)
      return res
    } catch (err) {
      logger.error(`❌ Failed to send email to ${to}:`, err.message)
      throw err
    }
  }

  async sendBulkEmail(recipients, subject, text, html = null) {
    if (!this.isInitialized || !this.transporter) throw new Error("Email Service not initialized")

    if (!recipients || recipients.length === 0) {
      logger.warn("⚠️ No recipients provided for bulk email")
      return { results: [], errors: [] }
    }

    try {
      const bccList = recipients.map((r) => (typeof r === "string" ? r : r.email)).filter(Boolean)

      const mailOptions = {
        from: `McRoberts Scholars Bot <${config.SMTP_USER}>`,
        to: config.SMTP_USER, // Send to self
        bcc: bccList, // All recipients get it but can't see each other
        subject,
        text,
        html: html || text,
        replyTo: config.SMTP_USER,
      }

      const res = await Promise.race([
        this.transporter.sendMail(mailOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Email send timeout after 30 seconds")), 30000)),
      ])

      logger.info(`✅ Bulk email sent to ${bccList.length} recipients (Message ID: ${res.messageId})`)
      return {
        results: bccList.map((email) => ({ email, status: "sent", messageId: res.messageId })),
        errors: [],
      }
    } catch (err) {
      logger.error(`❌ Bulk email failed:`, err.message)
      return {
        results: [],
        errors: recipients.map((r) => ({ email: typeof r === "string" ? r : r.email, error: err.message })),
      }
    }
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
