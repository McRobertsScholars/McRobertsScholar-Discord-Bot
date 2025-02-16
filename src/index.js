const { startBot } = require('./bot.js');
const { startBot: startDiscordService } = require('./services/discordService.js');
const logger = require('./utils/logger.js');

try {
  startBot();
  startDiscordService();
  logger.info('Bot started successfully');
} catch (error) {
  logger.error(`Error starting bot: ${error.message}`);
}