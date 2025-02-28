const { client } = require("../bot.js")
const { storeLink } = require("./linkService.js")
const logger = require("../utils/logger.js")
const config = require("../utils/config.js")

// Track processed messages to prevent duplicates
const processedMessages = new Set()

client.on("messageCreate", async (message) => {
  // Ignore if not in target channel or is from a bot
  if (message.channelId !== config.CHANNEL_ID || message.author.bot) return

  // Extract URLs from message
  const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/g)
  if (!urlMatch) return

  // Check if we've already processed this message
  if (processedMessages.has(message.id)) return
  processedMessages.add(message.id)

  // Clean up old processed messages (after 5 minutes)
  setTimeout(() => processedMessages.delete(message.id), 5 * 60 * 1000)

  const url = urlMatch[0]
  let responseMsg = null

  try {
    responseMsg = await message.reply("🔗 Processing scholarship link... Please wait.")

    // Store the link in the database
    const result = await storeLink(url, message.id, message.author.id)

    if (result.success) {
      await responseMsg.edit("✅ Scholarship link stored successfully! An executive will process it later.")
    } else if (result.message === "Link already exists in database") {
      await responseMsg.edit("ℹ️ This scholarship link is already in our database. Thank you for sharing!")
    } else {
      await responseMsg.edit(`⚠️ ${result.message}`)
    }
  } catch (error) {
    logger.error(`Error processing URL ${url}: ${error.message}`)

    if (responseMsg) {
      await responseMsg.edit({
        content: "❌ Sorry, I couldn't process this link. Please try again later.",
      })
    }
  }
})

function setupDiscordService() {
  logger.info("Discord service initialized")
}

module.exports = { setupDiscordService }

