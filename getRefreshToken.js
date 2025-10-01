require('dotenv').config();
const { google } = require("googleapis");

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = "https://developers.google.com/oauthplayground"; // standard for refresh token
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

async function sendTestEmail() {
  const messageParts = [
    "From: McRoberts Scholars Bot <mcrobertsscholars@mcroberts-scholars-bot.iam.gserviceaccount.com>",
    "To: tadjellcraft@gmail.com",
    "Subject: Test Email from Bot",
    "",
    "This is a test email sent via Gmail API using refresh token!"
  ];
  const message = Buffer.from(messageParts.join("\n"))
    .toString("base64")
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: message }
    });
    console.log("✅ Email sent successfully! Message ID:", res.data.id);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
}

sendTestEmail();
