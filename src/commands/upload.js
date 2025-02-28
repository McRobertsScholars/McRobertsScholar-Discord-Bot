const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js")
const { processScholarshipData } = require("../services/linkService")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("upload")
    .setDescription("Upload processed scholarship data to the database")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // Restrict to users with Manage Messages permission
    .addStringOption((option) =>
      option.setName("data").setDescription("The JSON data from ChatGPT (paste the entire response)").setRequired(true),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const jsonData = interaction.options.getString("data")

      if (!jsonData) {
        return await interaction.editReply({ content: "Please provide the JSON data from ChatGPT." })
      }

      // Process the scholarship data
      const { success, results, message } = await processScholarshipData(jsonData)

      if (!success) {
        return await interaction.editReply({ content: `Error processing data: ${message}` })
      }

      // Count the results by status
      const added = results.filter((r) => r.status === "added").length
      const skipped = results.filter((r) => r.status === "skipped").length
      const errors = results.filter((r) => r.status === "error").length

      // Create a summary of the results
      const summary = `
📊 **Upload Summary**
✅ Added: ${added}
⏭️ Skipped (duplicates): ${skipped}
❌ Errors: ${errors}
      `

      // Create detailed results for each scholarship
      let detailedResults = ""
      if (results.length > 0) {
        detailedResults = results
          .map((r) => {
            if (r.status === "added") {
              return `✅ Added: ${r.name}`
            } else if (r.status === "skipped") {
              return `⏭️ Skipped: ${r.name} (${r.reason})`
            } else {
              return `❌ Error: ${r.name} (${r.reason})`
            }
          })
          .join("\n")
      }

      // Create embed for the response
      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Scholarship Upload Results")
        .setDescription(summary)

      if (detailedResults) {
        embed.addFields({
          name: "Detailed Results",
          value: detailedResults.length > 1024 ? detailedResults.substring(0, 1021) + "..." : detailedResults,
        })
      }

      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      logger.error(`Error executing upload command: ${error.message}`)

      if (interaction.deferred) {
        await interaction.editReply({ content: "There was an error uploading the scholarship data." })
      } else {
        await interaction.reply({
          content: "There was an error uploading the scholarship data.",
          ephemeral: true,
        })
      }
    }
  },
}

