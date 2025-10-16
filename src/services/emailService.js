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
  }

  async initializeGmail() {
    try {
      logger.info("📧 Initializing Gmail API EmailService...")

      if (!config.GMAIL_CLIENT_ID || !config.GMAIL_CLIENT_SECRET || !config.GMAIL_REFRESH_TOKEN || !config.GMAIL_USER) {
        logger.error("❌ Gmail API credentials not set. Emails cannot be sent.")
        return
      }

      // Create OAuth2 client
      this.oAuth2Client = new google.auth.OAuth2(
        config.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground", // redirect URI for refresh token use
      )

      this.oAuth2Client.setCredentials({
        refresh_token: config.GMAIL_REFRESH_TOKEN,
      })

      this.oAuth2Client.on("tokens", (tokens) => {
        if (tokens.refresh_token) {
          logger.info("🔄 New refresh token received")
        }
        if (tokens.access_token) {
          logger.info("✅ Access token refreshed successfully")
          this.lastTokenRefresh = new Date()
        }
      })

      // Gmail API instance
      this.gmail = google.gmail({ version: "v1", auth: this.oAuth2Client })

      try {
        await this.gmail.users.getProfile({ userId: "me" })
        logger.info("✅ Gmail API connection verified")
      } catch (err) {
        logger.warn("⚠️ Initial Gmail connection test failed, will retry on first email send:", err.message)
      }

      this.isInitialized = true
      this.lastTokenRefresh = new Date()

      this.setupTokenRefresh()

      logger.info("✅ Gmail API initialized successfully.")
    } catch (err) {
      logger.error("❌ Failed to initialize Gmail API:", err)
      this.isInitialized = false
    }
  }

  setupTokenRefresh() {
    // Clear any existing interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval)
    }

    // Refresh token every 50 minutes (before the 60-minute expiration)
    this.tokenRefreshInterval = setInterval(
      async () => {
        try {
          logger.info("🔄 Proactively refreshing Gmail access token...")
          const { credentials } = await this.oAuth2Client.refreshAccessToken()
          this.oAuth2Client.setCredentials(credentials)
          this.lastTokenRefresh = new Date()
          logger.info("✅ Gmail token refreshed successfully")
        } catch (err) {
          logger.error("❌ Failed to refresh Gmail token:", err.message)
        }
      },
      50 * 60 * 1000,
    ) // 50 minutes
  }

  async sendEmail(to, subject, text, html = null) {
    if (!this.isInitialized || !this.gmail) throw new Error("Gmail API not initialized")

    const messageParts = [
      `From: "McRoberts Scholars Bot" <${config.GMAIL_USER}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html || text,
    ]

    try {
      const rawMessage = Buffer.from(messageParts.join("\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

      const res = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: rawMessage },
      })

      logger.info(`✅ Email sent to ${to} (Message ID: ${res.data.id})`)
      return res.data
    } catch (err) {
      if (err.code === 401 || err.message.includes("invalid_grant") || err.message.includes("Token has been expired")) {
        logger.warn("⚠️ Token expired, attempting to refresh and retry...")
        try {
          const { credentials } = await this.oAuth2Client.refreshAccessToken()
          this.oAuth2Client.setCredentials(credentials)
          this.lastTokenRefresh = new Date()

          // Retry the send
          const res = await this.gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: Buffer.from(messageParts.join("\n"))
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, ""),
            },
          })

          logger.info(`✅ Email sent to ${to} after token refresh (Message ID: ${res.data.id})`)
          return res.data
        } catch (retryErr) {
          logger.error(`❌ Failed to send email to ${to} even after token refresh:`, retryErr.message)
          throw retryErr
        }
      }

      logger.error(`❌ Failed to send email to ${to}:`, err.message)
      throw err
    }
  }

  async sendBulkEmail(recipients, subject, text, html = null) {
    if (!this.isInitialized || !this.gmail) throw new Error("Gmail API not initialized")

    const results = []
    const errors = []

    for (const r of recipients) {
      const to = typeof r === "string" ? r : r.email
      if (!to) continue
      try {
        const res = await this.sendEmail(to, subject, text, html)
        results.push({ email: to, status: "sent", messageId: res.id })
      } catch (err) {
        errors.push({ email: to, error: err.message })
      }
    }

    logger.info(`✅ Bulk email process finished: ${results.length} sent, ${errors.length} failed`)
    return { results, errors }
  }

  async sendTestEmail(to = config.GMAIL_USER) {
    return this.sendEmail(to, "Test Email", "This is a test email from Gmail API EmailService.")
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      gmailUser: config.GMAIL_USER || "Not set",
      lastTokenRefresh: this.lastTokenRefresh ? this.lastTokenRefresh.toISOString() : "Never",
    }
  }

  destroy() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval)
      this.tokenRefreshInterval = null
    }
  }
}

// Auto-initialize
const emailService = new EmailService()

emailService.initializeGmail().catch(console.error)

module.exports = emailService
