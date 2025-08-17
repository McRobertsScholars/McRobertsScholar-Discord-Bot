const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js")
const {
  discoverOnlineScholarships,
  toggleScholarshipSource,
  SCHOLARSHIP_SOURCES,
} = require("../services/scholarshipScraper")
const logger = require("../utils/logger")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("discover")
    .setDescription("Discover and add new scholarships from online sources")
    .addSubcommand((subcommand) =>
      subcommand.setName("run").setDescription("Run scholarship discovery from enabled sources"),
    )
    .addSubcommand((subcommand) => subcommand.setName("sources").setDescription("View available scholarship sources"))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("toggle")
        .setDescription("Enable or disable a scholarship source")
        .addStringOption((option) =>
          option
            .setName("source")
            .setDescription("The scholarship source to toggle")
            .setRequired(true)
            .addChoices(...SCHOLARSHIP_SOURCES.map((source) => ({ name: source.name, value: source.name }))),
        )
        .addBooleanOption((option) =>
          option.setName("enabled").setDescription("Enable or disable the source").setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const subcommand = interaction.options.getSubcommand()

      if (subcommand === "run") {
        const result = await discoverOnlineScholarships()

        if (!result.success) {
          return await interaction.editReply({
            content: `Error during scholarship discovery: ${result.error}`,
          })
        }

        const embed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("Online Scholarship Discovery Complete")
          .setDescription(`Found ${result.totalFound} scholarships, added ${result.totalAdded} new ones.`)

        if (result.results.length > 0) {
          const sourceResults = result.results
            .map((r) => `**${r.source}**: Found ${r.found}, Added ${r.added}${r.error ? ` (Error: ${r.error})` : ""}`)
            .join("\n")

          embed.addFields({
            name: "Source Results",
            value: sourceResults.length > 1024 ? sourceResults.substring(0, 1021) + "..." : sourceResults,
          })
        }

        await interaction.editReply({ embeds: [embed] })
      } else if (subcommand === "sources") {
        const embed = new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle("Scholarship Discovery Sources")
          .setDescription("Available sources for online scholarship discovery:")

        const sourceList = SCHOLARSHIP_SOURCES.map(
          (source) => `**${source.name}**: ${source.enabled ? "✅ Enabled" : "❌ Disabled"}`,
        ).join("\n")

        embed.addFields({
          name: "Sources",
          value: sourceList || "No sources configured",
        })

        await interaction.editReply({ embeds: [embed] })
      } else if (subcommand === "toggle") {
        const sourceName = interaction.options.getString("source")
        const enabled = interaction.options.getBoolean("enabled")

        const success = toggleScholarshipSource(sourceName, enabled)

        if (success) {
          await interaction.editReply({
            content: `✅ ${sourceName} has been ${enabled ? "enabled" : "disabled"} for scholarship discovery.`,
          })
        } else {
          await interaction.editReply({
            content: `❌ Could not find source: ${sourceName}`,
          })
        }
      }
    } catch (error) {
      logger.error(`Error executing discover command: ${error.message}`)

      if (interaction.deferred) {
        await interaction.editReply({ content: "There was an error with the scholarship discovery command." })
      } else {
        await interaction.reply({
          content: "There was an error with the scholarship discovery command.",
          ephemeral: true,
        })
      }
    }
  },
}
