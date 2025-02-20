const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const logger = require("../utils/logger")
const { getAllScholarships } = require("../services/supabaseService")

module.exports = {
  data: new SlashCommandBuilder().setName("scholarships").setDescription("Displays available scholarships"),

  async execute(interaction) {
    try {
      // Always defer the reply first
      await interaction.deferReply({ ephemeral: true })

      const scholarships = await getAllScholarships()

      if (!scholarships || scholarships.length === 0) {
        return await interaction.editReply({ content: "No scholarships found." })
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

      const message = await interaction.editReply({
        embeds: [initialEmbed],
        components: [initialButtons],
      })

      const collector = message.createMessageComponentCollector({ time: 60000 })

      collector.on("collect", async (i) => {
        // Verify that the button click came from the command user
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
        // Use try-catch to handle potential errors when removing buttons
        try {
          interaction.editReply({ components: [] }).catch((err) => logger.warn("Could not clear buttons:", err))
        } catch (error) {
          logger.warn("Could not clear buttons after timeout:", error)
        }
      })
    } catch (error) {
      logger.error(`Error executing scholarships command: ${error.message}`)

      // Only edit reply if we've already deferred
      if (interaction.deferred) {
        await interaction.editReply({ content: "There was an error retrieving scholarships." })
      }
    }
  },
}

