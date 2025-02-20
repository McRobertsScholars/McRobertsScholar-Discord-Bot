const axios = require("axios")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")

// Setup function that includes the test
async function setupMistralService() {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-tiny",
        messages: [
          {
            role: "user",
            content: "Hello, are you working?",
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.MISTRAL_API_KEY}`,
        },
      },
    )
    logger.info("Mistral API test successful")
    logger.info(`Mistral response: ${response.data.choices[0].message.content}`)
  } catch (error) {
    logger.error(`Mistral API test failed: ${error.message}`)
  }
}

async function processScholarshipInfo(url) {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-tiny",
        messages: [
          {
            role: "system",
            content: `You are a precise scholarship information extractor. Extract ONLY explicitly stated information from the webpage.`,
          },
          {
            role: "user",
            content: `Extract scholarship information from ${url}. Return ONLY information that is explicitly stated on the page in this JSON format:
            {
              "name": "Full scholarship name",
              "deadline": "Complete deadline date",
              "amount": "Exact amount with $ sign",
              "description": "Brief description",
              "requirements": ["List of requirements"]
            }`,
          },
        ],
        temperature: 0.1,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.MISTRAL_API_KEY}`,
        },
      },
    )

    const result = JSON.parse(response.data.choices[0].message.content)
    logger.info(`Successfully extracted scholarship info: ${JSON.stringify(result)}`)
    return result
  } catch (error) {
    logger.error(`Error processing scholarship info: ${error.message}`)
    throw error
  }
}

module.exports = {
  setupMistralService,
  processScholarshipInfo,
}

