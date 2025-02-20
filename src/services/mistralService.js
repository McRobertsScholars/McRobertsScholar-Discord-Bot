const axios = require("axios")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")

async function processScholarshipInfo(url) {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-tiny",
        messages: [
          {
            role: "system",
            content:
              "You are a precise assistant that extracts scholarship information from web pages. Only extract information that is explicitly stated on the page. If information is not found or unclear, use 'Not specified' as the value.",
          },
          {
            role: "user",
            content: `Please extract the following information from this scholarship page: ${url}
            - name: The full name of the scholarship
            - deadline: The exact deadline date in YYYY-MM-DD format. If not found, use 'Not specified'
            - amount: The exact amount of the scholarship. If a range, provide the full range
            - description: A brief description of the scholarship
            - requirements: A list of key requirements for applicants
            Format the response as a JSON object with these fields. Do not invent or assume any information not explicitly stated on the page.`,
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

    logger.info(`Processed scholarship info for URL: ${url}`)
    return JSON.parse(response.data.choices[0].message.content)
  } catch (error) {
    logger.error(`Error processing scholarship info: ${error.message}`)
    throw error
  }
}

async function testMistralConnection() {
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

function validateScholarshipInfo(info) {
  const requiredFields = ["name", "deadline", "amount", "description", "requirements"]
  for (const field of requiredFields) {
    if (!info[field] || info[field] === "Not specified") {
      logger.warn(`Missing or unspecified ${field} for scholarship`)
      return false
    }
  }

  // Additional checks can be added here, e.g., date format validation for deadline

  return true
}

module.exports = { processScholarshipInfo, testMistralConnection, validateScholarshipInfo }

