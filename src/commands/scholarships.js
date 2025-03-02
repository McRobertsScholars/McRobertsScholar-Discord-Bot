const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const logger = require("../utils/logger")
const { searchScholarships } = require("../services/supabaseService")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("scholarships")
    .setDescription("Search or browse available scholarships")
    .addStringOption((option) =>
      option.setName("name").setDescription("Search scholarships by name").setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("Search scholarships by minimum amount (e.g., 1000 for $1000+)")
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const searchName = interaction.options.getString("name")
      const searchAmount = interaction.options.getString("amount")

      const { success, data: scholarships, message } = await searchScholarships(searchName, searchAmount)

      if (!success) {
        return await interaction.editReply({ content: `Error fetching scholarships: ${message}` })
      }

      if (!scholarships || scholarships.length === 0) {
        return await interaction.editReply({ content: "No scholarships found matching your criteria." })
      }

      let currentIndex = 0

      const createEmbed = (scholarship) => {
        return new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle(scholarship.name)
          .addFields(
            { name: "Deadline", value: scholarship.deadline || "Not specified" },
            { name: "Amount", value: scholarship.amount || "Not specified" },
            { name: "Description", value: scholarship.description || "Not available" },
            {
              name: "Requirements",
              value: Array.isArray(scholarship.requirements)
                ? scholarship.requirements.join("\n")
                : scholarship.requirements || "Not specified",
            },
          )
          .setURL(scholarship.link)
          .setFooter({ text: `Scholarship ${currentIndex + 1} of ${scholarships.length}` })
      }

      const createButtons = () => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("previous")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentIndex === 0),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Next")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentIndex === scholarships.length - 1),
        )
      }

      const initialEmbed = createEmbed(scholarships[currentIndex])
      const initialButtons = createButtons()

      const response = await interaction.editReply({
        content: `Found ${scholarships.length} scholarship(s)${searchName ? ` matching "${searchName}"` : ""}${searchAmount ? ` with minimum amount $${searchAmount}` : ""}:`,
        embeds: [initialEmbed],
        components: [initialButtons],
      })

      const collector = response.createMessageComponentCollector({ time: 60000 })

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: "This button is not for you!", ephemeral: true })
          return
        }

        if (i.customId === "previous") {
          currentIndex = Math.max(0, currentIndex - 1)
        } else if (i.customId === "next") {
          currentIndex = Math.min(scholarships.length - 1, currentIndex + 1)
        }

        const newEmbed = createEmbed(scholarships[currentIndex])
        const newButtons = createButtons()

        await i.update({
          embeds: [newEmbed],
          components: [newButtons],
        })
      })

      collector.on("end", () => {
        try {
          interaction.editReply({ components: [] }).catch((err) => logger.warn("Could not clear buttons:", err))
        } catch (error) {
          logger.warn("Could not clear buttons after timeout:", error)
        }
      })
    } catch (error) {
      logger.error(`Error executing scholarships command: ${error.message}`)

      if (interaction.deferred) {
        await interaction.editReply({ content: "There was an error retrieving scholarships." })
      }
    }
  },
}

