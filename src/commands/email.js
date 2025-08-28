const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js")
const googleSheetsService = require("../services/googleSheetsService")
const emailService = require("../services/emailService")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("email")
    .setDescription("Send an email to all members from the Google Sheets")
    .addStringOption((option) => option.setName("subject").setDescription("Email subject line").setRequired(true))
    .addStringOption((option) => option.setName("message").setDescription("Email message content").setRequired(true))
    .addBooleanOption((option) =>
      option
        .setName("preview")
        .setDescription("Preview the email list without sending (default: false)")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const subject = interaction.options.getString("subject")
      const message = interaction.options.getString("message")
      const preview = interaction.options.getBoolean("preview") || false

      // Get member emails from Google Sheets
      const { members, sheetName } = await googleSheetsService.getMemberEmails()

      if (members.length === 0) {
        await interaction.editReply("❌ No members with valid emails found in the spreadsheet!")
        return
      }

      if (preview) {
        // Show preview of recipients
        const memberList = members
          .slice(0, 10)
          .map((m) => `• ${m.name} (${m.email})`)
          .join("\n")
        const moreText = members.length > 10 ? `\n... and ${members.length - 10} more` : ""

        await interaction.editReply(
          `📋 **Email Preview**\n\n` +
            `**Sheet:** ${sheetName}\n` +
            `**Recipients:** ${members.length} members\n` +
            `**Subject:** ${subject}\n\n` +
            `**First 10 recipients:**\n${memberList}${moreText}\n\n` +
            `Use the command again without \`preview: true\` to send the email.`,
        )
        return
      }

      // Send the email
      await interaction.editReply(`📧 Sending emails to ${members.length} members... This may take a while.`)

      const emailContent = `
Dear McRoberts Scholar,

${message}

Best regards,
McRoberts Scholars Program
      `.trim()

      const { results, errors } = await emailService.sendBulkEmail(members, subject, emailContent)

      // Report results
      let resultMessage = `✅ **Email Campaign Complete**\n\n`
      resultMessage += `**Sheet Used:** ${sheetName}\n`
      resultMessage += `**Successfully sent:** ${results.length} emails\n`

      if (errors.length > 0) {
        resultMessage += `**Failed:** ${errors.length} emails\n\n`
        resultMessage += `**Failed recipients:**\n`
        resultMessage += errors
          .slice(0, 5)
          .map((e) => `• ${e.email}: ${e.error}`)
          .join("\n")
        if (errors.length > 5) {
          resultMessage += `\n... and ${errors.length - 5} more errors`
        }
      }

      await interaction.editReply(resultMessage)
      logger.info(
        `Email campaign completed by ${interaction.user.tag}: ${results.length} sent, ${errors.length} failed`,
      )
    } catch (error) {
      logger.error("Error executing email command:", error)

      try {
        await interaction.editReply(`❌ Error sending emails: ${error.message}`)
      } catch (replyError) {
        logger.error("Failed to send error message:", replyError)
      }
    }
  },
}
