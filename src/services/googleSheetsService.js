const { google } = require("googleapis")
const config = require("../utils/config")
const logger = require("../utils/logger")

class GoogleSheetsService {
  constructor() {
    this.auth = null
    this.sheets = null
    this.initializeAuth()
  }

  initializeAuth() {
    try {
      if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
        logger.warn("Google Sheets credentials not configured. Email functionality will be disabled.")
        return
      }

      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.GOOGLE_CLIENT_EMAIL,
          private_key: config.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Fix newline characters
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      })

      this.sheets = google.sheets({ version: "v4", auth: this.auth })
      logger.info("Google Sheets service initialized successfully")
    } catch (error) {
      logger.error("Failed to initialize Google Sheets service:", error)
    }
  }

  async getMemberEmails() {
    try {
      if (!this.sheets) {
        throw new Error("Google Sheets service not initialized. Please check your Google API credentials.")
      }

      if (!config.GOOGLE_SPREADSHEET_ID) {
        throw new Error("GOOGLE_SPREADSHEET_ID environment variable not set")
      }

      let spreadsheet
      try {
        spreadsheet = await this.sheets.spreadsheets.get({
          spreadsheetId: config.GOOGLE_SPREADSHEET_ID,
        })
      } catch (error) {
        if (error.code === 404) {
          throw new Error(
            `Spreadsheet not found. Please check that:\n1. The spreadsheet ID is correct: ${config.GOOGLE_SPREADSHEET_ID}\n2. The spreadsheet exists and is accessible\n3. The service account has permission to read the spreadsheet`,
          )
        }
        throw error
      }

      const sheetNames = spreadsheet.data.sheets.map((sheet) => sheet.properties.title)
      logger.info(`Available sheets: ${sheetNames.join(", ")}`)

      const yearSheets = sheetNames.filter((name) => {
        // Match patterns like: 2026/2027, 2026-2027, 2026_2027, or just 2026
        return /\d{4}[/\-_]\d{4}|\d{4}/.test(name)
      })

      if (yearSheets.length === 0) {
        throw new Error(
          `No year-based sheets found. Available sheets: ${sheetNames.join(", ")}\nPlease create a sheet with a year in the name (e.g., "2026/2027" or "2026-2027")`,
        )
      }

      const mostRecentSheet = yearSheets
        .sort((a, b) => {
          const yearA = Number.parseInt(a.match(/\d{4}/)[0])
          const yearB = Number.parseInt(b.match(/\d{4}/)[0])
          return yearA - yearB
        })
        .pop()

      logger.info(`Using most recent sheet: ${mostRecentSheet}`)

      // Get data from the most recent year sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.GOOGLE_SPREADSHEET_ID,
        range: `${mostRecentSheet}!A:Z`, // Get all columns
      })

      const rows = response.data.values
      if (!rows || rows.length === 0) {
        throw new Error(`No data found in sheet "${mostRecentSheet}". Please add member data to the spreadsheet.`)
      }

      if (rows.length === 1) {
        throw new Error(`Only headers found in sheet "${mostRecentSheet}". Please add member data below the headers.`)
      }

      // Assume first row is headers
      const headers = rows[0].map((header) => header.toLowerCase())
      logger.info(`Headers found: ${headers.join(", ")}`)

      const emailColumnIndex = headers.findIndex(
        (header) => header.includes("email") || header.includes("e-mail") || header.includes("mail"),
      )
      const nameColumnIndex = headers.findIndex(
        (header) =>
          header.includes("name") ||
          header.includes("first") ||
          header.includes("student") ||
          header.includes("member"),
      )

      if (emailColumnIndex === -1) {
        throw new Error(
          `Email column not found. Available columns: ${headers.join(", ")}\nPlease ensure there's a column with "email" in the name.`,
        )
      }

      // Extract member data
      const members = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const email = row[emailColumnIndex]
        const name = nameColumnIndex !== -1 ? row[nameColumnIndex] : `Member ${i}`

        if (email && email.includes("@")) {
          members.push({ name: name || "Unknown", email: email.trim() })
        }
      }

      if (members.length === 0) {
        throw new Error(
          `No valid email addresses found in sheet "${mostRecentSheet}". Please check that the email column contains valid email addresses.`,
        )
      }

      logger.info(`Found ${members.length} members with valid emails from sheet "${mostRecentSheet}"`)
      return { members, sheetName: mostRecentSheet }
    } catch (error) {
      logger.error("Error fetching member emails:", error.message)
      throw error
    }
  }

  isConfigured() {
    return !!(this.sheets && config.GOOGLE_SPREADSHEET_ID && config.GOOGLE_CLIENT_EMAIL && config.GOOGLE_PRIVATE_KEY)
  }
}

module.exports = new GoogleSheetsService()
