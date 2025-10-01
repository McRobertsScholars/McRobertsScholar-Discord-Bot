require("dotenv").config();

const cleanEnvVar = (value) => {
  if (!value) return undefined;
  return value.replace(/^["']|["']$/g, '').trim();
};

module.exports = {
  // Discord
  APPLICATION_ID: cleanEnvVar(process.env.APPLICATION_ID),
  PUBLIC_KEY: cleanEnvVar(process.env.PUBLIC_KEY),
  CLIENT_ID: cleanEnvVar(process.env.CLIENT_ID),
  DISCORD_TOKEN: cleanEnvVar(process.env.DISCORD_TOKEN),
  CHANNEL_ID: cleanEnvVar(process.env.CHANNEL_ID),
  SERVER_ID: cleanEnvVar(process.env.SERVER_ID || "1295906651332935743"),
  MEETING_CHANNEL_ID: cleanEnvVar(process.env.MEETING_CHANNEL_ID),
  SUPABASE_URL: cleanEnvVar(process.env.SUPABASE_URL),
  SUPABASE_KEY: cleanEnvVar(process.env.SUPABASE_KEY),

  // Google Sheets
  GOOGLE_SHEETS_API_KEY: cleanEnvVar(process.env.GOOGLE_SHEETS_API_KEY),
  GOOGLE_CLIENT_EMAIL: cleanEnvVar(process.env.GOOGLE_CLIENT_EMAIL),
  GOOGLE_PRIVATE_KEY: cleanEnvVar(process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, "\n"),
  GOOGLE_SPREADSHEET_ID: cleanEnvVar(process.env.GOOGLE_SPREADSHEET_ID),

  // Render URL
  RENDER_EXTERNAL_URL: cleanEnvVar(process.env.RENDER_EXTERNAL_URL),

  // SMTP
  SMTP_HOST: cleanEnvVar(process.env.SMTP_HOST) || 'smtp.gmail.com',
  SMTP_PORT: parseInt(cleanEnvVar(process.env.SMTP_PORT) || '465', 10),
  SMTP_USER: cleanEnvVar(process.env.SMTP_USER || process.env.EMAIL_FROM),
  SMTP_PASS: cleanEnvVar(process.env.SMTP_PASS || process.env.EMAIL_PASSWORD),
  SMTP_SECURE: cleanEnvVar(process.env.SMTP_SECURE) === 'true', // true = 465, false = 587
  SMTP_REJECT_UNAUTHORIZED: cleanEnvVar(process.env.SMTP_REJECT_UNAUTHORIZED) !== 'false'
};
