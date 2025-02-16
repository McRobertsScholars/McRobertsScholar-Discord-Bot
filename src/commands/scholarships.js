const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAllScholarships } = require('../services/supabaseService.js');
const logger = require('../utils/logger.js');

const data = new SlashCommandBuilder()
  .setName('scholarships')
  .setDescription('Display all scholarships');

async function execute(interaction) {
  try {
    const scholarships = await getAllScholarships();
    if (scholarships.length === 0) {
      await interaction.reply('No scholarships found.');
      return;
    }

    let currentIndex = 0;

    const createEmbed = (scholarship) => {
      return new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(scholarship.name) // Use 'name' instead of 'title'
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

    const response = await interaction.reply({
      embeds: [initialEmbed],
      components: [initialButtons],
      fetchReply: true
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
      interaction.editReply({ components: [] });
    });

    logger.info(`Displayed scholarships for user ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Error executing scholarships command: ${error.message}`);
    await interaction.reply('An error occurred while fetching scholarships.');
  }
}

module.exports = { data, execute };
