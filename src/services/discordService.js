const { client } = require("../bot.js")
const { processScholarshipInfo } = require("./mistralService.js")
const { insertScholarship } = require("./supabaseService.js")
const logger = require("../utils/logger.js")
const config = require("../utils/config.js")

client.on("messageCreate", async (message) => {
  if (message.channelId === config.CHANNEL_ID) {
    if (message.content.includes("http")) {
      try {
        const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/g)
        if (!urlMatch) {
          await message.reply("Please provide a valid scholarship URL.")
          return
        }

        const url = urlMatch[0]
        await message.reply("Processing scholarship information... Please wait.")

        const scholarshipInfo = await processScholarshipInfo(url)

        // Create a preview message
        const previewMessage = `
Found scholarship information:
• Name: ${scholarshipInfo.name}
• Amount: ${scholarshipInfo.amount}
• Deadline: ${scholarshipInfo.deadline}
• Description: ${scholarshipInfo.description}
• Requirements: ${scholarshipInfo.requirements.join(", ")}

Adding to database...`

        await message.reply(previewMessage)

        await insertScholarship({ ...scholarshipInfo, link: url })
        await message.reply("✅ Scholarship information has been successfully added to the database!")
      } catch (error) {
        logger.error(`Error processing message: ${error.message}`)
        await message.reply(
          "Sorry, I couldn't extract the scholarship information. Please make sure the URL is accessible and contains scholarship details.",
        )
      }
    }
  }
})

module.exports = { setupDiscordService: () => {} }

