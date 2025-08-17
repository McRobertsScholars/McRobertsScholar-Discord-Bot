const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")
const { processScholarshipData } = require("./linkService.js")

// List of scholarship websites to scrape
const SCHOLARSHIP_SOURCES = [
  {
    name: "Scholarships.com",
    url: "https://www.scholarships.com/financial-aid/college-scholarships/scholarships-by-type/",
    selector: ".scholarship-item",
    enabled: false, // Disabled by default due to potential rate limiting
  },
  // Add more sources as needed
]

// Function to scrape scholarships from a website
async function scrapeScholarshipsFromSite(source) {
  try {
    logger.info(`Scraping scholarships from ${source.name}...`)

    const response = await axios.get(source.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    })

    const $ = cheerio.load(response.data)
    const scholarships = []

    // This is a basic example - each site would need custom parsing
    $(source.selector).each((index, element) => {
      try {
        const name = $(element).find("h3, .title, .name").first().text().trim()
        const deadline = $(element).find(".deadline, .date").first().text().trim()
        const amount = $(element).find(".amount, .value").first().text().trim()
        const description = $(element).find(".description, .summary").first().text().trim()
        const link = $(element).find("a").first().attr("href")

        if (name && link) {
          scholarships.push({
            name,
            deadline: deadline || "Not specified",
            amount: amount || "Not specified",
            description: description || "No description available",
            requirements: "Check website for requirements",
            link: link.startsWith("http") ? link : `${new URL(source.url).origin}${link}`,
          })
        }
      } catch (error) {
        logger.warn(`Error parsing scholarship element: ${error.message}`)
      }
    })

    return { success: true, scholarships, source: source.name }
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

      // Add delay between requests to be respectful
      await new Promise((resolve) => setTimeout(resolve, 2000))
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

module.exports = {
  discoverOnlineScholarships,
  toggleScholarshipSource,
  SCHOLARSHIP_SOURCES,
}
