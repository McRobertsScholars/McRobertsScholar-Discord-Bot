const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")
const https = require("https")

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

async function fetchWithRetry(url, options = {}, retries = 3) {
  const instance = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: (status) => status < 500,
  })

  for (let i = 0; i < retries; i++) {
    try {
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      const headers = {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      }

      const response = await instance.get(url, {
        ...options,
        headers: { ...headers, ...options.headers },
      })

      // Check if we got a valid HTML response
      const contentType = response.headers["content-type"]
      if (!contentType || !contentType.includes("text/html")) {
        throw new Error("Invalid content type")
      }

      return response
    } catch (error) {
      logger.error(`Attempt ${i + 1} failed: ${error.message}`)
      if (i === retries - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }
}

async function getAllPageText(url) {
  try {
    const response = await fetchWithRetry(url)
    const $ = cheerio.load(response.data)

    // Remove unwanted elements
    $("script, style, iframe, nav, footer, .navigation, .menu, .sidebar, .ads, .cookie, .popup").remove()

    // Get all text content from the page
    let allText = ""

    // Process main content areas first
    $("main, article, .content, .main, #main, #content, .post, .entry").each((_, elem) => {
      allText += $(elem).text() + "\n"
    })

    // If no main content found, get text from body
    if (!allText.trim()) {
      // Get text from all relevant elements
      $("body")
        .find("h1, h2, h3, h4, h5, h6, p, li, td, th, div:not(:empty)")
        .each((_, elem) => {
          const text = $(elem).text().trim()
          if (text) allText += text + "\n"
        })
    }

    // Clean up the text
    allText = allText
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim()

    // Extract potential scholarship information
    const info = extractScholarshipInfo(allText, $)

    // Format the output
    return formatOutput(info, allText)
  } catch (error) {
    logger.error(`Error in getAllPageText: ${error.message}`)
    throw error
  }
}

function extractScholarshipInfo(text, $) {
  const info = {
    title: "",
    deadlines: [],
    amounts: [],
    requirements: [],
  }

  // Extract title (try different approaches)
  info.title = $("h1").first().text().trim() || $("title").text().trim() || text.split("\n")[0]

  // Find deadlines using various patterns
  const deadlinePatterns = [
    /(?:deadline|due|submit by|closes on|end(?:s|ing) on|application due)(?:\s*:?\s*)([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/gi,
    /([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(?:\s*(?:deadline|due date))/gi,
  ]

  deadlinePatterns.forEach((pattern) => {
    const matches = text.match(pattern)
    if (matches) {
      info.deadlines.push(...matches)
    }
  })

  // Find amounts/prizes
  const amountPatterns = [
    /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g,
    /(?:prize|award|scholarship)(?:\s*of\s*|\s*:\s*)\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/gi,
    /\d{1,3}(?:,\d{3})*\s+dollars/gi,
  ]

  amountPatterns.forEach((pattern) => {
    const matches = text.match(pattern)
    if (matches) {
      info.amounts.push(...matches)
    }
  })

  // Find requirements
  const requirementMarkers = [
    "must",
    "should",
    "need to",
    "required to",
    "eligibility",
    "requirements",
    "criteria",
    "eligible",
    "qualify",
  ]

  const sentences = text.match(/[^.!?]+[.!?]+/g) || []
  sentences.forEach((sentence) => {
    if (requirementMarkers.some((marker) => sentence.toLowerCase().includes(marker))) {
      const requirement = sentence.trim()
      if (requirement.length < 200) {
        // Avoid overly long requirements
        info.requirements.push(requirement)
      }
    }
  })

  return info
}

function formatOutput(info, fullText) {
  // Remove duplicates
  info.deadlines = [...new Set(info.deadlines)]
  info.amounts = [...new Set(info.amounts)]
  info.requirements = [...new Set(info.requirements)]

  const output = [
    "TITLE:",
    info.title || "Unknown Scholarship",
    "",
    "DEADLINES FOUND:",
    info.deadlines.length ? info.deadlines.join("\n") : "No specific deadline found",
    "",
    "AMOUNTS/PRIZES FOUND:",
    info.amounts.length ? info.amounts.join("\n") : "No specific amount found",
    "",
    "REQUIREMENTS FOUND:",
    info.requirements.length ? info.requirements.join("\n") : "No specific requirements found",
    "",
    "FULL CONTENT:",
    fullText.substring(0, 1000), // Limit full content to first 1000 characters
  ]

  return output.join("\n")
}

module.exports = { getAllPageText }

