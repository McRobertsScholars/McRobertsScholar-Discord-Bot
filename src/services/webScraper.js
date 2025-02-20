const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")

async function scrapeWebpage(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    const pageText = $("body").text()

    // Helper function to find monetary amounts
    const findAmount = (text) => {
      // Match any dollar amount: $X, $X.XX, $X,XXX, etc.
      const amountRegex = /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
      const amounts = text.match(amountRegex)
      if (!amounts) return null

      // If multiple amounts found, look for keywords nearby
      const amountContexts = amounts.map((amount) => {
        const amountIndex = text.indexOf(amount)
        const context = text.slice(Math.max(0, amountIndex - 50), amountIndex + 50)
        const isScholarshipAmount = /scholarship|prize|award|grant/i.test(context)
        return { amount, isScholarshipAmount }
      })

      // Prefer amounts with scholarship context
      const scholarshipAmount = amountContexts.find((a) => a.isScholarshipAmount)
      return scholarshipAmount ? scholarshipAmount.amount : amounts[0]
    }

    // Helper function to find dates
    const findDeadline = (text) => {
      // Match various date formats
      const datePatterns = [
        // Full month name: January 1, 2024 or January 1 2024
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,|\s)\s*\d{4}/i,
        // Abbreviated month: Jan 1, 2024 or Jan 1 2024
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,|\s)\s*\d{4}/i,
        // MM/DD/YYYY or MM-DD-YYYY
        /\d{1,2}[-/]\d{1,2}[-/]\d{4}/,
        // YYYY-MM-DD
        /\d{4}-\d{2}-\d{2}/,
      ]

      // Look for dates near deadline-related words
      const deadlineContexts = [/deadline|due|submit|close|end|application/i]

      // First try to find dates with deadline context
      for (const contextPattern of deadlineContexts) {
        const contextMatch = text.match(new RegExp(`.{0,50}${contextPattern.source}.{0,50}`, "gi"))
        if (contextMatch) {
          for (const context of contextMatch) {
            for (const datePattern of datePatterns) {
              const dateMatch = context.match(datePattern)
              if (dateMatch) return dateMatch[0]
            }
          }
        }
      }

      // If no deadline-specific date found, look for any date
      for (const datePattern of datePatterns) {
        const dateMatch = text.match(datePattern)
        if (dateMatch) return dateMatch[0]
      }

      return null
    }

    // Find the most relevant title
    const findTitle = ($) => {
      // Look for scholarship-related headings
      const headings = $("h1, h2, h3")
        .filter((_, el) => {
          const text = $(el).text().toLowerCase()
          return text.includes("scholarship") || text.includes("contest") || text.includes("grant")
        })
        .first()

      if (headings.length) return headings.text().trim()

      // Fallback to page title
      const pageTitle = $("title").text().trim()
      if (pageTitle) return pageTitle

      // Fallback to first heading
      const firstHeading = $("h1").first().text().trim()
      return firstHeading || "Scholarship Opportunity"
    }

    // Find description
    const findDescription = ($) => {
      // Look for meta description first
      const metaDescription = $('meta[name="description"]').attr("content")
      if (metaDescription) return metaDescription

      // Look for first paragraph after title that mentions scholarship
      const relevantParagraph = $("p")
        .filter((_, el) => {
          const text = $(el).text().toLowerCase()
          return text.includes("scholarship") || text.includes("contest") || text.includes("grant")
        })
        .first()

      if (relevantParagraph.length) return relevantParagraph.text().trim()

      // Fallback to first paragraph
      return $("p").first().text().trim() || "Scholarship opportunity for students."
    }

    // Extract requirements
    const findRequirements = ($, text) => {
      const requirements = new Set()

      // Look for lists
      $("ul li, ol li").each((_, el) => {
        const text = $(el).text().trim()
        if (text.length > 5) requirements.add(text)
      })

      // Look for requirement-like sentences in paragraphs
      $("p").each((_, el) => {
        const text = $(el).text()
        const sentences = text.split(/[.!?]+/)
        sentences.forEach((sentence) => {
          sentence = sentence.trim()
          if (sentence.length > 10 && /must|should|require|eligible|minimum|criteria/i.test(sentence)) {
            requirements.add(sentence)
          }
        })
      })

      // Look for email submission requirements
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/)
      if (emailMatch) {
        requirements.add(`Submit application to ${emailMatch[0]}`)
      }

      return Array.from(requirements)
    }

    const scholarshipInfo = {
      name: findTitle($),
      deadline: findDeadline(pageText),
      amount: findAmount(pageText),
      description: findDescription($),
      requirements: findRequirements($, pageText),
    }

    // Clean up the data
    Object.keys(scholarshipInfo).forEach((key) => {
      if (typeof scholarshipInfo[key] === "string") {
        scholarshipInfo[key] = scholarshipInfo[key].replace(/\s+/g, " ").trim() || null
      }
    })

    logger.info(`Scraped scholarship info: ${JSON.stringify(scholarshipInfo)}`)
    return scholarshipInfo
  } catch (error) {
    logger.error(`Web scraping failed: ${error.message}`)
    return null
  }
}

module.exports = { scrapeWebpage }

