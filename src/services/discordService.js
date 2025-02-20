const { client } = require("../bot.js")
const { processScholarshipInfo, validateScholarshipInfo } = require("./mistralService.js")
const { insertScholarship } = require("./supabaseService.js")
const logger = require("../utils/logger.js")
const config = require("../utils/config.js")

client.on("messageCreate", async (message) => {
  logger.info(`📩 Received message: ${message.content} in channel: ${message.channelId}`)

  if (message.channelId === config.CHANNEL_ID) {
    logger.info(`✅ Message is in the correct channel (${config.CHANNEL_ID})`)

    if (message.content.includes("http")) {
      try {
        logger.info(`🔗 Detected scholarship link: ${message.content}`)
        const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/g)

        if (!urlMatch) {
          logger.warn(`⚠️ No valid URL found in message.`)
          return
        }

        const url = urlMatch[0]
        logger.info(`⏳ Calling Mistral API for URL: ${url}`)

        const scholarshipInfo = await processScholarshipInfo(url)
        logger.info(`📄 Scholarship data extracted: ${JSON.stringify(scholarshipInfo)}`)

        if (validateScholarshipInfo(scholarshipInfo)) {
          await insertScholarship({ ...scholarshipInfo, link: url })
          logger.info(`✅ Successfully processed and inserted scholarship from URL: ${url}`)
          message.reply("Scholarship information has been successfully added to the database.")
        } else {
          logger.warn(`❌ Invalid scholarship data extracted from URL: ${url}`)
          message.reply(
            "Unable to extract valid scholarship information from the provided link. Please check the URL and try again, or manually enter the scholarship details.",
          )
        }
      } catch (error) {
        logger.error(`❌ Error processing message: ${error.message}`)
        message.reply(
          "An error occurred while processing the scholarship information. Please try again later or contact an administrator.",
        )
      }
    } else {
      logger.info(`ℹ️ Message does not contain a URL`)
    }
  } else {
    logger.info(`ℹ️ Message is not in the target channel (expected ${config.CHANNEL_ID}, got ${message.channelId})`)
  }
})

module.exports = { setupDiscordService: () => {} } // Export a dummy function to initialize the service

