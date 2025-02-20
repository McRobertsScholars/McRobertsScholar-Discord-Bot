const axios = require("axios")
const cheerio = require("cheerio")
const puppeteer = require("puppeteer")
const logger = require("../utils/logger.js")

async function getAllPageText(url) {
  try {
    // Try regular HTTP request first
    let content
    try {
      const response = await axios.get(url)
      content = response.data
    } catch (error) {
      logger.info(`Axios request failed, trying Puppeteer: ${error.message}`)
      content = await getTextWithPuppeteer(url)
    }

    if (!content) {
      throw new Error("Failed to fetch page content")
    }

    const $ = cheerio.load(content)

    // Remove script and style elements
    $("script").remove()
    $("style").remove()

    // Get all text content
    const allText = $("body")
      .text()
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim()

    // Get page title
    const pageTitle = $("title").text().trim()

    // Get meta description
    const metaDescription = $('meta[name="description"]').attr("content") || ""

    // Combine all text with clear section markers
    const fullText = `
PAGE TITLE: ${pageTitle}

META DESCRIPTION: ${metaDescription}

PAGE CONTENT:
${allText}
    `.trim()

    return fullText
  } catch (error) {
    logger.error(`Failed to get page text: ${error.message}`)
    return null
  }
}

async function getTextWithPuppeteer(url) {
  let browser = null
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "new",
    })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
    return await page.content()
  } catch (error) {
    logger.error(`Puppeteer error: ${error.message}`)
    return null
  } finally {
    if (browser) await browser.close()
  }
}

module.exports = { getAllPageText }

