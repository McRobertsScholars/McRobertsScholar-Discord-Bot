const { google } = require("googleapis")
const config = require("../utils/config")
const logger = require("../utils/logger")

class GoogleSheetsService {
  constructor() {
    this.auth = null
    this.sheets = null
    this.drive = null
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
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      })

      this.sheets = google.sheets({ version: "v4", auth: this.auth })
      this.drive = google.drive({ version: "v3", auth: this.auth })
      logger.info("Google Sheets and Drive services initialized successfully")
    } catch (error) {
      logger.error("Failed to initialize Google services:", error)
    }
  }

  async findMostRecentSpreadsheet() {
    try {
      if (!this.drive) {
        throw new Error("Google Drive service not initialized")
      }

      logger.info("Searching for spreadsheets with year patterns...")

      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and name contains '20'",
        fields: "files(id, name, createdTime, modifiedTime)",
        orderBy: "modifiedTime desc",
      })

      const files = response.data.files
      if (!files || files.length === 0) {
        throw new Error(
          "No spreadsheets found. Please create a spreadsheet with a year in the name (e.g., 'McRoberts Scholars 2026/2027')",
        )
      }

      logger.info(`Found ${files.length} potential spreadsheets`)

      const yearFiles = files
        .filter((file) => {
          return /\d{4}[/\-_]\d{4}|\d{4}/.test(file.name)
        })
        .sort((a, b) => {
          const yearA = Number.parseInt(a.name.match(/\d{4}/)[0])
          const yearB = Number.parseInt(b.name.match(/\d{4}/)[0])
          return yearB - yearA
        })

      if (yearFiles.length === 0) {
        const fileNames = files.map((f) => f.name).join(", ")
        throw new Error(
          `No spreadsheets with year patterns found. Available spreadsheets: ${fileNames}\nPlease create a spreadsheet with a year in the name (e.g., 'McRoberts Scholars 2026/2027')`,
        )
      }

      const mostRecentFile = yearFiles[0]
      logger.info(`Auto-discovered most recent spreadsheet: "${mostRecentFile.name}" (ID: ${mostRecentFile.id})`)

      return mostRecentFile.id
    } catch (error) {
      logger.error("Error finding spreadsheets:", error.message)
      throw error
    }
  }

  async getMemberEmails() {
    try {
      if (!this.sheets) {
        throw new Error("Google Sheets service not initialized. Please check your Google API credentials.")
      }

      let spreadsheetId = config.GOOGLE_SPREADSHEET_ID

      if (!spreadsheetId) {
        logger.info("No GOOGLE_SPREADSHEET_ID configured, attempting auto-discovery...")
        spreadsheetId = await this.findMostRecentSpreadsheet()
      }

      let spreadsheet
      try {
        spreadsheet = await this.sheets.spreadsheets.get({
          spreadsheetId: spreadsheetId,
        })
      } catch (error) {
        if (error.code === 404) {
          if (config.GOOGLE_SPREADSHEET_ID) {
            logger.warn(`Configured spreadsheet ID not found, attempting auto-discovery...`)
            spreadsheetId = await this.findMostRecentSpreadsheet()
            spreadsheet = await this.sheets.spreadsheets.get({
              spreadsheetId: spreadsheetId,
            })
          } else {
            throw new Error(
              `Spreadsheet not found. Please check that:\n1. The spreadsheet exists and is accessible\n2. The service account has permission to read the spreadsheet`,
            )
          }
        } else {
          throw error
        }
      }

      const sheetNames = spreadsheet.data.sheets.map((sheet) => sheet.properties.title)
      logger.info(`Available sheets: ${sheetNames.join(", ")}`)

      const yearSheets = sheetNames.filter((name) => {
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

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${mostRecentSheet}!A:Z`,
      })

      const rows = response.data.values
      if (!rows || rows.length === 0) {
        throw new Error(`No data found in sheet "${mostRecentSheet}". Please add member data to the spreadsheet.`)
      }

      if (rows.length === 1) {
        throw new Error(`Only headers found in sheet "${mostRecentSheet}". Please add member data below the headers.`)
      }

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
    return !!(this.sheets && this.drive && config.GOOGLE_CLIENT_EMAIL && config.GOOGLE_PRIVATE_KEY)
  }
}

module.exports = new GoogleSheetsService()
