const { client } = require("../bot.js")
const { processScholarshipInfo } = require("./mistralService.js")
const { insertScholarship } = require("./supabaseService.js")
const { getAllPageText } = require("./webScraper.js")
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
  let processingMsg = null

  try {
    processingMsg = await message.reply("🔍 Processing scholarship information... Please wait.")

    // Get the page content
    const pageContent = await getAllPageText(url)
    if (!pageContent) {
      throw new Error("No content found")
    }

    // Process with AI
    const scholarshipInfo = await processScholarshipInfo(url, pageContent)

    // Create embed
    const embed = {
      color: 0x0099ff,
      title: scholarshipInfo.name,
      url: url,
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
      ],
    }

    // Add requirements if they exist
    if (scholarshipInfo.requirements && scholarshipInfo.requirements.length > 0) {
      embed.fields.push({
        name: "📋 Requirements",
        value: Array.isArray(scholarshipInfo.requirements)
          ? scholarshipInfo.requirements.join("\n")
          : scholarshipInfo.requirements,
      })
    }

    // Update processing message with results
    await processingMsg.edit({
      content: "✅ Found scholarship information:",
      embeds: [embed],
    })

    // Store in database
    await insertScholarship({ ...scholarshipInfo, link: url })
  } catch (error) {
    logger.error(`Error processing URL ${url}: ${error.message}`)

    if (processingMsg) {
      await processingMsg.edit({
        content:
          "❌ Sorry, I couldn't process this scholarship. Please verify the URL is accessible and contains scholarship details.",
        embeds: [], // Clear any existing embeds
      })
    }
  }
})

function setupDiscordService() {
  logger.info("Discord service initialized")
}

module.exports = { setupDiscordService }

