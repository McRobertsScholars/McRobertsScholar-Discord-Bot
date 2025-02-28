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
    const today = new Date().toISOString().split("T")[0]

    // Find scholarships with deadlines in the past
    const { data: expiredScholarships, error: findError } = await supabase
      .from("scholarships")
      .select("id, name, deadline")
      .lt("deadline", today)

    if (findError) throw findError

    if (!expiredScholarships || expiredScholarships.length === 0) {
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

module.exports = {
  storeLink,
  getUnprocessedLinks,
  markLinksAsProcessed,
  processScholarshipData,
  removeExpiredScholarships,
}

