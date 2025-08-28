const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js")
const googleSheetsService = require("../services/googleSheetsService")
const emailService = require("../services/emailService")
const config = require("../utils/config")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("emailannounce")
    .setDescription("Send announcement to both Discord and email")
    .addStringOption((option) => option.setName("subject").setDescription("Email subject line").setRequired(true))
    .addStringOption((option) => option.setName("message").setDescription("Announcement message").setRequired(true))
    .addBooleanOption((option) =>
      option
        .setName("ping_everyone")
        .setDescription("Whether to ping @everyone in Discord (default: false)")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const subject = interaction.options.getString("subject")
      const message = interaction.options.getString("message")
      const pingEveryone = interaction.options.getBoolean("ping_everyone") || false

      await interaction.editReply("📡 Sending announcement to Discord and email...")

      // Send Discord announcement
      const channel = interaction.client.channels.cache.get(config.MEETING_CHANNEL_ID)
      let discordSuccess = false

      if (channel) {
        try {
          let discordMessage = `📢 **McRoberts Scholars Announcement**\n\n${message}`
          if (pingEveryone) {
            discordMessage = `@everyone\n\n${discordMessage}`
          }
          await channel.send(discordMessage)
          discordSuccess = true
        } catch (error) {
          logger.error("Failed to send Discord announcement:", error)
        }
      }

      // Send email announcement
      let emailSuccess = false
      let emailResults = { results: [], errors: [] }

      try {
        const { members } = await googleSheetsService.getMemberEmails()

        if (members.length > 0) {
          const emailContent = `
Dear McRoberts Scholar,

${message}

Best regards,
McRoberts Scholars Program
          `.trim()

          emailResults = await emailService.sendBulkEmail(members, subject, emailContent)
          emailSuccess = emailResults.results.length > 0
        }
      } catch (error) {
        logger.error("Failed to send email announcement:", error)
      }

      // Report results
      let resultMessage = `📊 **Announcement Results**\n\n`

      if (discordSuccess) {
        resultMessage += `✅ Discord: Sent to ${channel.name}\n`
      } else {
        resultMessage += `❌ Discord: Failed to send\n`
      }

      if (emailSuccess) {
        resultMessage += `✅ Email: Sent to ${emailResults.results.length} members\n`
        if (emailResults.errors.length > 0) {
          resultMessage += `⚠️ Email: ${emailResults.errors.length} failed\n`
        }
      } else {
        resultMessage += `❌ Email: Failed to send\n`
      }

      await interaction.editReply(resultMessage)
      logger.info(`Combined announcement sent by ${interaction.user.tag}`)
    } catch (error) {
      logger.error("Error executing emailannounce command:", error)

      try {
        await interaction.editReply(`❌ Error sending announcement: ${error.message}`)
      } catch (replyError) {
        logger.error("Failed to send error message:", replyError)
      }
    }
  },
}
