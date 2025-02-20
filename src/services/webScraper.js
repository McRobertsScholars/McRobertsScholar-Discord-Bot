const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")

async function scrapeWebpage(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Extract text content
    const pageText = $("body").text()

    // Helper function to find deadline in text
    const findDeadline = (text) => {
      const dateRegex = /(?:deadline|due|submit by|must be sent by|submission|before).*?(\w+ \d{1,2},? \d{4})/i
      const match = text.match(dateRegex)
      return match ? match[1] : null
    }

    // Helper function to find amount in text
    const findAmount = (text) => {
      const amountRegex = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
      const amounts = text.match(amountRegex)
      return amounts ? amounts[0] : null
    }

    // Extract scholarship details
    const scholarshipInfo = {
      name: $("h1").first().text().trim() || $("title").text().trim(),
      deadline: findDeadline(pageText),
      amount: findAmount(pageText),
      description: $("p").first().text().trim(),
      requirements: [],
    }

    // Look for requirements in lists
    $("ul li, ol li").each((_, elem) => {
      const requirement = $(elem).text().trim()
      if (requirement) {
        scholarshipInfo.requirements.push(requirement)
      }
    })

    // If no requirements found in lists, try to find them in paragraphs
    if (scholarshipInfo.requirements.length === 0) {
      $("p").each((_, elem) => {
        const text = $(elem).text().trim()
        if (
          text.toLowerCase().includes("must") ||
          text.toLowerCase().includes("requirement") ||
          text.toLowerCase().includes("eligible")
        ) {
          scholarshipInfo.requirements.push(text)
        }
      })
    }

    return scholarshipInfo
  } catch (error) {
    logger.error(`Web scraping failed: ${error.message}`)
    return null
  }
}

module.exports = { scrapeWebpage }

