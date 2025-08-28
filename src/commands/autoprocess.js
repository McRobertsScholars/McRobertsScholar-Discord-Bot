const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js")
const { getUnprocessedLinks, markLinksAsProcessed, processScholarshipData } = require("../services/linkService")
const { extractScholarshipInfo, fetchPageContent } = require("../services/freeAiService")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoprocess")
    .setDescription("Automatically process unprocessed links using free AI")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option.setName("limit").setDescription("Number of links to process (default: 5)").setMinValue(1).setMaxValue(20),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const limit = interaction.options.getInteger("limit") || 5

      // Get unprocessed links
      const linksResult = await getUnprocessedLinks()
      if (!linksResult.success || !linksResult.data.length) {
        return await interaction.editReply({ content: "No unprocessed links found." })
      }

      const linksToProcess = linksResult.data.slice(0, limit)
      const results = []
      const processedLinkIds = []
      const scholarshipsToAdd = []

      await interaction.editReply({ content: `🔄 Processing ${linksToProcess.length} links...` })

      for (const link of linksToProcess) {
        try {
          const contentResult = await fetchPageContent(link.url)
          if (!contentResult.success) {
            results.push({ url: link.url, status: "failed", reason: "content_fetch_failed" })
            continue
          }

          const extractResult = await extractScholarshipInfo(link.url, contentResult.content)
          if (!extractResult.success) {
            results.push({ url: link.url, status: "failed", reason: extractResult.reason })
            processedLinkIds.push(link.id) // Mark as processed even if failed
            continue
          }

          scholarshipsToAdd.push(extractResult.data)
          processedLinkIds.push(link.id)
          results.push({ url: link.url, status: "success", name: extractResult.data.name })

          await new Promise((resolve) => setTimeout(resolve, 2000))
        } catch (error) {
          logger.error(`Error processing link ${link.url}: ${error.message}`)
          results.push({ url: link.url, status: "error", reason: error.message })
        }
      }

      if (scholarshipsToAdd.length > 0) {
        const uploadResult = await processScholarshipData(scholarshipsToAdd)
        if (uploadResult.success) {
          logger.info(`Auto-processed ${scholarshipsToAdd.length} scholarships`)
        }
      }

      if (processedLinkIds.length > 0) {
        await markLinksAsProcessed(processedLinkIds)
      }

      // Create summary
      const successful = results.filter((r) => r.status === "success").length
      const failed = results.filter((r) => r.status === "failed").length

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Auto-Processing Results")
        .setDescription(`✅ Successfully processed: ${successful}\n❌ Failed: ${failed}`)

      if (successful > 0) {
        const successList = results
          .filter((r) => r.status === "success")
          .map((r) => `• ${r.name}`)
          .join("\n")

        embed.addFields({
          name: "Successfully Added Scholarships",
          value: successList.length > 1024 ? successList.substring(0, 1021) + "..." : successList,
        })
      }

      await interaction.editReply({ content: "", embeds: [embed] })
    } catch (error) {
      logger.error(`Error executing autoprocess command: ${error.message}`)
      await interaction.editReply({ content: "There was an error auto-processing the links." })
    }
  },
}
