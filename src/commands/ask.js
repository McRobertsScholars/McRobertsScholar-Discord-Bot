const { SlashCommandBuilder } = require("discord.js")
const { askGroq } = require("../ai")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask the AI for information about scholarships, resources, or other topics.")
    .addStringOption((option) =>
      option.setName("query").setDescription("Enter your question or query").setRequired(true),
    ),

  async execute(interaction) {
    const query = interaction.options.getString("query")

    try {
      // Immediately acknowledge the interaction
      await interaction.reply({
        content: "🤖 Processing your question... I'll send the response to your DMs!",
        ephemeral: true,
      })

      // Get the response from the Groq AI
      const response = await askGroq(query)

      // Send response to user's DMs
      const user = interaction.user

      try {
        // Split long responses for Discord's character limit
        if (response.length > 2000) {
          const chunks = response.match(/.{1,1900}/g) || [response]
          for (const chunk of chunks) {
            await user.send(chunk)
          }
        } else {
          await user.send(response)
        }

        // Update the original reply to confirm DM was sent
        await interaction.editReply("✅ Response sent to your DMs!")
      } catch (dmError) {
        console.error("Failed to send DM:", dmError)
        // If DM fails, edit the reply with the response
        if (response.length > 2000) {
          await interaction.editReply("❌ Couldn't send DM. Response too long - please enable DMs from server members.")
        } else {
          await interaction.editReply(`❌ Couldn't send DM. Here's your response:\n\n${response}`)
        }
      }
    } catch (error) {
      console.error("Error executing ask command:", error)

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply("❌ There was an error processing your request. Please try again later.")
        } else {
          await interaction.reply({
            content: "❌ There was an error processing your request. Please try again later.",
            ephemeral: true,
          })
        }
      } catch (replyError) {
        console.error("Failed to send error message:", replyError)
      }
    }
  },
}
