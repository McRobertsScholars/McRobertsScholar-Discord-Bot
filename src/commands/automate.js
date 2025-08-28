const { SlashCommandBuilder } = require("discord.js")
const { getUnprocessedLinks, markLinksAsProcessed } = require("../services/linkService")
const { extractScholarshipInfo, fetchPageContent } = require("../services/freeAiService")
const { insertScholarship } = require("../services/supabaseService")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automate")
    .setDescription("Automatically process unprocessed scholarship links with AI")
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of links to process (default: 5, max: 20)")
        .setMinValue(1)
        .setMaxValue(20),
    ),

  async execute(interaction) {
    await interaction.deferReply()

    try {
      const limit = interaction.options.getInteger("limit") || 5

      // Get unprocessed links
      const linksResult = await getUnprocessedLinks()
      if (!linksResult.success) {
        return await interaction.editReply(`❌ Error getting links: ${linksResult.message}`)
      }

      const linksToProcess = linksResult.data.slice(0, limit)
      if (linksToProcess.length === 0) {
        return await interaction.editReply("✅ No unprocessed links found!")
      }

      await interaction.editReply(`🔄 Processing ${linksToProcess.length} scholarship links with AI...`)

      const results = {
        processed: 0,
        added: 0,
        skipped: 0,
        errors: 0,
      }

      const processedLinkIds = []

      for (const link of linksToProcess) {
        try {
          // Fetch page content
          const contentResult = await fetchPageContent(link.url)
          if (!contentResult.success) {
            logger.warn(`Failed to fetch content for ${link.url}: ${contentResult.error}`)
            results.errors++
            continue
          }

          // Extract scholarship info with AI
          const extractResult = await extractScholarshipInfo(link.url, contentResult.content)
          if (!extractResult.success) {
            if (extractResult.reason === "not_scholarship") {
              logger.info(`Skipped non-scholarship link: ${link.url}`)
              results.skipped++
            } else {
              logger.warn(`Failed to extract info from ${link.url}: ${extractResult.error}`)
              results.errors++
            }
            processedLinkIds.push(link.id) // Mark as processed even if failed
            continue
          }

          // Insert scholarship into database
          const insertResult = await insertScholarship(extractResult.data)
          if (insertResult.success) {
            logger.info(`Added scholarship: ${extractResult.data.name}`)
            results.added++
          } else {
            logger.warn(`Failed to insert scholarship: ${insertResult.message}`)
            results.errors++
          }

          processedLinkIds.push(link.id)
          results.processed++

          // Small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
          logger.error(`Error processing link ${link.url}: ${error.message}`)
          results.errors++
        }
      }

      // Mark all processed links as processed
      if (processedLinkIds.length > 0) {
        await markLinksAsProcessed(processedLinkIds)
      }

      const summary = [
        `✅ **Automation Complete!**`,
        `📊 **Results:**`,
        `• Processed: ${results.processed}`,
        `• Added to database: ${results.added}`,
        `• Skipped (not scholarships): ${results.skipped}`,
        `• Errors: ${results.errors}`,
      ].join("\n")

      await interaction.editReply(summary)
    } catch (error) {
      logger.error(`Automation command error: ${error.message}`)
      await interaction.editReply(`❌ Error during automation: ${error.message}`)
    }
  },
}
