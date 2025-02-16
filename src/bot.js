const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');
const config = require('./utils/config.js');
const logger = require('./utils/logger.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing ${interaction.commandName} command: ${error.message}`);
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

function startBot() {
  client.login(config.DISCORD_TOKEN);
}

module.exports = { startBot };