const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js")
const { getUnprocessedLinks, markLinksAsProcessed } = require("../services/linkService")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("links")
    .setDescription("Get the list of unprocessed scholarship links")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // Restrict to users with Manage Messages permission
    .addBooleanOption((option) =>
      option
        .setName("mark_processed")
        .setDescription("Mark all links as processed after retrieving them")
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const markProcessed = interaction.options.getBoolean("mark_processed") || false

      // Get unprocessed links
      const { success, data: links, message } = await getUnprocessedLinks()

      if (!success) {
        return await interaction.editReply({ content: `Error fetching links: ${message}` })
      }

      if (!links || links.length === 0) {
        return await interaction.editReply({ content: "No unprocessed links found." })
      }

      // Create a formatted list of links
      const linkList = links.map((link, index) => `${index + 1}. ${link.url}`).join("\n")

      // Create instructions for manual processing
      const instructions = `
**Instructions:**
1. Copy these links and send them to ChatGPT with the following prompt:
2. "Please extract scholarship information from these links in JSON format with fields: name, deadline, amount, description, requirements, and link."
3. Once you get the response, use the \`/upload\` command to add the scholarships to the database.
      `

      // Create embed for the response
      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Unprocessed Scholarship Links")
        .setDescription(`Found ${links.length} unprocessed links:`)
        .addFields(
          { name: "Links", value: linkList.length > 1024 ? linkList.substring(0, 1021) + "..." : linkList },
          { name: "What to do next", value: instructions },
        )
        .setFooter({ text: `Total: ${links.length} links` })

      await interaction.editReply({ embeds: [embed] })

      // If requested, mark links as processed
      if (markProcessed && links.length > 0) {
        const linkIds = links.map((link) => link.id)
        const markResult = await markLinksAsProcessed(linkIds)

        if (markResult.success) {
          await interaction.followUp({
            content: `✅ Marked ${links.length} links as processed.`,
            ephemeral: true,
          })
        } else {
          await interaction.followUp({
            content: `❌ Error marking links as processed: ${markResult.message}`,
            ephemeral: true,
          })
        }
      }
    } catch (error) {
      logger.error(`Error executing links command: ${error.message}`)

      if (interaction.deferred) {
        await interaction.editReply({ content: "There was an error retrieving links." })
      } else {
        await interaction.reply({
          content: "There was an error retrieving links.",
          ephemeral: true,
        })
      }
    }
  },
}

