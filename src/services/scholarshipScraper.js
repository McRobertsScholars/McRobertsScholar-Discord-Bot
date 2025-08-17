const axios = require("axios")
const cheerio = require("cheerio")
const logger = require("../utils/logger.js")
const { storeLink } = require("./linkService.js")

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
    const scholarshipLinks = []

    $("item").each((index, element) => {
      try {
        const title = $(element).find("title").text().trim()
        const link = $(element).find("link").text().trim()
        const description = $(element).find("description").text().trim()

        if (title && link && isValidScholarshipLink(link, title, description)) {
          scholarshipLinks.push(link)
        }
      } catch (error) {
        logger.warn(`Error parsing RSS item: ${error.message}`)
      }
    })

    return scholarshipLinks.slice(0, 10) // Limit to 10 per source
  } catch (error) {
    logger.error(`Error parsing RSS feed ${sourceName}: ${error.message}`)
    return []
  }
}

function isValidScholarshipLink(link, title = "", description = "") {
  const text = `${title} ${description} ${link}`.toLowerCase()

  // Exclude non-scholarship content
  const excludeKeywords = [
    "blog",
    "article",
    "guide",
    "tips",
    "advice",
    "how-to",
    "college-life",
    "login",
    "register",
    "sign-up",
    "account",
    "profile",
    "dashboard",
    "category",
    "categories",
    "browse",
    "search",
    "filter",
    "by-type",
    "about",
    "contact",
    "privacy",
    "terms",
    "faq",
    "help",
    "news",
    "press",
    "media",
    "announcement",
    "update",
    "general",
    "overview",
    "introduction",
    "getting-started",
    "packing",
    "moving",
    "transition",
    "mental-health",
    "stress",
    "survey",
    "research",
    "study",
    "report",
    "statistics",
  ]

  // Check for excluded content
  if (excludeKeywords.some((keyword) => text.includes(keyword))) {
    return false
  }

  // Exclude URLs with problematic patterns
  const excludeUrlPatterns = [
    "/blog/",
    "/article/",
    "/news/",
    "/guide/",
    "/tips/",
    "/login",
    "/register",
    "/sign-up",
    "/account/",
    "/category/",
    "/browse/",
    "/search/",
    "/filter/",
    "/about",
    "/contact",
    "/help",
    "/faq",
    "utm_",
    "__page=",
    "?ref=",
    "&utm_",
  ]

  if (excludeUrlPatterns.some((pattern) => link.includes(pattern))) {
    return false
  }

  // Must contain actual scholarship indicators
  const scholarshipKeywords = [
    "scholarship",
    "grant",
    "award",
    "fellowship",
    "contest",
    "competition",
    "apply",
    "application",
    "deadline",
    "eligibility",
    "requirements",
    "financial-aid",
    "funding",
    "money",
    "tuition",
    "college-fund",
  ]

  const hasScholarshipKeyword = scholarshipKeywords.some((keyword) => text.includes(keyword))

  // Additional validation for URLs
  const hasScholarshipInUrl = scholarshipKeywords.some((keyword) => link.toLowerCase().includes(keyword))

  return hasScholarshipKeyword || hasScholarshipInUrl
}

async function scrapeScholarshipsFromSite(source) {
  try {
    logger.info(`Scraping scholarship links from ${source.name}...`)

    if (source.type === "rss") {
      const scholarshipLinks = await parseRSSFeed(source.url, source.name)
      return { success: true, links: scholarshipLinks, source: source.name }
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
      validateStatus: (status) => status < 500,
    })

    if (response.status >= 400) {
      logger.warn(`${source.name} returned status ${response.status}`)
      return { success: false, error: `HTTP ${response.status}`, source: source.name }
    }

    const $ = cheerio.load(response.data)
    const scholarshipLinks = []

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

        // Extract scholarship name for keyword filtering
        const name =
          $el.find("h1, h2, h3, h4, .title, .name, .heading").first().text().trim() ||
          $el.find("a").first().text().trim() ||
          $el.text().split("\n")[0].trim()

        // Extract link
        let link = $el.find("a").first().attr("href") || $el.attr("href")
        if (link && !link.startsWith("http")) {
          const baseUrl = new URL(source.url).origin
          link = link.startsWith("/") ? baseUrl + link : baseUrl + "/" + link
        }

        if (name && name.length > 10 && name.length < 200 && link && isValidScholarshipLink(link, name)) {
          scholarshipLinks.push(link)
        }
      } catch (error) {
        logger.warn(`Error parsing element from ${source.name}: ${error.message}`)
      }
    })

    // Remove duplicates
    const uniqueLinks = [...new Set(scholarshipLinks)].slice(0, 8)

    logger.info(`Found ${uniqueLinks.length} unique scholarship links from ${source.name}`)
    return { success: true, links: uniqueLinks, source: source.name }
  } catch (error) {
    logger.error(`Error scraping ${source.name}: ${error.message}`)
    return { success: false, error: error.message, source: source.name }
  }
}

async function discoverOnlineScholarships() {
  try {
    logger.info("Starting online scholarship link discovery...")

    const results = []
    let totalFound = 0
    let totalAdded = 0

    for (const source of SCHOLARSHIP_SOURCES) {
      if (!source.enabled) {
        logger.info(`Skipping ${source.name} (disabled)`)
        continue
      }

      const result = await scrapeScholarshipsFromSite(source)

      if (result.success && result.links && result.links.length > 0) {
        totalFound += result.links.length
        let addedCount = 0

        // Add each link to the existing link collection system
        for (const link of result.links) {
          try {
            const storeResult = await storeLink(link, `discovery-${Date.now()}`, "scholarship-bot")
            if (storeResult.success) {
              addedCount++
            } else if (storeResult.message !== "Link already exists in database") {
              logger.warn(`Failed to store link ${link}: ${storeResult.message}`)
            }
          } catch (error) {
            logger.warn(`Error storing link ${link}: ${error.message}`)
          }
        }

        totalAdded += addedCount

        results.push({
          source: result.source,
          found: result.links.length,
          added: addedCount,
        })
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

    logger.info(`Online scholarship link discovery completed. Found: ${totalFound}, Added: ${totalAdded}`)

    return {
      success: true,
      totalFound,
      totalAdded,
      results,
    }
  } catch (error) {
    logger.error(`Error in online scholarship link discovery: ${error.message}`)
    return { success: false, error: error.message }
  }
}

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
