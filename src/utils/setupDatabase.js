const { createClient } = require("@supabase/supabase-js")
const config = require("./config.js")
const logger = require("./logger.js")

async function setupDatabase() {
  try {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY)

    // Create links table
    const { error: createError } = await supabase.rpc("create_links_table")

    if (createError) {
      logger.error(`Error creating links table: ${createError.message}`)
    } else {
      logger.info("Links table created or already exists")
    }

    // Verify the table exists
    const { data, error: selectError } = await supabase.from("links").select("id").limit(1)

    if (selectError) {
      logger.error(`Error verifying links table: ${selectError.message}`)
    } else {
      logger.info("Links table verified successfully")
    }

    logger.info("Database setup completed")
  } catch (error) {
    logger.error(`Database setup error: ${error.message}`)
  }
}

module.exports = { setupDatabase }

