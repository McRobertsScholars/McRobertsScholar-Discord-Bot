const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js")
const { getUnprocessedLinks, markLinksAsProcessed, processScholarshipData } = require("../services/linkService")
const { extractScholarshipInfo, fetchPageContent } = require("../services/freeAiService")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("batch")
    .setDescription("Batch process multiple unprocessed links with progress updates")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option.setName("count").setDescription("Number of links to process (default: 10)").setMinValue(1).setMaxValue(50),
    )
    .addBooleanOption((option) =>
      option.setName("dryrun").setDescription("Preview what would be processed without actually processing"),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const count = interaction.options.getInteger("count") || 10
      const dryRun = interaction.options.getBoolean("dryrun") || false

      // Get unprocessed links
      const linksResult = await getUnprocessedLinks()
      if (!linksResult.success || !linksResult.data.length) {
        return await interaction.editReply({ content: "No unprocessed links found." })
      }

      const linksToProcess = linksResult.data.slice(0, count)

      if (dryRun) {
        const preview = linksToProcess.map((link, index) => `${index + 1}. ${link.url.substring(0, 80)}...`).join("\n")

        const embed = new EmbedBuilder()
          .setColor("#ffa500")
          .setTitle("Batch Processing Preview")
          .setDescription(`Would process ${linksToProcess.length} links:`)
          .addFields({
            name: "Links to Process",
            value: preview.length > 1024 ? preview.substring(0, 1021) + "..." : preview,
          })

        return await interaction.editReply({ embeds: [embed] })
      }

      const results = {
        successful: [],
        failed: [],
        notScholarships: [],
      }

      let processed = 0
      const total = linksToProcess.length

      for (const link of linksToProcess) {
        processed++

        // Update progress every 5 links
        if (processed % 5 === 0 || processed === total) {
          await interaction.editReply({
            content: `🔄 Processing... ${processed}/${total} links completed`,
          })
        }

        try {
          // Fetch content
          const contentResult = await fetchPageContent(link.url)
          if (!contentResult.success) {
            results.failed.push({ url: link.url, reason: "Failed to fetch content" })
            continue
          }

          // Extract scholarship info
          const extractResult = await extractScholarshipInfo(link.url, contentResult.content)
          if (!extractResult.success) {
            if (extractResult.reason === "not_scholarship") {
              results.notScholarships.push({ url: link.url })
            } else {
              results.failed.push({ url: link.url, reason: extractResult.reason })
            }
            continue
          }

          results.successful.push({
            url: link.url,
            name: extractResult.data.name,
            data: extractResult.data,
          })

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1500))
        } catch (error) {
          logger.error(`Error processing ${link.url}: ${error.message}`)
          results.failed.push({ url: link.url, reason: error.message })
        }
      }

      if (results.successful.length > 0) {
        const scholarshipData = results.successful.map((r) => r.data)
        const uploadResult = await processScholarshipData(scholarshipData)

        if (uploadResult.success) {
          // Mark processed links
          const processedIds = linksToProcess.map((link) => link.id)
          await markLinksAsProcessed(processedIds)
        }
      }

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Batch Processing Complete")
        .setDescription(`Processed ${total} links`)
        .addFields(
          {
            name: "✅ Successfully Added",
            value:
              results.successful.length > 0
                ? results.successful
                    .map((r) => `• ${r.name}`)
                    .slice(0, 10)
                    .join("\n")
                : "None",
            inline: true,
          },
          {
            name: "❌ Failed",
            value: results.failed.length > 0 ? `${results.failed.length} links failed` : "None",
            inline: true,
          },
          {
            name: "🚫 Not Scholarships",
            value: results.notScholarships.length > 0 ? `${results.notScholarships.length} links filtered out` : "None",
            inline: true,
          },
        )

      await interaction.editReply({ content: "", embeds: [embed] })
    } catch (error) {
      logger.error(`Error executing batch command: ${error.message}`)
      await interaction.editReply({ content: "There was an error during batch processing." })
    }
  },
}
