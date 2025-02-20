const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")

async function getAllPageText(url) {
  try {
    // Configure axios with headers to avoid 403
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 10000,
    })

    const $ = cheerio.load(response.data)

    // Remove script and style elements
    $("script").remove()
    $("style").remove()

    // Get all text content with better structure
    const sections = []

    // Get title
    const title = $("title").text().trim()
    if (title) sections.push(`TITLE: ${title}`)

    // Get meta description
    const metaDesc = $('meta[name="description"]').attr("content")
    if (metaDesc) sections.push(`META DESCRIPTION: ${metaDesc}`)

    // Get headings
    $("h1, h2, h3").each((_, elem) => {
      const text = $(elem).text().trim()
      if (text) sections.push(`HEADING: ${text}`)
    })

    // Get paragraphs
    $("p").each((_, elem) => {
      const text = $(elem).text().trim()
      if (text) sections.push(`PARAGRAPH: ${text}`)
    })

    // Get list items
    $("li").each((_, elem) => {
      const text = $(elem).text().trim()
      if (text) sections.push(`LIST ITEM: ${text}`)
    })

    // Get other visible text
    $("div, span").each((_, elem) => {
      const $elem = $(elem)
      // Only get text from elements that don't have text-containing children
      if ($elem.children().length === 0) {
        const text = $elem.text().trim()
        if (text && text.length > 5) sections.push(`TEXT: ${text}`)
      }
    })

    return sections.join("\n\n")
  } catch (error) {
    if (error.response?.status === 403) {
      logger.error(`Access forbidden (403) for URL: ${url}`)
      throw new Error("Website access forbidden. Please verify the URL is publicly accessible.")
    }
    logger.error(`Failed to get page text: ${error.message}`)
    throw error
  }
}

module.exports = { getAllPageText }

