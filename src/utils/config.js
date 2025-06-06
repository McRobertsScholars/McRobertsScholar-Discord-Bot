require("dotenv").config()

module.exports = {
  APPLICATION_ID: process.env.APPLICATION_ID,
  PUBLIC_KEY: process.env.PUBLIC_KEY,
  CLIENT_ID: process.env.CLIENT_ID,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY, // Keep for backward compatibility
  GROQ_API_KEY: process.env.GROQ_API_KEY, // New Groq API key
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, // For knowledge base access
  CHANNEL_ID: process.env.CHANNEL_ID,
  SERVER_ID: "1295906651332935743",
  CHANNEL_ID: "1339801789725278208",
  RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
}
