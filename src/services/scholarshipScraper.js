const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")
const { processScholarshipData } = require("./linkService.js")

const SCHOLARSHIP_SOURCES = [
  {
    name: "Fastweb",
    url: "https://www.fastweb.com/college-scholarships/articles",
    selector: ".scholarship-result",
    enabled: true,
  },
  {
    name: "College Board",
    url: "https://bigfuture.collegeboard.org/scholarships-and-grants",
    selector: ".scholarship-item",
    enabled: true,
  },
  {
    name: "Scholarships.com",
    url: "https://www.scholarships.com/financial-aid/college-scholarships/scholarships-by-type/",
    selector: ".scholarship-item",
    enabled: false, // Keep disabled due to anti-bot measures
  },
]

async function scrapeScholarshipsFromSite(source) {
  try {
    logger.info(`Scraping scholarships from ${source.name}...`)

    const response = await axios.get(source.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 15000,
      maxRedirects: 5,
    })

    const $ = cheerio.load(response.data)
    const scholarships = []

    const elements = $(source.selector).length > 0 ? $(source.selector) : $("article, .card, .item, .result")

    elements.each((index, element) => {
      try {
        const name =
          $(element).find("h1, h2, h3, h4, .title, .name, .heading").first().text().trim() ||
          $(element).find("a").first().text().trim()

        const deadline = $(element).find(".deadline, .date, .expires, .due").first().text().trim()
        const amount = $(element).find(".amount, .value, .award, .prize").first().text().trim()
        const description = $(element).find(".description, .summary, .excerpt, p").first().text().trim()
        const link = $(element).find("a").first().attr("href")

        if (name && name.length > 5 && link) {
          scholarships.push({
            name: name.substring(0, 200), // Limit length
            deadline: deadline || "Not specified",
            amount: amount || "Varies",
            description: description ? description.substring(0, 500) : "Check website for details",
            requirements: "Visit website for full requirements",
            link: link.startsWith("http") ? link : `${new URL(source.url).origin}${link}`,
          })
        }
      } catch (error) {
        logger.warn(`Error parsing scholarship element: ${error.message}`)
      }
    })

    const validScholarships = scholarships.filter(
      (s, index, self) => s.name && s.link && index === self.findIndex((t) => t.name === s.name || t.link === s.link),
    )

    return { success: true, scholarships: validScholarships, source: source.name }
  } catch (error) {
    logger.error(`Error scraping ${source.name}: ${error.message}`)
    return { success: false, error: error.message, source: source.name }
  }
}

// Function to discover and add new scholarships
async function discoverOnlineScholarships() {
  try {
    logger.info("Starting online scholarship discovery...")

    const results = []
    let totalFound = 0
    let totalAdded = 0

    for (const source of SCHOLARSHIP_SOURCES) {
      if (!source.enabled) {
        logger.info(`Skipping ${source.name} (disabled)`)
        continue
      }

      const result = await scrapeScholarshipsFromSite(source)

      if (result.success && result.scholarships.length > 0) {
        totalFound += result.scholarships.length

        // Process the scholarships (add to database)
        const processResult = await processScholarshipData(result.scholarships)

        if (processResult.success) {
          const addedCount = processResult.results.filter((r) => r.status === "added").length
          totalAdded += addedCount

          results.push({
            source: result.source,
            found: result.scholarships.length,
            added: addedCount,
            results: processResult.results,
          })
        }
      } else {
        results.push({
          source: result.source,
          found: 0,
          added: 0,
          error: result.error,
        })
      }

      await new Promise((resolve) => setTimeout(resolve, getRandomDelay()))
    }

    logger.info(`Online scholarship discovery completed. Found: ${totalFound}, Added: ${totalAdded}`)

    return {
      success: true,
      totalFound,
      totalAdded,
      results,
    }
  } catch (error) {
    logger.error(`Error in online scholarship discovery: ${error.message}`)
    return { success: false, error: error.message }
  }
}

// Function to enable/disable scholarship sources
function toggleScholarshipSource(sourceName, enabled) {
  const source = SCHOLARSHIP_SOURCES.find((s) => s.name === sourceName)
  if (source) {
    source.enabled = enabled
    logger.info(`${sourceName} ${enabled ? "enabled" : "disabled"} for scholarship discovery`)
    return true
  }
  return false
}

function getRandomDelay() {
  return Math.floor(Math.random() * 3000) + 2000 // 2-5 seconds
}

module.exports = {
  discoverOnlineScholarships,
  toggleScholarshipSource,
  SCHOLARSHIP_SOURCES,
}
