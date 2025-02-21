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
  })

  for (let i = 0; i < retries; i++) {
    try {
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      const headers = {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      }

      const response = await instance.get(url, {
        ...options,
        headers: { ...headers, ...options.headers },
      })

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
    $("script, style, iframe, nav, footer, .navigation, .menu, .sidebar, .ads").remove()

    const content = {
      title: "",
      mainContent: "",
      deadlines: new Set(),
      amounts: new Set(),
      requirements: new Set(),
    }

    // Get title
    content.title = $("h1").first().text().trim() || $("title").text().trim() || $(".title").first().text().trim()

    // Get main content
    $("p, li, td, div").each((_, elem) => {
      const text = $(elem).text().trim()
      if (text.length > 0) {
        content.mainContent += text + "\n"

        // Look for deadlines
        if (text.match(/deadline|due date|submit by|closes|ends?/i)) {
          content.deadlines.add(text)
        }

        // Look for amounts/prizes
        if (text.match(/\$|\bdollars?\b|prize|award|scholarship amount/i)) {
          content.amounts.add(text)
        }

        // Look for requirements
        if (text.match(/\b(must|should|need to|required|eligibility|qualify)\b/i)) {
          content.requirements.add(text)
        }
      }
    })

    return {
      title: content.title,
      content: content.mainContent,
      deadlines: Array.from(content.deadlines),
      amounts: Array.from(content.amounts),
      requirements: Array.from(content.requirements),
    }
  } catch (error) {
    logger.error(`Error in getAllPageText: ${error.message}`)
    throw error
  }
}

module.exports = { getAllPageText }

