const { client } = require("../bot.js")
const { processScholarshipInfo } = require("./mistralService.js")
const { insertScholarship } = require("./supabaseService.js")
const logger = require("../utils/logger.js")
const config = require("../utils/config.js")

client.on("messageCreate", async (message) => {
  if (message.channelId === config.CHANNEL_ID && message.content.includes("http")) {
    let processingMsg = null
    try {
      const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/g)
      if (!urlMatch) {
        await message.reply("Please provide a valid scholarship URL.")
        return
      }

      const url = urlMatch[0]
      processingMsg = await message.reply("🔍 Processing scholarship information... Please wait.")

      const scholarshipInfo = await processScholarshipInfo(url)

      // Format requirements for display
      const requirementsList = Array.isArray(scholarshipInfo.requirements)
        ? scholarshipInfo.requirements.map((r) => `• ${r}`).join("\n")
        : "Not specified"

      // Create preview message
      const previewEmbed = {
        color: 0x0099ff,
        title: scholarshipInfo.name,
        description: scholarshipInfo.description,
        fields: [
          {
            name: "💰 Amount",
            value: scholarshipInfo.amount || "Not specified",
            inline: true,
          },
          {
            name: "📅 Deadline",
            value: scholarshipInfo.deadline || "Not specified",
            inline: true,
          },
          {
            name: "📋 Requirements",
            value: requirementsList,
          },
        ],
        footer: {
          text: "Scholarship information extracted automatically",
        },
      }

      // Edit the processing message
      await processingMsg.edit({
        content: "Found scholarship information:",
        embeds: [previewEmbed],
      })

      await insertScholarship({ ...scholarshipInfo, link: url })

      // Send confirmation as a follow-up message
      await message.reply("✅ Scholarship has been added to the database!")
    } catch (error) {
      logger.error(`Error processing message: ${error.message}`)

      const errorMessage = error.message.includes("403")
        ? "❌ Sorry, this website is blocking automated access. Please try a different URL or contact an administrator."
        : "❌ Sorry, I couldn't process this scholarship. Please verify the URL is accessible and contains scholarship details."

      if (processingMsg) {
        await processingMsg.edit(errorMessage)
      } else {
        await message.reply(errorMessage)
      }
    }
  }
})

module.exports = { setupDiscordService: () => {} }

