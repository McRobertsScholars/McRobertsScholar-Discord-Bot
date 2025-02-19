const { createClient } = require("@supabase/supabase-js")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY)

async function insertScholarship(scholarship) {
  try {
    const { data, error } = await supabase.from("scholarships").insert([
      {
        name: scholarship.name || "No Title",
        deadline: scholarship.deadline || null,
        amount: scholarship.amount || "Not specified",
        description: scholarship.description || "No description",
        requirements: scholarship.requirements || "Not specified",
        link: scholarship.link,
      },
    ])

    if (error) throw error
    logger.info(`Inserted scholarship: ${scholarship.name}`)
    return data
  } catch (error) {
    logger.error(`Error inserting scholarship: ${error.message}`)
    throw error
  }
}

async function getAllScholarships() {
  const { data, error } = await supabase.from("scholarships").select("*")
  if (error) {
    throw new Error("Error fetching scholarships: " + error.message)
  }
  return data
}

async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from("scholarships").select("count").limit(1)

    if (error) throw error
    logger.info("Supabase connection test successful")
    logger.info(`Number of scholarships: ${data[0].count}`)
  } catch (error) {
    logger.error(`Supabase connection test failed: ${error.message}`)
  }
}

module.exports = { insertScholarship, getAllScholarships, testSupabaseConnection }

