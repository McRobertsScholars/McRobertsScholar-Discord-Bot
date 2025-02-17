const { startBot } = require('./bot.js');
const logger = require('./utils/logger.js');
const express = require('express');
const axios = require('axios');

startBot(); // ✅ Only called once

const app = express();
const PORT = process.env.PORT || 3000; // Render may provide a dynamic port, so it's safer to rely on process.env.PORT

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Keep-alive ping every 14 minutes
setInterval(() => {
  const WEBSITE_URL = process.env.RENDER_EXTERNAL_URL || "https://mcrobertsscholar-discord-bot.onrender.com"; // Use Render URL
  axios.get(WEBSITE_URL)
    .then(response => console.log('Ping successful:', response.status))
    .catch(error => console.error('Ping failed:', error.message));
}, 14 * 60 * 1000); // 14 minutes in milliseconds

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

try {
  logger.info('Bot started successfully');
} catch (error) {
  logger.error(`Error starting bot: ${error.message}`);
}
