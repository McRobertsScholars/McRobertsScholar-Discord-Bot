require("dotenv").config()

const cleanEnvVar = (value) => {
  if (!value) return value;
  // Remove surrounding quotes if they exist and trim whitespace
  return value.replace(/^["\']|["\']$/g, '').trim();
};

module.exports = {
  APPLICATION_ID: cleanEnvVar(process.env.APPLICATION_ID),
  PUBLIC_KEY: cleanEnvVar(process.env.PUBLIC_KEY),
  CLIENT_ID: cleanEnvVar(process.env.CLIENT_ID),
  DISCORD_TOKEN: cleanEnvVar(process.env.DISCORD_TOKEN),
  MISTRAL_API_KEY: cleanEnvVar(process.env.MISTRAL_API_KEY), // Keep for backward compatibility
  GROQ_API_KEY: cleanEnvVar(process.env.GROQ_API_KEY), // New Groq API key
  SUPABASE_URL: cleanEnvVar(process.env.SUPABASE_URL),
  SUPABASE_KEY: cleanEnvVar(process.env.SUPABASE_KEY),
  SUPABASE_SERVICE_ROLE_KEY: cleanEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY), // For knowledge base access
  CHANNEL_ID: cleanEnvVar(process.env.CHANNEL_ID),
  SERVER_ID: cleanEnvVar(process.env.SERVER_ID || "1295906651332935743"), // Ensure SERVER_ID is also cleaned
  MEETING_CHANNEL_ID: cleanEnvVar(process.env.MEETING_CHANNEL_ID),
  RENDER_EXTERNAL_URL: cleanEnvVar(process.env.RENDER_EXTERNAL_URL),

  GOOGLE_SHEETS_API_KEY: cleanEnvVar(process.env.GOOGLE_SHEETS_API_KEY),
  GOOGLE_CLIENT_EMAIL: cleanEnvVar(process.env.GOOGLE_CLIENT_EMAIL),
  GOOGLE_PRIVATE_KEY: cleanEnvVar(process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, "\n")),
  GOOGLE_SPREADSHEET_ID: cleanEnvVar(process.env.GOOGLE_SPREADSHEET_ID || "1LiT3cGeypX80UHLbL6WMdCoVP3yZMpzizarDB_diVaw"),

  // SMTP Email config - using cleanEnvVar for robustness
  SMTP_HOST: cleanEnvVar(process.env.SMTP_HOST) || 'smtp.gmail.com',
  SMTP_PORT: parseInt(cleanEnvVar(process.env.SMTP_PORT)) || 587,
  SMTP_USER: cleanEnvVar(process.env.SMTP_USER || process.env.EMAIL_FROM), // Support both var names
  SMTP_PASS: cleanEnvVar(process.env.SMTP_PASS || process.env.EMAIL_PASSWORD), // Support both var names
}
