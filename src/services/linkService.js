const { createClient } = require("@supabase/supabase-js")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY)

// Store a new link in the database
async function storeLink(link, messageId, userId) {
  try {
    // Insert the new link
    const { data, error: insertError } = await supabase
      .from("links")
      .insert([
        {
          url: link,
          message_id: messageId,
          user_id: userId,
          created_at: new Date().toISOString(),
          processed: false,
        },
      ])
      .select()

    if (insertError) {
      // Check if the error is due to a unique constraint violation
      if (insertError.code === "23505") {
        logger.info(`Link already exists: ${link}`)
        return { success: false, message: "Link already exists in database" }
      } else {
        logger.error(`Error inserting link: ${insertError.message}`)
        return { success: false, message: "Error inserting link" }
      }
    }

    logger.info(`Stored link: ${link}`)
    return { success: true, data }
  } catch (error) {
    logger.error(`Error storing link: ${error.message}`)
    return { success: false, message: error.message }
  }
}

// Get all unprocessed links
async function getUnprocessedLinks() {
  try {
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("processed", false)
      .order("created_at", { ascending: true })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    logger.error(`Error fetching unprocessed links: ${error.message}`)
    return { success: false, message: error.message }
  }
}

// Mark links as processed
async function markLinksAsProcessed(linkIds) {
  try {
    const { data, error } = await supabase.from("links").update({ processed: true }).in("id", linkIds)

    if (error) throw error
    logger.info(`Marked ${linkIds.length} links as processed`)
    return { success: true, data }
  } catch (error) {
    logger.error(`Error marking links as processed: ${error.message}`)
    return { success: false, message: error.message }
  }
}

// Process scholarship data from AI output
async function processScholarshipData(scholarshipData) {
  try {
    // Parse the scholarship data if it's a string
    let scholarships = scholarshipData
    if (typeof scholarshipData === "string") {
      try {
        scholarships = JSON.parse(scholarshipData)
      } catch (e) {
        throw new Error("Invalid JSON format for scholarship data")
      }
    }

    if (!Array.isArray(scholarships)) {
      scholarships = [scholarships]
    }

    const results = []

    // Process each scholarship
    for (const scholarship of scholarships) {
      // Check if scholarship already exists by name and link
      const { data: existingScholarships } = await supabase
        .from("scholarships")
        .select("*")
        .eq("name", scholarship.name)
        .limit(1)

      if (existingScholarships && existingScholarships.length > 0) {
        results.push({
          name: scholarship.name,
          status: "skipped",
          reason: "Scholarship already exists",
        })
        continue
      }

      // Insert the new scholarship
      const { error } = await supabase.from("scholarships").insert([
        {
          name: scholarship.name || "No Title",
          deadline: scholarship.deadline || null,
          amount: scholarship.amount || "Not specified",
          description: scholarship.description || "No description",
          requirements: scholarship.requirements || "Not specified",
          link: scholarship.link || "Not specified",
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
      }
    }

    return { success: true, results }
  } catch (error) {
    logger.error(`Error processing scholarship data: ${error.message}`)
    return { success: false, message: error.message }
  }
}

// Remove expired scholarships
async function removeExpiredScholarships() {
  try {
    const today = new Date()
    const todayString = today.toISOString().split("T")[0] // YYYY-MM-DD format

    console.log("[v0] Starting cleanup process, today's date:", todayString)

    // Get all scholarships to check their deadlines manually
    const { data: allScholarships, error: fetchError } = await supabase
      .from("scholarships")
      .select("id, name, deadline")
      .not("deadline", "is", null)

    if (fetchError) throw fetchError

    console.log("[v0] Found", allScholarships?.length || 0, "scholarships with deadlines")

    if (!allScholarships || allScholarships.length === 0) {
      return { success: true, message: "No scholarships with deadlines found", count: 0 }
    }

    // Filter expired scholarships by parsing dates properly
    const expiredScholarships = allScholarships.filter((scholarship) => {
      if (!scholarship.deadline) return false

      try {
        // Handle various date formats
        let deadlineDate
        const deadline = scholarship.deadline.toString().trim()

        // Try parsing different date formats
        if (deadline.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // YYYY-MM-DD format
          deadlineDate = new Date(deadline + "T23:59:59")
        } else if (deadline.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          // MM/DD/YYYY format
          deadlineDate = new Date(deadline + " 23:59:59")
        } else if (deadline.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
          // MM-DD-YYYY format
          const parts = deadline.split("-")
          deadlineDate = new Date(`${parts[0]}/${parts[1]}/${parts[2]} 23:59:59`)
        } else {
          // Try generic date parsing
          deadlineDate = new Date(deadline)
        }

        // Check if date is valid and in the past
        if (isNaN(deadlineDate.getTime())) {
          console.log("[v0] Invalid date format for scholarship:", scholarship.name, "deadline:", deadline)
          return false
        }

        const isExpired = deadlineDate < today
        if (isExpired) {
          console.log("[v0] Expired scholarship found:", scholarship.name, "deadline:", deadline)
        }

        return isExpired
      } catch (error) {
        console.log("[v0] Error parsing date for scholarship:", scholarship.name, error.message)
        return false
      }
    })

    console.log("[v0] Found", expiredScholarships.length, "expired scholarships")

    if (expiredScholarships.length === 0) {
      return { success: true, message: "No expired scholarships found", count: 0 }
    }

    // Delete the expired scholarships
    const expiredIds = expiredScholarships.map((s) => s.id)
    const { error: deleteError } = await supabase.from("scholarships").delete().in("id", expiredIds)

    if (deleteError) throw deleteError

    logger.info(`Removed ${expiredScholarships.length} expired scholarships`)
    return {
      success: true,
      message: `Removed ${expiredScholarships.length} expired scholarships`,
      count: expiredScholarships.length,
      removed: expiredScholarships,
    }
  } catch (error) {
    logger.error(`Error removing expired scholarships: ${error.message}`)
    return { success: false, message: error.message }
  }
}

async function scheduleAutomaticCleanup() {
  try {
    // Run cleanup immediately on startup
    logger.info("Running initial scholarship cleanup...")
    const result = await removeExpiredScholarships()
    if (result.success && result.count > 0) {
      logger.info(`Initial cleanup: ${result.message}`)
    }

    // Schedule cleanup to run daily at 2 AM
    const runCleanup = async () => {
      try {
        logger.info("Running scheduled scholarship cleanup...")
        const result = await removeExpiredScholarships()
        if (result.success && result.count > 0) {
          logger.info(`Scheduled cleanup: ${result.message}`)
        }
      } catch (error) {
        logger.error(`Scheduled cleanup failed: ${error.message}`)
      }
    }

    // Calculate time until next 2 AM
    const now = new Date()
    const next2AM = new Date()
    next2AM.setHours(2, 0, 0, 0)

    // If it's already past 2 AM today, schedule for tomorrow
    if (now > next2AM) {
      next2AM.setDate(next2AM.getDate() + 1)
    }

    const timeUntilNext2AM = next2AM.getTime() - now.getTime()

    // Set initial timeout for next 2 AM
    setTimeout(() => {
      runCleanup()
      // Then run every 24 hours
      setInterval(runCleanup, 24 * 60 * 60 * 1000)
    }, timeUntilNext2AM)

    logger.info(`Automatic cleanup scheduled. Next run: ${next2AM.toLocaleString()}`)
  } catch (error) {
    logger.error(`Error setting up automatic cleanup: ${error.message}`)
  }
}

module.exports = {
  storeLink,
  getUnprocessedLinks,
  markLinksAsProcessed,
  processScholarshipData,
  removeExpiredScholarships,
  scheduleAutomaticCleanup, // Export new function
}
