const express = require("express")
const { storeLink, processScholarshipData } = require("./linkService")
const { extractScholarshipInfo, fetchPageContent } = require("./freeAiService")
const logger = require("../utils/logger")

function setupWebhooks(app) {
  app.post("/webhook/links", async (req, res) => {
    try {
      const { links, source } = req.body

      if (!links || !Array.isArray(links)) {
        return res.status(400).json({ error: "Links array is required" })
      }

      const results = []
      for (const link of links) {
        const result = await storeLink(link, `n8n-${Date.now()}`, source || "n8n-automation")
        results.push({ link, success: result.success, message: result.message })
      }

      logger.info(`Received ${links.length} links from n8n webhook`)
      res.json({ success: true, results })
    } catch (error) {
      logger.error(`Webhook error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  })

  app.post("/webhook/scholarships", async (req, res) => {
    try {
      const { scholarships } = req.body

      if (!scholarships) {
        return res.status(400).json({ error: "Scholarships data is required" })
      }

      const result = await processScholarshipData(scholarships)

      logger.info(`Processed scholarship data from n8n webhook`)
      res.json(result)
    } catch (error) {
      logger.error(`Scholarship webhook error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  })

  app.get("/api/unprocessed-links", async (req, res) => {
    try {
      const { getUnprocessedLinks } = require("./linkService")
      const limit = Number.parseInt(req.query.limit) || 10

      const result = await getUnprocessedLinks()
      if (!result.success) {
        return res.status(500).json({ error: result.message })
      }

      const links = result.data.slice(0, limit).map((link) => ({
        id: link.id,
        url: link.url,
        created_at: link.created_at,
      }))

      res.json({ success: true, links })
    } catch (error) {
      logger.error(`API error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  })

  app.post("/api/process-link", async (req, res) => {
    try {
      const { url, linkId } = req.body

      if (!url) {
        return res.status(400).json({ error: "URL is required" })
      }

      // Fetch content
      const contentResult = await fetchPageContent(url)
      if (!contentResult.success) {
        return res.json({
          success: false,
          reason: "content_fetch_failed",
          error: contentResult.error,
        })
      }

      // Extract scholarship info
      const extractResult = await extractScholarshipInfo(url, contentResult.content)
      if (!extractResult.success) {
        return res.json({
          success: false,
          reason: extractResult.reason,
          error: extractResult.error,
        })
      }

      // Mark link as processed if linkId provided
      if (linkId) {
        const { markLinksAsProcessed } = require("./linkService")
        await markLinksAsProcessed([linkId])
      }

      res.json({
        success: true,
        scholarship: extractResult.data,
      })
    } catch (error) {
      logger.error(`Process link API error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  })

  logger.info("Webhook endpoints configured for n8n integration")
}

module.exports = { setupWebhooks }
