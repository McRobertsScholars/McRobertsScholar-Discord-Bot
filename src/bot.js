const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js")
const path = require("path")
const fs = require("fs")
const config = require("./utils/config.js")
const logger = require("./utils/logger.js")
const { setupAI } = require("./ai")

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
})

// Load commands
client.commands = new Collection()
const commandsPath = path.join(__dirname, "commands")
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"))

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file)
  const command = require(filePath)
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command)
  } else {
    logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`)
  }
}

// Interaction handler for slash commands
client.on("interactionCreate", async (interaction) => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error executing this command!",
        ephemeral: true
      });
    }
  }

  // Handle button interactions
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("announce_")) {
      const announceCommand = client.commands.get("announce");
      if (announceCommand && announceCommand.handleButton) {
        await announceCommand.handleButton(interaction, client);
      }
    }
  }

  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("announce_modal_")) {
      const announceCommand = client.commands.get("announce");
      if (announceCommand && announceCommand.handleModal) {
        await announceCommand.handleModal(interaction, client);
      }
    }
  }
})

async function registerCommands() {
  const commands = []
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`)
    if (command.data && command.execute) {
      commands.push(command.data.toJSON())
    } else {
      logger.warn(`Command in file ${file} is missing data or execute.`)
    }
  }

  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN)

  try {
    logger.info("Started refreshing application (/) commands.")
    await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.SERVER_ID), { body: commands })
    logger.info("Successfully reloaded application (/) commands.")
  } catch (error) {
    logger.error(error)
  }
}

function startBot() {
  client.once("ready", () => {
    logger.info(`✅ Logged in as ${client.user.tag}`)
    setupAI(client)
    const { setupPersistentMessage } = require("./persistentMessage.js")
    setupPersistentMessage(client)
    registerCommands()

    const { scheduleAutomaticCleanup } = require("./services/linkService.js")
    scheduleAutomaticCleanup()
  })

  client
    .login(config.DISCORD_TOKEN)
    .then(() => logger.info("Bot successfully logged in"))
    .catch((error) => logger.error("Error logging in:", error))
}

module.exports = { startBot, client }
