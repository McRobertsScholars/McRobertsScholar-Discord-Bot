const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js")
const { searchKnowledgeBase } = require("../ai")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debug-kb")
    .setDescription("Debug knowledge base search functionality")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) => option.setName("query").setDescription("Search query to test").setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const query = interaction.options.getString("query")

      // Test knowledge base search
      const results = await searchKnowledgeBase(query, 10)

      if (!results || results.length === 0) {
        return await interaction.editReply({
          content: `❌ No knowledge base results found for: "${query}"`,
        })
      }

      // Format results for display
      const formattedResults = `🔍 **Knowledge Base Search Results for:** "${query}"

📊 **Found:** ${results.split("\n\n").length} chunks

📝 **Content Preview:**
${results.substring(0, 1500)}${results.length > 1500 ? "\n\n... (truncated)" : ""}`

      await interaction.editReply({
        content: formattedResults,
      })
    } catch (error) {
      logger.error(`Error in debug-kb command: ${error.message}`)
      await interaction.editReply({
        content: `❌ Error testing knowledge base: ${error.message}`,
      })
    }
  },
}
