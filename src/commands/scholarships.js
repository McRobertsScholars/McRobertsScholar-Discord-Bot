const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const { getAllScholarships } = require('../services/supabaseService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scholarships')
    .setDescription('Displays available scholarships'),

  async execute(interaction) {
    try {
      // Defer the reply immediately to avoid errors
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      const scholarships = await getAllScholarships();

      if (!scholarships || scholarships.length === 0) {
        return await interaction.editReply({ content: 'No scholarships found.' });
      }

      let currentIndex = 0;

      const createEmbed = (scholarship) => {
        return new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(scholarship.name)
          .addFields(
            { name: 'Deadline', value: scholarship.deadline || 'Not specified' },
            { name: 'Amount', value: scholarship.amount || 'Not specified' },
            { name: 'Description', value: scholarship.description || 'Not available' },
            { name: 'Requirements', value: scholarship.requirements || 'Not specified' }
          )
          .setURL(scholarship.link)
          .setFooter({ text: `Scholarship ${currentIndex + 1} of ${scholarships.length}` });
      };

      const createButtons = () => {
        return new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('previous')
              .setLabel('Previous')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentIndex === 0),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentIndex === scholarships.length - 1)
          );
      };

      const initialEmbed = createEmbed(scholarships[currentIndex]);
      const initialButtons = createButtons();

      const response = await interaction.editReply({
        embeds: [initialEmbed],
        components: [initialButtons]
      });

      const collector = response.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i) => {
        if (i.customId === 'previous') {
          currentIndex--;
        } else if (i.customId === 'next') {
          currentIndex++;
        }

        const newEmbed = createEmbed(scholarships[currentIndex]);
        const newButtons = createButtons();

        await i.update({
          embeds: [newEmbed],
          components: [newButtons]
        });
      });

      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(err => logger.warn("Could not clear buttons:", err));
      });

    } catch (error) {
      logger.error(`Error executing scholarships command: ${error.message}`);

      // Ensure we don't try to reply if it's already handled
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error retrieving scholarships.', ephemeral: true });
      } else {
        await interaction.editReply({ content: 'There was an error retrieving scholarships.' }).catch(err => logger.warn("Could not edit reply:", err));
      }
    }
  }
};
