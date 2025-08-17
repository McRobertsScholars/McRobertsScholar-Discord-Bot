const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")
const { processScholarshipData } = require("./linkService.js")

const SCHOLARSHIP_SOURCES = [
  {
    name: "ScholarshipOwl RSS",
    url: "https://scholarshipowl.com/blog/feed/",
    type: "rss",
    enabled: true,
  },
  {
    name: "Cappex Blog",
    url: "https://www.cappex.com/articles/money/scholarships/",
    selector: ".article-card, .post-item",
    type: "html",
    enabled: true,
  },
  {
    name: "Niche Scholarships",
    url: "https://www.niche.com/colleges/scholarships/",
    selector: ".scholarship__name, .search-result",
    type: "html",
    enabled: true,
  },
  {
    name: "Unigo Scholarships",
    url: "https://www.unigo.com/scholarships",
    selector: ".scholarship-item, .result-item",
    type: "html",
    enabled: true,
  },
  {
    name: "College Scholarships RSS",
    url: "https://www.collegescholarships.org/feed/",
    type: "rss",
    enabled: true,
  },
]

async function parseRSSFeed(url, sourceName) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ScholarshipBot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      timeout: 10000,
    })

    const $ = cheerio.load(response.data, { xmlMode: true })
    const scholarships = []

    $("item").each((index, element) => {
      try {
        const title = $(element).find("title").text().trim()
        const link = $(element).find("link").text().trim()
        const description = $(element).find("description").text().trim()
        const pubDate = $(element).find("pubDate").text().trim()

        // Only include if it looks like a scholarship (contains scholarship keywords)
        const scholarshipKeywords = ["scholarship", "grant", "award", "financial aid", "funding"]
        const containsKeyword = scholarshipKeywords.some(
          (keyword) => title.toLowerCase().includes(keyword) || description.toLowerCase().includes(keyword),
        )

        if (title && link && containsKeyword) {
          scholarships.push({
            name: title.substring(0, 200),
            deadline: "Check website for deadline",
            amount: "Varies",
            description: description
              ? description.replace(/<[^>]*>/g, "").substring(0, 500)
              : "Check website for details",
            requirements: "Visit website for full requirements",
            link: link,
          })
        }
      } catch (error) {
        logger.warn(`Error parsing RSS item: ${error.message}`)
      }
    })

    return scholarships.slice(0, 10) // Limit to 10 per source
  } catch (error) {
    logger.error(`Error parsing RSS feed ${sourceName}: ${error.message}`)
    return []
  }
}

async function scrapeScholarshipsFromSite(source) {
  try {
    logger.info(`Scraping scholarships from ${source.name}...`)

    if (source.type === "rss") {
      const scholarships = await parseRSSFeed(source.url, source.name)
      return { success: true, scholarships, source: source.name }
    }

    const response = await axios.get(source.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 20000,
      maxRedirects: 3,
      validateStatus: (status) => status < 500, // Accept 4xx errors but not 5xx
    })

    if (response.status >= 400) {
      logger.warn(`${source.name} returned status ${response.status}`)
      return { success: false, error: `HTTP ${response.status}`, source: source.name }
    }

    const $ = cheerio.load(response.data)
    const scholarships = []

    let elements = $(source.selector)

    if (elements.length === 0) {
      // Fallback selectors
      const fallbackSelectors = [
        "article",
        ".card",
        ".item",
        ".result",
        ".post",
        "[class*='scholarship']",
        "[class*='award']",
        "[class*='grant']",
        "h2, h3, h4",
        ".title",
      ]

      for (const fallback of fallbackSelectors) {
        elements = $(fallback)
        if (elements.length > 0) {
          logger.info(`Using fallback selector "${fallback}" for ${source.name}`)
          break
        }
      }
    }

    elements.slice(0, 15).each((index, element) => {
      try {
        const $el = $(element)

        // More flexible name extraction
        const name =
          $el.find("h1, h2, h3, h4, .title, .name, .heading").first().text().trim() ||
          $el.find("a").first().text().trim() ||
          $el.text().split("\n")[0].trim()

        const deadline = $el.find(".deadline, .date, .expires, .due, [class*='date']").first().text().trim()
        const amount = $el.find(".amount, .value, .award, .prize, [class*='amount']").first().text().trim()
        const description = $el.find(".description, .summary, .excerpt, p").first().text().trim()

        // More flexible link extraction
        let link = $el.find("a").first().attr("href") || $el.attr("href")
        if (link && !link.startsWith("http")) {
          const baseUrl = new URL(source.url).origin
          link = link.startsWith("/") ? baseUrl + link : baseUrl + "/" + link
        }

        const scholarshipKeywords = ["scholarship", "grant", "award", "financial", "funding", "college", "student"]
        const containsKeyword = scholarshipKeywords.some((keyword) => name.toLowerCase().includes(keyword))

        if (name && name.length > 10 && name.length < 200 && (link || containsKeyword)) {
          scholarships.push({
            name: name.substring(0, 200),
            deadline: deadline || "Check website for deadline",
            amount: amount || "Varies",
            description: description ? description.substring(0, 500) : "Check website for details",
            requirements: "Visit website for full requirements",
            link: link || source.url,
          })
        }
      } catch (error) {
        logger.warn(`Error parsing element from ${source.name}: ${error.message}`)
      }
    })

    const validScholarships = scholarships
      .filter(
        (s, index, self) =>
          index ===
          self.findIndex(
            (t) => t.name.toLowerCase() === s.name.toLowerCase() || (t.link && s.link && t.link === s.link),
          ),
      )
      .slice(0, 8) // Limit per source

    logger.info(`Found ${validScholarships.length} valid scholarships from ${source.name}`)
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

function getAvailableSources() {
  return SCHOLARSHIP_SOURCES.map((source) => ({
    name: source.name,
    enabled: source.enabled,
    type: source.type || "html",
  }))
}

function getRandomDelay() {
  return Math.floor(Math.random() * 4000) + 3000 // 3-7 seconds for better rate limiting
}

module.exports = {
  discoverOnlineScholarships,
  toggleScholarshipSource,
  getAvailableSources,
  SCHOLARSHIP_SOURCES,
}
