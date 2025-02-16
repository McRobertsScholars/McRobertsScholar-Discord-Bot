const { startBot } = require('./bot.js');
const { startBot: startDiscordService } = require('./services/discordService.js');
const logger = require('./utils/logger.js');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;
const WEBSITE_URL = "https://mcrobertsscholar-discord-bot.onrender.com"; // Replace with your actual Render URL

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

// Keep-alive ping every 14 minutes
setInterval(() => {
    axios.get(WEBSITE_URL)
        .then(response => console.log('Ping successful:', response.status))
        .catch(error => console.error('Ping failed:', error.message));
}, 14 * 60 * 1000); // 14 minutes in milliseconds

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));


try {
  startBot();
  startDiscordService();
  logger.info('Bot started successfully');
} catch (error) {
  logger.error(`Error starting bot: ${error.message}`);
}