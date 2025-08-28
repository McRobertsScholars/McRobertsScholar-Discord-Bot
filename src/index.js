const { startBot, client } = require("./bot.js")
const logger = require("./utils/logger.js")
const express = require("express")
const axios = require("axios")
const { setupDiscordService } = require("./services/discordService.js")
const { setupDatabase } = require("./utils/setupDatabase.js")
const { removeExpiredScholarships } = require("./services/linkService.js")
const { testSupabaseConnection } = require("./services/supabaseService.js")
const { setupWebhooks } = require("./services/webhookService.js")

// Express server setup
const app = express()
const PORT = process.env.PORT || 10000

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

app.get("/", (req, res) => {
  res.send("Bot is running!")
})

setupWebhooks(app)

// Start Express server first
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)

  // Then start the bot and services
  startBot()
  setupDiscordService()
  setupDatabase()
  testSupabaseConnection()

  // Schedule daily cleanup of expired scholarships
  setInterval(
    async () => {
      logger.info("Running scheduled cleanup of expired scholarships")
      const result = await removeExpiredScholarships()
      if (result.success) {
        logger.info(result.message)
      } else {
        logger.error(`Scheduled cleanup failed: ${result.message}`)
      }
    },
    24 * 60 * 60 * 1000,
  ) // Run once every 24 hours
})

const WEBSITE_URL = process.env.RENDER_EXTERNAL_URL
if (WEBSITE_URL) {
  setInterval(
    () => {
      axios
        .get(WEBSITE_URL)
        .then(() => logger.info("Keep-alive ping successful"))
        .catch((error) => logger.error("Keep-alive ping failed:", error.message))
    },
    14 * 60 * 1000,
  )
}

try {
  logger.info("Application started successfully")
} catch (error) {
  logger.error(`Error starting application: ${error.message}`)
}
