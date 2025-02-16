const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../utils/config.js');
const logger = require('../utils/logger.js');
const { processScholarshipInfo } = require('./mistralService.js');
const { insertScholarship } = require('./supabaseService.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  logger.info(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.channelId === config.CHANNEL_ID && message.content.includes('http')) {
    try {
      const url = message.content.match(/(https?:\/\/[^\s]+)/g)[0];
      const scholarshipInfo = await processScholarshipInfo(url);
      await insertScholarship({ ...scholarshipInfo, link: url });
      logger.info(`Processed and inserted scholarship from URL: ${url}`);
    } catch (error) {
      logger.error(`Error processing message: ${error.message}`);
    }
  }
});

function startBot() {
  client.login(config.DISCORD_TOKEN);
}

module.exports = { startBot };