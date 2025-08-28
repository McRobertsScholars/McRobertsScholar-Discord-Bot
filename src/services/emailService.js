const nodemailer = require("nodemailer")
const { google } = require("googleapis")
const config = require("../utils/config")
const logger = require("../utils/logger")

class EmailService {
  constructor() {
    this.transporter = null
    this.initializeTransporter()
  }

  async initializeTransporter() {
    try {
      if (config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET && config.GMAIL_REFRESH_TOKEN) {
        // Use Gmail API
        await this.setupGmailAPI()
      } else if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
        // Use SMTP
        this.setupSMTP()
      } else {
        throw new Error("No email configuration found")
      }

      logger.info("Email service initialized successfully")
    } catch (error) {
      logger.error("Failed to initialize email service:", error)
    }
  }

  async setupGmailAPI() {
    const oauth2Client = new google.auth.OAuth2(
      config.GMAIL_CLIENT_ID,
      config.GMAIL_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground",
    )

    oauth2Client.setCredentials({
      refresh_token: config.GMAIL_REFRESH_TOKEN,
    })

    const accessToken = await oauth2Client.getAccessToken()

    this.transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: config.GMAIL_FROM_EMAIL,
        clientId: config.GMAIL_CLIENT_ID,
        clientSecret: config.GMAIL_CLIENT_SECRET,
        refreshToken: config.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    })
  }

  setupSMTP() {
    this.transporter = nodemailer.createTransporter({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: false,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    })
  }

  async sendEmail(to, subject, text, html = null) {
    try {
      if (!this.transporter) {
        throw new Error("Email transporter not initialized")
      }

      const mailOptions = {
        from: config.GMAIL_FROM_EMAIL || config.SMTP_USER,
        to,
        subject,
        text,
        html: html || text,
      }

      const result = await this.transporter.sendMail(mailOptions)
      logger.info(`Email sent successfully to ${to}`)
      return result
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error)
      throw error
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
