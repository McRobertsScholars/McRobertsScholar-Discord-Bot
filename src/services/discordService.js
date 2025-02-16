const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../utils/config.js');
const logger = require('../utils/logger.js');
const { processScholarshipInfo } = require('./mistralService.js');
const { insertScholarship } = require('./supabaseService.js');

// ❌ REMOVE this to avoid conflict
// const { startBot } = require('./bot.js'); 

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  logger.info(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  logger.info(`📩 Received message: ${message.content}`);

  if (message.channelId === config.CHANNEL_ID && message.content.includes('http')) {
    try {
      logger.info(`🔗 Detected scholarship link: ${message.content}`);
      const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/g);

      if (!urlMatch) {
        logger.warn(`⚠️ No valid URL found in message.`);
        return;
      }

      const url = urlMatch[0];
      logger.info(`⏳ Calling Mistral API for URL: ${url}`);

      const scholarshipInfo = await processScholarshipInfo(url);
      logger.info(`📄 Scholarship data to insert: ${JSON.stringify(scholarshipInfo)}`);

      await insertScholarship({ ...scholarshipInfo, link: url });
      logger.info(`✅ Successfully processed and inserted scholarship from URL: ${url}`);
    } catch (error) {
      logger.error(`❌ Error processing message: ${error.message}`);
    }
  }
});

// ✅ Use this as the only bot startup function
function startBot() {
  client.login(config.DISCORD_TOKEN);
}

startBot(); // 🚀 Start the bot

module.exports = { startBot };
