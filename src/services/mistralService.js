const axios = require('axios');
const config = require('../utils/config.js');
const logger = require('../utils/logger.js');

async function processScholarshipInfo(url) {
  try {
    const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
      model: "mistral-tiny",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts scholarship information from web pages."
        },
        {
          role: "user",
          content: `Please extract the following information from this scholarship page: ${url}
          - name
          - deadline  
          - amount
          - description
          - requirements
          Format the response as a JSON object with these fields. `
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.MISTRAL_API_KEY}`
      }
    });

    logger.info(`Processed scholarship info for URL: ${url}`);
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    logger.error(`Error processing scholarship info: ${error.message}`);
    throw error;
  }
}

module.exports = { processScholarshipInfo };