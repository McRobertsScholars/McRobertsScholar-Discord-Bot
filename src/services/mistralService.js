const axios = require("axios")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")
const { scrapeWebpage } = require("./webScraper.js")

async function processScholarshipInfo(url) {
  try {
    // First try web scraping
    const scrapedInfo = await scrapeWebpage(url)

    if (scrapedInfo && isValidScholarshipInfo(scrapedInfo)) {
      logger.info("Using scraped information")
      return scrapedInfo
    }

    // If scraping failed or missed critical info, try AI as backup
    logger.info("Scraping incomplete, falling back to AI")
    return await extractWithAI(url, scrapedInfo)
  } catch (error) {
    logger.error(`Error processing scholarship info: ${error.message}`)
    throw error
  }
}

function isValidScholarshipInfo(info) {
  if (!info) return false

  // Check if we have the minimum required information
  const hasName = info.name && info.name !== "Scholarship Opportunity"
  const hasAmount = info.amount && info.amount.includes("$")
  const hasDeadline = info.deadline && /\d{4}/.test(info.deadline) // Contains a year
  const hasRequirements = Array.isArray(info.requirements) && info.requirements.length > 0

  return hasName && (hasAmount || hasDeadline) && hasRequirements
}

async function extractWithAI(url, scrapedInfo = null) {
  const response = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-tiny",
      messages: [
        {
          role: "system",
          content: `You are a precise scholarship information extractor. Extract ONLY information that is explicitly stated on the webpage. Do not make assumptions or add information that isn't there.
          
          ${scrapedInfo ? `Previously scraped information: ${JSON.stringify(scrapedInfo)}` : ""}`,
        },
        {
          role: "user",
          content: `Visit this scholarship page and extract ONLY the explicitly stated information: ${url}
          
          Required format:
          {
            "name": "Exact scholarship name as shown",
            "deadline": "Complete deadline date if stated",
            "amount": "Exact amount with $ sign if stated",
            "description": "Brief description from the page",
            "requirements": ["List of stated requirements"]
          }
          
          Important:
          - Only include information directly stated on the page
          - Use null for missing information
          - Do not make assumptions or add information`,
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

