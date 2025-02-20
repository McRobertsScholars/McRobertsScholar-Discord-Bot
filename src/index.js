const { startBot, client } = require("./bot.js")
const logger = require("./utils/logger.js")
const express = require("express")
const axios = require("axios")
const { setupDiscordService } = require("./services/discordService.js")
const { setupMistralService } = require("./services/mistralService.js")
const { testSupabaseConnection } = require("./services/supabaseService.js")

// Express server setup
const app = express()
const PORT = process.env.PORT || 10000

app.get("/", (req, res) => {
  res.send("Bot is running!")
})

// Start Express server first
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)

  // Then start the bot and services
  startBot()
  setupDiscordService()
  setupMistralService() // Changed from testMistralConnection to setupMistralService
  testSupabaseConnection()
})

// Keep-alive ping every 14 minutes
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

