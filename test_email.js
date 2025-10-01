require('dotenv').config();
const emailService = require("./src/services/emailService");

async function test() {
  await emailService.initializeGmail();
  console.log("Initialized?", emailService.isInitialized);
}

test();
