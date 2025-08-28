const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js")
const config = require("../utils/config")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement to the meeting channel")
    .addStringOption((option) => option.setName("message").setDescription("The announcement message").setRequired(true))
    .addBooleanOption((option) =>
      option.setName("ping_everyone").setDescription("Whether to ping @everyone (default: false)").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const message = interaction.options.getString("message")
      const pingEveryone = interaction.options.getBoolean("ping_everyone") || false

      // Get the meeting announcement channel
      const channel = interaction.client.channels.cache.get(config.MEETING_CHANNEL_ID)

      if (!channel) {
        await interaction.editReply("❌ Meeting announcement channel not found!")
        return
      }

      // Format the announcement
      let announcement = `📢 **McRoberts Scholars Announcement**\n\n${message}`

      if (pingEveryone) {
        announcement = `@everyone\n\n${announcement}`
      }

      // Send the announcement
      await channel.send(announcement)

      await interaction.editReply(`✅ Announcement sent to ${channel.name}!`)
      logger.info(`Announcement sent by ${interaction.user.tag}: ${message}`)
    } catch (error) {
      logger.error("Error executing announce command:", error)

      try {
        await interaction.editReply("❌ There was an error sending the announcement. Please try again later.")
      } catch (replyError) {
        logger.error("Failed to send error message:", replyError)
      }
    }
  },
}
