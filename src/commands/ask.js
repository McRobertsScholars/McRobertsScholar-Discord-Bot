const { SlashCommandBuilder } = require('discord.js');
const { askMistral } = require('../ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the AI for information about scholarships, resources, or other topics.')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Enter your question or query')
        .setRequired(true)),

  async execute(interaction) {
    const query = interaction.options.getString('query');

    try {
      // If the interaction hasn't been deferred or replied to yet, defer the reply
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      // Get the response from the Mistral AI
      const response = await askMistral(query);

      // Send the response to the user's DM
      const user = interaction.user;
      await user.send(response);

      // Inform the user that the AI response was sent to their DMs
      if (interaction.deferred) {
        await interaction.editReply('I\'ve sent the response to your DMs!');
      } else {
        await interaction.reply('I\'ve sent the response to your DMs!');
      }
    } catch (error) {
      console.error('Error executing ask command:', error);
      await interaction.followUp({ content: 'There was an error processing your request.', ephemeral: true });
    }
  }
};
