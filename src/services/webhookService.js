const express = require("express")
const { storeLink, processScholarshipData, getUnprocessedLinks, markLinksAsProcessed } = require("./linkService")
const { extractScholarshipInfo, fetchPageContent } = require("./freeAiService")
const logger = require("../utils/logger")
const { supabase } = require("../utils/supabaseClient")

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

  // New endpoint for n8n to store discovered links
  app.post("/api/links", async (req, res) => {
    try {
      const { links } = req.body

      if (!links || !Array.isArray(links)) {
        return res.status(400).json({ error: "Links array is required" })
      }

      const results = []
      for (const linkData of links) {
        // Handle both simple URLs and link objects
        const url = typeof linkData === "string" ? linkData : linkData.url
        const source = linkData.source || "n8n-discovery"

        if (url) {
          const result = await storeLink(url, `n8n-${Date.now()}`, source)
          results.push({
            url,
            success: result.success,
            message: result.message,
          })
        }
      }

      const successCount = results.filter((r) => r.success).length
      logger.info(`N8N stored ${successCount}/${links.length} new scholarship links`)

      res.json({
        success: true,
        stored: successCount,
        total: links.length,
        results,
      })
    } catch (error) {
      logger.error(`N8N links API error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  })

  // New endpoint for n8n to get unprocessed links for AI processing
  app.get("/api/links/unprocessed", async (req, res) => {
    try {
      const limit = Number.parseInt(req.query.limit) || 50
      const result = await getUnprocessedLinks()

      if (!result.success) {
        return res.status(500).json({ error: result.message })
      }

      // Format for n8n consumption
      const links = result.data.slice(0, limit).map((link) => ({
        id: link.id,
        url: link.url,
        created_at: link.created_at,
        source: link.user_id || "unknown",
      }))

      logger.info(`N8N requested ${links.length} unprocessed links`)
      res.json(links)
    } catch (error) {
      logger.error(`N8N unprocessed links API error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  })

  // New endpoint for n8n to mark links as processed after AI extraction
  app.post("/api/links/processed", async (req, res) => {
    try {
      const { linkIds } = req.body

      if (!linkIds || !Array.isArray(linkIds)) {
        return res.status(400).json({ error: "linkIds array is required" })
      }

      const result = await markLinksAsProcessed(linkIds)

      if (result.success) {
        logger.info(`N8N marked ${linkIds.length} links as processed`)
        res.json({ success: true, processed: linkIds.length })
      } else {
        res.status(500).json({ error: result.message })
      }
    } catch (error) {
      logger.error(`N8N processed links API error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  })

  // Enhanced scholarship processing endpoint for n8n
  app.post("/api/scholarships", async (req, res) => {
    try {
      const scholarshipData = req.body

      // Handle both single scholarship and array
      const scholarships = Array.isArray(scholarshipData) ? scholarshipData : [scholarshipData]

      const results = []
      let addedCount = 0

      for (const scholarship of scholarships) {
        try {
          // Validate required fields
          if (!scholarship.name || scholarship.name.trim().length < 3) {
            results.push({
              name: scholarship.name || "Unknown",
              status: "skipped",
              reason: "Invalid or missing name",
            })
            continue
          }

          // Check for duplicates
          const { data: existing } = await supabase
            .from("scholarships")
            .select("id")
            .eq("name", scholarship.name.trim())
            .limit(1)

          if (existing && existing.length > 0) {
            results.push({
              name: scholarship.name,
              status: "skipped",
              reason: "Already exists",
            })
            continue
          }

          // Insert new scholarship
          const { error } = await supabase.from("scholarships").insert([
            {
              name: scholarship.name.trim(),
              description: scholarship.description || "",
              amount: scholarship.amount || null,
              deadline: scholarship.deadline || null,
              eligibility: scholarship.eligibility || "",
              application_url: scholarship.application_url || scholarship.applicationUrl || "",
              requirements: scholarship.requirements || "",
              source: scholarship.source || "n8n-automation",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])

          if (error) {
            results.push({
              name: scholarship.name,
              status: "error",
              reason: error.message,
            })
          } else {
            results.push({
              name: scholarship.name,
              status: "added",
            })
            addedCount++
          }
        } catch (scholarshipError) {
          results.push({
            name: scholarship.name || "Unknown",
            status: "error",
            reason: scholarshipError.message,
          })
        }
      }

      logger.info(`N8N processed ${scholarships.length} scholarships, added ${addedCount}`)
      res.json({
        success: true,
        processed: scholarships.length,
        added: addedCount,
        results,
      })
    } catch (error) {
      logger.error(`N8N scholarships API error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  })

  logger.info("Webhook endpoints configured for n8n integration")
}

module.exports = { setupWebhooks }
