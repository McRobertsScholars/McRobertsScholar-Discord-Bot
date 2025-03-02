const { createClient } = require("@supabase/supabase-js")
const config = require("../utils/config.js")
const logger = require("../utils/logger.js")
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY)

async function insertScholarship(newScholarship) {
  try {
    const { data, error } = await supabase.from("scholarships").insert([newScholarship])
    if (error) {
      throw new Error("Error inserting scholarship: " + error.message)
    }
    return { success: true, data }
  } catch (error) {
    logger.error(`Error inserting scholarship: ${error.message}`)
    return { success: false, message: error.message }
  }
}

async function searchScholarships(name, amount) {
  try {
    let query = supabase.from("scholarships").select("*")

    if (name) {
      query = query.ilike("name", `%${name}%`)
    }

    if (amount) {
      // Convert amount string to number and handle potential parsing errors
      const minAmount = Number.parseFloat(amount)
      if (!isNaN(minAmount)) {
        query = query.gte("amount", minAmount)
      } else {
        logger.warn(`Invalid amount provided for search: ${amount}`)
      }
    }

    const { data, error } = await query.order("name")

    if (error) {
      throw new Error("Error fetching scholarships: " + error.message)
    }
    return { success: true, data }
  } catch (error) {
    logger.error(`Error searching scholarships: ${error.message}`)
    return { success: false, message: error.message }
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

module.exports = {
  insertScholarship,
  getAllScholarships,
  testSupabaseConnection,
  searchScholarships,
}

