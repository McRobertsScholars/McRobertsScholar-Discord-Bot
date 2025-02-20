const axios = require("axios")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")
const { scrapeWebpage } = require("./webScraper.js")

async function processScholarshipInfo(url) {
  try {
    // First try web scraping
    logger.info(`Attempting to scrape ${url}`)
    const scrapedInfo = await scrapeWebpage(url)

    if (scrapedInfo && isValidScholarshipInfo(scrapedInfo)) {
      logger.info("Using scraped information")
      return scrapedInfo
    }

    // If scraping failed or missed critical info, try AI
    logger.info("Scraping incomplete, trying AI extraction")
    const aiInfo = await extractWithAI(url, scrapedInfo)

    if (isValidScholarshipInfo(aiInfo)) {
      logger.info("Using AI-extracted information")
      return aiInfo
    }

    throw new Error("Could not extract sufficient scholarship information")
  } catch (error) {
    logger.error(`Error processing scholarship info: ${error.message}`)
    throw error
  }
}

function isValidScholarshipInfo(info) {
  if (!info) return false

  // Check if we have the minimum required information
  const hasName = info.name && info.name.length > 5
  const hasAmount = info.amount && /\$/.test(info.amount)
  const hasDeadline = info.deadline && /\d{4}/.test(info.deadline)
  const hasRequirements = Array.isArray(info.requirements) && info.requirements.length > 0
  const hasDescription = info.description && info.description.length > 20

  // Must have name and at least two other pieces of information
  return hasName && [hasAmount, hasDeadline, hasRequirements, hasDescription].filter(Boolean).length >= 2
}

async function extractWithAI(url, scrapedInfo = null) {
  const response = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-tiny",
      messages: [
        {
          role: "system",
          content: `You are a scholarship information extractor. Extract ONLY explicitly stated information from the webpage.
          ${scrapedInfo ? `Previously scraped partial information: ${JSON.stringify(scrapedInfo)}` : ""}`,
        },
        {
          role: "user",
          content: `Visit ${url} and extract scholarship information.
          
          Required format:
          {
            "name": "Exact scholarship name",
            "deadline": "Complete deadline date",
            "amount": "Exact amount with $ sign",
            "description": "Brief description",
            "requirements": ["List of requirements"]
          }
          
          Rules:
          1. Only include information directly stated on the page
          2. Use null for missing information
          3. Do not make assumptions
          4. Include currency symbols
          5. Use complete dates`,
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

  const aiResult = JSON.parse(response.data.choices[0].message.content)

  // Merge results, preferring scraped values when available
  if (scrapedInfo) {
    return {
      name: scrapedInfo.name || aiResult.name,
      deadline: scrapedInfo.deadline || aiResult.deadline,
      amount: scrapedInfo.amount || aiResult.amount,
      description: scrapedInfo.description || aiResult.description,
      requirements: scrapedInfo.requirements.length ? scrapedInfo.requirements : aiResult.requirements,
    }
  }

  return aiResult
}

module.exports = {
  processScholarshipInfo,
  setupMistralService: async () => {
    logger.info("Mistral service initialized")
  },
}

