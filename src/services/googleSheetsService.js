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
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.GOOGLE_CLIENT_EMAIL,
          private_key: config.GOOGLE_PRIVATE_KEY,
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
        throw new Error("Google Sheets service not initialized")
      }

      // Get all sheet names to find the most recent year
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: config.GOOGLE_SPREADSHEET_ID,
      })

      const sheetNames = spreadsheet.data.sheets.map((sheet) => sheet.properties.title)

      // Find sheets with year patterns (2026/2027, 2027/2028, etc.)
      const yearSheets = sheetNames.filter((name) => /\d{4}\/\d{4}/.test(name))

      if (yearSheets.length === 0) {
        throw new Error("No year-based sheets found in the spreadsheet")
      }

      // Sort to get the most recent year
      const mostRecentSheet = yearSheets.sort().pop()
      logger.info(`Using sheet: ${mostRecentSheet}`)

      // Get data from the most recent year sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.GOOGLE_SPREADSHEET_ID,
        range: `${mostRecentSheet}!A:Z`, // Get all columns
      })

      const rows = response.data.values
      if (!rows || rows.length === 0) {
        throw new Error("No data found in the spreadsheet")
      }

      // Assume first row is headers
      const headers = rows[0].map((header) => header.toLowerCase())
      const emailColumnIndex = headers.findIndex((header) => header.includes("email") || header.includes("e-mail"))
      const nameColumnIndex = headers.findIndex(
        (header) => header.includes("name") || header.includes("first") || header.includes("student"),
      )

      if (emailColumnIndex === -1) {
        throw new Error("Email column not found in spreadsheet")
      }

      // Extract member data
      const members = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const email = row[emailColumnIndex]
        const name = nameColumnIndex !== -1 ? row[nameColumnIndex] : `Member ${i}`

        if (email && email.includes("@")) {
          members.push({ name: name || "Unknown", email })
        }
      }

      logger.info(`Found ${members.length} members with valid emails`)
      return { members, sheetName: mostRecentSheet }
    } catch (error) {
      logger.error("Error fetching member emails:", error)
      throw error
    }
  }
}

module.exports = new GoogleSheetsService()
