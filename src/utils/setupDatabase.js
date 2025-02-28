const { createClient } = require("@supabase/supabase-js")
const config = require("./config.js")
const logger = require("./logger.js")

async function setupDatabase() {
  try {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY)

    // Check if the links table exists
    const { data: existingTables, error: tableError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")

    if (tableError) {
      logger.error(`Error checking tables: ${tableError.message}`)
      return
    }

    const tables = existingTables.map((t) => t.table_name)

    // Create links table if it doesn't exist
    if (!tables.includes("links")) {
      logger.info("Creating links table...")

      const { error: createError } = await supabase.rpc("create_links_table")

      if (createError) {
        logger.error(`Error creating links table: ${createError.message}`)
      } else {
        logger.info("Links table created successfully")
      }
    } else {
      logger.info("Links table already exists")
    }

    logger.info("Database setup completed")
  } catch (error) {
    logger.error(`Database setup error: ${error.message}`)
  }
}

module.exports = { setupDatabase }

