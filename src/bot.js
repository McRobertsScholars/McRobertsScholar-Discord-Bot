const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');
const config = require('./utils/config.js');
const logger = require('./utils/logger.js');
const { setupAI } = require('./ai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// Load commands including /ask
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

// Interaction handler for slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    // Only defer the reply if it has not been already deferred or replied to
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    // Execute the command
    await command.execute(interaction);

  } catch (error) {
    logger.error(`Error executing ${interaction.commandName} command: ${error.message}`);

    // If the interaction was already deferred or replied to, use followUp
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      // Otherwise, reply normally
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});




async function registerCommands() {
  const commands = [];
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.SERVER_ID),
      { body: commands },
    );

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error(error);
  }
}

console.log(setupAI);

// Move setupPersistentMessage inside the ready event
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  setupAI(client);
  const { setupPersistentMessage } = require('./persistentMessage.js');

  setupPersistentMessage(client);  // Call after client is ready
  registerCommands();
});

client.login(config.DISCORD_TOKEN);