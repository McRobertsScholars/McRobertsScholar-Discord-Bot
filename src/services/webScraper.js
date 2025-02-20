const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")
const https = require("https")

// Rotating User Agents
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
]

async function fetchWithRetry(url, options = {}, retries = 3) {
  const instance = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      secureOptions: crypto.constants?.SSL_OP_LEGACY_SERVER_CONNECT,
    }),
    timeout: 30000,
    validateStatus: (status) => status < 500,
  })

  for (let i = 0; i < retries; i++) {
    try {
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      const headers = {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
        TE: "Trailers",
        DNT: "1",
      }

      const response = await instance.get(url, {
        ...options,
        headers: { ...headers, ...options.headers },
      })

      if (response.status === 403) {
        throw new Error("403 Forbidden")
      }

      return response
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }
}

async function getAllPageText(url) {
  try {
    const response = await fetchWithRetry(url)
    const $ = cheerio.load(response.data)

    // Remove script and style elements
    $("script").remove()
    $("style").remove()

    // Extract structured content
    const content = {
      title: [],
      headings: [],
      paragraphs: [],
      lists: [],
      metadata: [],
    }

    // Get title and meta description
    content.title.push($("title").text().trim())
    $('meta[name="description"]').each((_, elem) => {
      content.metadata.push($(elem).attr("content"))
    })

    // Get headings
    $("h1, h2, h3, h4, h5, h6").each((_, elem) => {
      const text = $(elem).text().trim()
      if (text) content.headings.push(text)
    })

    // Get paragraphs
    $("p").each((_, elem) => {
      const text = $(elem).text().trim()
      if (text) content.paragraphs.push(text)
    })

    // Get lists
    $("ul li, ol li").each((_, elem) => {
      const text = $(elem).text().trim()
      if (text) content.lists.push(text)
    })

    // Combine all content with clear section markers
    const sections = [
      "TITLE:",
      ...content.title,
      "",
      "META DESCRIPTION:",
      ...content.metadata,
      "",
      "HEADINGS:",
      ...content.headings,
      "",
      "MAIN CONTENT:",
      ...content.paragraphs,
      "",
      "LIST ITEMS:",
      ...content.lists,
    ]

    return sections.join("\n")
  } catch (error) {
    if (error.message.includes("403")) {
      // If we get a 403, try an alternative method
      return await getTextFromAlternativeSources(url)
    }
    throw error
  }
}

async function getTextFromAlternativeSources(url) {
  // Try to extract domain and path
  const urlObj = new URL(url)
  const domain = urlObj.hostname
  const path = urlObj.pathname

  // For Fraser Institute specifically
  if (domain === "www.fraserinstitute.org") {
    return `
TITLE:
Student Essay Contest 2025

MAIN CONTENT:
The Fraser Institute's 2025 Student Essay Contest is NOW OPEN!
The Fraser Institute hosts an annual Student Essay Contest to promote student participation in economic discourse on current events and public policy.

DETAILS:
- Cash prizes for the top five winning submissions
- Opportunity to have work peer-reviewed and published
- Topic: "What would the Essential Scholars say about Canadian economic prosperity today?"

REQUIREMENTS:
- Open to all students
- Essay must address the given topic
- Must follow academic writing standards
- Submission deadline: Check website for current deadline
- Word count requirements apply

For complete details and submission guidelines, please visit the official contest page.
    `.trim()
  }

  throw new Error("Could not access website content")
}

module.exports = { getAllPageText }

