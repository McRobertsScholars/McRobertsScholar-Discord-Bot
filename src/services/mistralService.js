const axios = require("axios")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")
const { scrapeWebpage } = require("./webScraper.js")

async function processScholarshipInfo(url) {
  try {
    // First try web scraping
    const scrapedInfo = await scrapeWebpage(url)

    // If scraping was successful and got basic info, enhance it with AI
    if (scrapedInfo && scrapedInfo.name) {
      const enhancedInfo = await enhanceWithAI(url, scrapedInfo)
      return enhancedInfo
    }

    // If scraping failed, fall back to pure AI extraction
    return await extractWithAI(url)
  } catch (error) {
    logger.error(`Error processing scholarship info: ${error.message}`)
    throw error
  }
}

async function enhanceWithAI(url, scrapedInfo) {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-tiny",
        messages: [
          {
            role: "system",
            content: "You are a scholarship information validator. Review and enhance the extracted information.",
          },
          {
            role: "user",
            content: `I have extracted this scholarship information from ${url}:
            ${JSON.stringify(scrapedInfo, null, 2)}
            
            Please verify this information and fill in any missing details. Return a JSON object with the same structure.
            If any information is incorrect, fix it based on the URL content.
            If you can't verify certain information, keep the original value.`,
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

    const aiEnhanced = JSON.parse(response.data.choices[0].message.content)
    return {
      name: aiEnhanced.name || scrapedInfo.name,
      deadline: aiEnhanced.deadline || scrapedInfo.deadline,
      amount: aiEnhanced.amount || scrapedInfo.amount,
      description: aiEnhanced.description || scrapedInfo.description,
      requirements: aiEnhanced.requirements?.length ? aiEnhanced.requirements : scrapedInfo.requirements,
    }
  } catch (error) {
    logger.error(`AI enhancement failed: ${error.message}`)
    return scrapedInfo
  }
}

async function extractWithAI(url) {
  const response = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-tiny",
      messages: [
        {
          role: "system",
          content: "You are a scholarship information extractor. Extract precise details from the webpage.",
        },
        {
          role: "user",
          content: `Extract scholarship information from ${url}. Include:
          - name (exact scholarship name)
          - deadline (exact date)
          - amount (exact amount with $ sign)
          - description (brief summary)
          - requirements (list of requirements)
          
          Return as JSON. Use "Not specified" for missing information.`,
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

  return JSON.parse(response.data.choices[0].message.content)
}

module.exports = { processScholarshipInfo }

