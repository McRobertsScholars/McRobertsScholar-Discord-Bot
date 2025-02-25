const axios = require("axios")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")
const { getAllPageText } = require("./webScraper.js")

function truncateText(text, maxLength = 1000) {
  if (text.length <= maxLength) return text
  return text.substr(0, maxLength - 3) + "..."
}

function formatRequirements(requirements) {
  if (Array.isArray(requirements)) {
    return requirements.join("\n• ")
  }
  return requirements
}

async function processScholarshipInfo(url) {
  try {
    const pageText = await getAllPageText(url)

    if (!pageText) {
      throw new Error("Could not fetch page content")
    }

    const scholarshipInfo = await extractWithAI(url, pageText)

    if (!isValidScholarshipInfo(scholarshipInfo)) {
      throw new Error("Could not extract valid scholarship information")
    }

    // Format and truncate the scholarship information
    scholarshipInfo.description = truncateText(scholarshipInfo.description, 1000)
    scholarshipInfo.requirements = truncateText(formatRequirements(scholarshipInfo.requirements), 1000)

    return scholarshipInfo
  } catch (error) {
    logger.error(`Error processing scholarship info: ${error.message}`)
    throw error
  }
}

function isValidScholarshipInfo(info) {
  if (!info) return false

  // Check if we have the minimum required information
  const hasName = info.name && info.name.length > 5
  const hasAmount = info.amount && (info.amount.includes("$") || info.amount === "Not specified")
  const hasDeadline = info.deadline && (info.deadline.length > 5 || info.deadline === "Not specified")
  const hasRequirements = info.requirements && info.requirements.length > 0
  const hasDescription = info.description && info.description.length > 20

  return hasName && [hasAmount, hasDeadline, hasRequirements, hasDescription].filter(Boolean).length >= 2
}

async function extractWithAI(url, pageText) {
  const systemPrompt = `You are a scholarship information extractor. Your task is to analyze webpage content and extract ONLY explicitly stated scholarship information. Do not make assumptions or add information that isn't directly stated in the text.

Special instructions for Fraser Institute Essay Contest:
- This is a prestigious essay contest with cash prizes
- Look for specific prize amounts, if stated
- Note any submission deadlines
- Include essay topic and requirements
- Focus on academic and submission requirements

Rules:
1. Only include information that appears in the text
2. Use 'Not specified' for missing information
3. Include ALL prize amounts if multiple exist
4. Include the FULL deadline date if stated
5. List ALL stated requirements as a bullet-point list
6. Do not make assumptions or add information not in the text`

  const response = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-tiny",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Here is the text content from ${url}:

${pageText}

Extract the scholarship information and format it as JSON with these fields:
{
  "name": "Exact scholarship/contest name",
  "deadline": "Exact deadline date if stated, or 'Not specified'",
  "amount": "Exact prize/award amount with $ sign, or 'Not specified'",
  "description": "Brief description of the scholarship/contest",
  "requirements": "• Requirement 1\n• Requirement 2\n• ..."
}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
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

module.exports = {
  processScholarshipInfo,
  setupMistralService: async () => {
    logger.info("Mistral service initialized")
  },
}

