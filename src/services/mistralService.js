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
            content: `You are a precise scholarship information extractor. Your task is to carefully read the webpage content and extract ONLY explicitly stated information. Follow these rules:
            1. Only include information that is directly stated on the page
            2. Use 'Not specified' if information is unclear or missing
            3. For amounts, extract the exact number including currency
            4. For deadlines, extract the complete date
            5. Requirements should be a clear list of eligibility criteria
            6. Description should be a brief summary of the scholarship purpose`,
          },
          {
            role: "user",
            content: `Visit this scholarship page and extract the following information: ${url}

            Please format your response as a valid JSON object with these exact fields:
            {
              "name": "Full scholarship name",
              "deadline": "Complete deadline date (YYYY-MM-DD format) or 'Not specified'",
              "amount": "Exact amount with currency or 'Not specified'",
              "description": "Brief description of the scholarship",
              "requirements": ["Requirement 1", "Requirement 2", etc.]
            }

            Important: Only include information that is explicitly stated on the page. Do not make assumptions or add information that isn't there.`,
          },
        ],
        temperature: 0.1, // Lower temperature for more consistent outputs
        max_tokens: 1000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.MISTRAL_API_KEY}`,
        },
      },
    )

    const result = JSON.parse(response.data.choices[0].message.content)

    // Additional validation and cleaning
    const cleanedResult = {
      name: result.name || "Not specified",
      deadline: result.deadline || "Not specified",
      amount: result.amount || "Not specified",
      description: result.description || "Not specified",
      requirements: Array.isArray(result.requirements) ? result.requirements : ["Not specified"],
    }

    // Validate the cleaned result
    if (validateScholarshipInfo(cleanedResult)) {
      logger.info(`Successfully extracted scholarship info for URL: ${url}`)
      return cleanedResult
    } else {
      throw new Error("Invalid or incomplete scholarship information extracted")
    }
  } catch (error) {
    logger.error(`Error processing scholarship info: ${error.message}`)
    throw error
  }
}

function validateScholarshipInfo(info) {
  // Basic validation
  if (!info.name || info.name === "Not specified") return false
  if (!info.amount || info.amount === "Not specified") return false

  // Allow missing deadline but validate format if present
  if (info.deadline && info.deadline !== "Not specified") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(info.deadline)) return false
  }

  // Ensure description exists
  if (!info.description || info.description === "Not specified") return false

  // Ensure requirements is an array with at least one item
  if (!Array.isArray(info.requirements) || info.requirements.length === 0) return false

  return true
}

async function testMistralConnection() {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-tiny",
        messages: [{ role: "user", content: "Hello, are you working?" }],
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

module.exports = { processScholarshipInfo, testMistralConnection }

