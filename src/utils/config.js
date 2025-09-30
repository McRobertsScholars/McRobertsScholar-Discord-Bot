require("dotenv").config();

const cleanEnvVar = (value) => {
  if (!value) return value;
  // Remove surrounding quotes if they exist and trim whitespace
  return value.replace(/^["\']|["\']$/g, '').trim();
};

module.exports = {
  // Discord Configuration
  APPLICATION_ID: cleanEnvVar(process.env.APPLICATION_ID),
  PUBLIC_KEY: cleanEnvVar(process.env.PUBLIC_KEY),
  CLIENT_ID: cleanEnvVar(process.env.CLIENT_ID),
  DISCORD_TOKEN: cleanEnvVar(process.env.DISCORD_TOKEN),
  CHANNEL_ID: cleanEnvVar(process.env.CHANNEL_ID),
  SERVER_ID: cleanEnvVar(process.env.SERVER_ID || "1295906651332935743"),
  MEETING_CHANNEL_ID: cleanEnvVar(process.env.MEETING_CHANNEL_ID),

  // AI API Keys
  MISTRAL_API_KEY: cleanEnvVar(process.env.MISTRAL_API_KEY), // Keep for backward compatibility
  GROQ_API_KEY: cleanEnvVar(process.env.GROQ_API_KEY), // New Groq API key

  // Supabase Configuration
  SUPABASE_URL: cleanEnvVar(process.env.SUPABASE_URL),
  SUPABASE_KEY: cleanEnvVar(process.env.SUPABASE_KEY),
  SUPABASE_SERVICE_ROLE_KEY: cleanEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY), // For knowledge base access

  // Google Services
  GOOGLE_SHEETS_API_KEY: cleanEnvVar(process.env.GOOGLE_SHEETS_API_KEY),
  GOOGLE_CLIENT_EMAIL: cleanEnvVar(process.env.GOOGLE_CLIENT_EMAIL),
  GOOGLE_PRIVATE_KEY: cleanEnvVar(process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, "\n"), // Fixed escape sequence
  GOOGLE_SPREADSHEET_ID: cleanEnvVar(process.env.GOOGLE_SPREADSHEET_ID || "1LiT3cGeypX80UHLbL6WMdCoVP3yZMpzizarDB_diVaw"),

  // Render Configuration
  RENDER_EXTERNAL_URL: cleanEnvVar(process.env.RENDER_EXTERNAL_URL),

  // SMTP Email Configuration
  SMTP_HOST: cleanEnvVar(process.env.SMTP_HOST) || 'smtp.gmail.com',
  SMTP_PORT: parseInt(cleanEnvVar(process.env.SMTP_PORT) || '587'),
  SMTP_USER: cleanEnvVar(process.env.SMTP_USER || process.env.EMAIL_FROM), // Support both var names
  SMTP_PASS: cleanEnvVar(process.env.SMTP_PASS || process.env.EMAIL_PASSWORD), // Support both var names
  
  // Optional: Add SMTP security settings for more control
  SMTP_SECURE: cleanEnvVar(process.env.SMTP_SECURE) === 'true' || false, // true for 465, false for other ports
  SMTP_REJECT_UNAUTHORIZED: cleanEnvVar(process.env.SMTP_REJECT_UNAUTHORIZED) !== 'false' // Default to true for security
};