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
  MEETING_CHANNEL_ID: process.env.MEETING_CHANNEL_ID,
  RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,

  GOOGLE_SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY,
  GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n"), // Handle newlines in private key
  GOOGLE_SPREADSHEET_ID: "1LiT3cGeypX80UHLbL6WMdCoVP3yZMpzizarDB_diVaw",

  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
  GMAIL_FROM_EMAIL: process.env.GMAIL_FROM_EMAIL,

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
}
