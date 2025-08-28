const { SlashCommandBuilder } = require("discord.js")
const cron = require("node-cron")
const { getUnprocessedLinks, markLinksAsProcessed } = require("../services/linkService")
const { extractScholarshipInfo, fetchPageContent } = require("../services/freeAiService")
const { insertScholarship } = require("../services/supabaseService")
const { discoverOnlineScholarships } = require("../services/scholarshipScraper")
const logger = require("../utils/logger")

// Store active schedules
const activeSchedules = new Map()

module.exports = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Schedule automatic scholarship discovery and processing")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("start")
        .setDescription("Start scheduled discovery and processing")
        .addStringOption((option) =>
          option
            .setName("frequency")
            .setDescription("How often to run")
            .setRequired(true)
            .addChoices(
              { name: "Every hour", value: "0 * * * *" },
              { name: "Every 6 hours", value: "0 */6 * * *" },
              { name: "Daily at 9 AM", value: "0 9 * * *" },
              { name: "Daily at 6 PM", value: "0 18 * * *" },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName("batch_size")
            .setDescription("Links to process per run (default: 10)")
            .setMinValue(1)
            .setMaxValue(50),
        )
        .addBooleanOption((option) =>
          option.setName("include_discovery").setDescription("Also discover new scholarships online (default: true)"),
        ),
    )
    .addSubcommand((subcommand) => subcommand.setName("stop").setDescription("Stop scheduled processing"))
    .addSubcommand((subcommand) => subcommand.setName("status").setDescription("Check schedule status")),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (subcommand === "start") {
      const frequency = interaction.options.getString("frequency")
      const batchSize = interaction.options.getInteger("batch_size") || 10
      const includeDiscovery = interaction.options.getBoolean("include_discovery") ?? true

      if (activeSchedules.has(guildId)) {
        activeSchedules.get(guildId).destroy()
      }

      const task = cron.schedule(
        frequency,
        async () => {
          try {
            logger.info(`Running scheduled scholarship automation for guild ${guildId}`)

            if (includeDiscovery) {
              logger.info("Running automatic scholarship discovery...")
              const discoveryResult = await discoverOnlineScholarships()
              if (discoveryResult.success) {
                logger.info(
                  `Discovery found ${discoveryResult.totalFound} links, added ${discoveryResult.totalAdded} new ones`,
                )
              }
            }

            const linksResult = await getUnprocessedLinks()
            if (!linksResult.success || linksResult.data.length === 0) {
              return
            }

            const linksToProcess = linksResult.data.slice(0, batchSize)
            let addedCount = 0
            const processedIds = []

            for (const link of linksToProcess) {
              try {
                const contentResult = await fetchPageContent(link.url)
                if (!contentResult.success) continue

                const extractResult = await extractScholarshipInfo(link.url, contentResult.content)
                if (!extractResult.success) {
                  processedIds.push(link.id)
                  continue
                }

                const insertResult = await insertScholarship(extractResult.data)
                if (insertResult.success) {
                  addedCount++
                }

                processedIds.push(link.id)
                await new Promise((resolve) => setTimeout(resolve, 2000))
              } catch (error) {
                logger.error(`Scheduled processing error for ${link.url}: ${error.message}`)
              }
            }

            if (processedIds.length > 0) {
              await markLinksAsProcessed(processedIds)
            }

            if (addedCount > 0) {
              logger.info(`Scheduled processing added ${addedCount} scholarships`)
            }
          } catch (error) {
            logger.error(`Scheduled task error: ${error.message}`)
          }
        },
        { scheduled: false },
      )

      task.start()
      activeSchedules.set(guildId, task)

      const discoveryText = includeDiscovery ? " with automatic discovery" : ""
      await interaction.reply(
        `✅ Scheduled automation started${discoveryText}! Will process up to ${batchSize} links ${getFrequencyDescription(frequency)}.`,
      )
    } else if (subcommand === "stop") {
      if (activeSchedules.has(guildId)) {
        activeSchedules.get(guildId).destroy()
        activeSchedules.delete(guildId)
        await interaction.reply("✅ Scheduled processing stopped.")
      } else {
        await interaction.reply("❌ No active schedule found.")
      }
    } else if (subcommand === "status") {
      if (activeSchedules.has(guildId)) {
        await interaction.reply("✅ Scheduled processing is **active**.")
      } else {
        await interaction.reply("❌ No scheduled processing is currently running.")
      }
    }
  },
}

function getFrequencyDescription(cron) {
  const descriptions = {
    "0 * * * *": "every hour",
    "0 */6 * * *": "every 6 hours",
    "0 9 * * *": "daily at 9 AM",
    "0 18 * * *": "daily at 6 PM",
  }
  return descriptions[cron] || "at the specified interval"
}
