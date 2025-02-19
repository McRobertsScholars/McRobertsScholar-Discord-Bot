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

client.on("messageCreate", (message) => {
  console.log(`Received message: ${message.content} in channel: ${message.channelId}`)
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
  if (!interaction.isChatInputCommand()) return

  const command = client.commands.get(interaction.commandName)

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`)
    return
  }

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply()
    }
    await command.execute(interaction)
  } catch (error) {
    logger.error(`Error executing ${interaction.commandName} command: ${error.message}`)

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true })
    } else {
      await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true })
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
  })

  client
    .login(config.DISCORD_TOKEN)
    .then(() => logger.info("Bot successfully logged in"))
    .catch((error) => logger.error("Error logging in:", error))
}

module.exports = { startBot, client }

