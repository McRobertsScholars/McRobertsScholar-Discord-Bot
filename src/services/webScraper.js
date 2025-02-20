const axios = require("axios")
const cheerio = require("cheerio")
const puppeteer = require("puppeteer")
const logger = require("../utils/logger.js")

async function scrapeWithPuppeteer(url) {
  let browser = null
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "new",
    })
    const page = await browser.newPage()

    // Set a reasonable timeout
    await page.setDefaultNavigationTimeout(15000)

    // Enable JavaScript
    await page.setJavaScriptEnabled(true)

    // Navigate to the page
    await page.goto(url, { waitUntil: "networkidle0" })

    // Wait for content to load
    await page.waitForSelector("body")

    // Get the page content
    const content = await page.content()
    return content
  } catch (error) {
    logger.error(`Puppeteer scraping failed: ${error.message}`)
    return null
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

async function scrapeWebpage(url) {
  try {
    // First try simple axios request
    let content
    try {
      const response = await axios.get(url)
      content = response.data
    } catch (error) {
      logger.info(`Axios request failed, trying Puppeteer: ${error.message}`)
      content = await scrapeWithPuppeteer(url)
      if (!content) {
        throw new Error("Failed to fetch page content")
      }
    }

    const $ = cheerio.load(content)

    // Extract all text content for analysis
    const pageText = $("body").text()

    // Find monetary amounts
    const findAmounts = (text) => {
      const amounts = []
      // Match various money formats
      const moneyRegex = /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars|USD|CAD)/gi
      let match
      while ((match = moneyRegex.exec(text)) !== null) {
        amounts.push(match[0])
      }
      return amounts
    }

    // Find dates
    const findDates = (text) => {
      const dates = []
      // Various date formats
      const datePatterns = [
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/gi,
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/gi,
        /\d{4}-\d{2}-\d{2}/g,
        /\d{1,2}[-/]\d{1,2}[-/]\d{4}/g,
      ]

      datePatterns.forEach((pattern) => {
        let match
        while ((match = pattern.exec(text)) !== null) {
          dates.push(match[0])
        }
      })
      return dates
    }

    // Find scholarship name
    const findScholarshipName = ($) => {
      // Look for elements with scholarship-related keywords
      const selectors = [
        'h1:contains("scholarship")',
        'h1:contains("contest")',
        'h2:contains("scholarship")',
        'h2:contains("contest")',
        ".scholarship-title",
        "#scholarship-title",
        "title",
      ]

      for (const selector of selectors) {
        const element = $(selector).first()
        if (element.length && element.text().trim()) {
          return element.text().trim()
        }
      }

      // If no specific scholarship title found, use page title
      return $("title").text().trim() || "Scholarship Opportunity"
    }

    // Find requirements
    const findRequirements = ($) => {
      const requirements = new Set()

      // Look for lists
      $("ul li, ol li").each((_, elem) => {
        const text = $(elem).text().trim()
        if (
          text.length > 10 &&
          /must|should|require|eligible|submit|between|minimum|maximum|deadline|criteria/i.test(text)
        ) {
          requirements.add(text)
        }
      })

      // Look for requirement-like paragraphs
      $("p").each((_, elem) => {
        const text = $(elem).text().trim()
        if (
          text.length > 10 &&
          /must|should|require|eligible|submit|between|minimum|maximum|deadline|criteria/i.test(text)
        ) {
          requirements.add(text)
        }
      })

      return Array.from(requirements)
    }

    // Find description
    const findDescription = ($) => {
      // Try meta description first
      const metaDesc = $('meta[name="description"]').attr("content")
      if (metaDesc) return metaDesc

      // Look for relevant paragraphs
      const relevantP = $("p")
        .filter((_, el) => {
          const text = $(el).text().toLowerCase()
          return (
            text.includes("scholarship") || text.includes("contest") || text.includes("award") || text.includes("prize")
          )
        })
        .first()

      if (relevantP.length) return relevantP.text().trim()

      // Fallback to first substantial paragraph
      return $("p")
        .filter((_, el) => $(el).text().trim().length > 50)
        .first()
        .text()
        .trim()
    }

    // Extract information
    const amounts = findAmounts(pageText)
    const dates = findDates(pageText)
    const name = findScholarshipName($)
    const requirements = findRequirements($)
    const description = findDescription($)

    // Validate extracted information
    if (!name || (!amounts.length && !dates.length && !requirements.length)) {
      throw new Error("Insufficient scholarship information found")
    }

    const scholarshipInfo = {
      name: name,
      deadline: dates.length ? dates[0] : null,
      amount: amounts.length ? amounts[0] : null,
      description: description || "Scholarship opportunity for students.",
      requirements: requirements.length ? requirements : ["Please visit the website for detailed requirements."],
    }

    logger.info(`Successfully extracted scholarship info from ${url}`)
    return scholarshipInfo
  } catch (error) {
    logger.error(`Web scraping failed: ${error.message}`)
    return null
  }
}

module.exports = { scrapeWebpage }

