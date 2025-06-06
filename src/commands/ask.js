const { SlashCommandBuilder } = require("discord.js")
const { askGroq } = require("../ai") // Updated from askMistral

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
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply()
      }

      // Get the response from the Groq AI (updated from Mistral)
      const response = await askGroq(query)

      // Split long responses for Discord's character limit
      if (response.length > 2000) {
        // Send to DMs for long responses
        const user = interaction.user
        const chunks = response.match(/.{1,1900}/g) || [response]

        for (const chunk of chunks) {
          await user.send(chunk)
        }

        if (interaction.deferred) {
          await interaction.editReply("Response was too long, so I've sent it to your DMs!")
        } else {
          await interaction.reply("Response was too long, so I've sent it to your DMs!")
        }
      } else {
        // Send normal response
        if (interaction.deferred) {
          await interaction.editReply(response)
        } else {
          await interaction.reply(response)
        }
      }
    } catch (error) {
      console.error("Error executing ask command:", error)

      const errorMessage = "There was an error processing your request. Please try again later."

      if (interaction.deferred) {
        await interaction.editReply(errorMessage)
      } else if (!interaction.replied) {
        await interaction.reply({ content: errorMessage, ephemeral: true })
      } else {
        await interaction.followUp({ content: errorMessage, ephemeral: true })
      }
    }
  },
}
