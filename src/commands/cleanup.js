const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js")
const { removeExpiredScholarships } = require("../services/linkService")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cleanup")
    .setDescription("Remove expired scholarships from the database")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Restrict to users with Manage Messages permission

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      // Remove expired scholarships
      const { success, message, count, removed } = await removeExpiredScholarships()

      if (!success) {
        return await interaction.editReply({ content: `Error removing expired scholarships: ${message}` })
      }

      if (count === 0) {
        return await interaction.editReply({ content: "No expired scholarships found." })
      }

      // Create a list of removed scholarships
      let removedList = ""
      if (removed && removed.length > 0) {
        removedList = removed.map((s) => `- ${s.name} (Deadline: ${s.deadline})`).join("\n")
      }

      // Create embed for the response
      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Expired Scholarships Removed")
        .setDescription(`Successfully removed ${count} expired scholarships.`)

      if (removedList) {
        embed.addFields({
          name: "Removed Scholarships",
          value: removedList.length > 1024 ? removedList.substring(0, 1021) + "..." : removedList,
        })
      }

      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      logger.error(`Error executing cleanup command: ${error.message}`)

      if (interaction.deferred) {
        await interaction.editReply({ content: "There was an error removing expired scholarships." })
      } else {
        await interaction.reply({
          content: "There was an error removing expired scholarships.",
          ephemeral: true,
        })
      }
    }
  },
}

