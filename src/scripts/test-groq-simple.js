const axios = require("axios")
require("dotenv").config()

async function testSimpleGroqCall() {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    console.error("❌ GROQ_API_KEY not found")
    return
  }

  console.log("🔑 Testing simple Groq API call...")

  try {
    // Test with minimal parameters first
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "user",
            content: "What is the email for McRoberts Scholars club?",
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    console.log("✅ Success! Response:", response.data.choices[0].message.content)

    // Now test with longer context
    console.log("\n🔄 Testing with longer context...")

    const longContextResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant for McRoberts Scholars club. The club email is mcrobertsscholars@gmail.com and meetings are Wednesdays 3:00-4:30 PM.",
          },
          {
            role: "user",
            content: "What is the club email and when do you meet?",
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    console.log("✅ Long context success! Response:", longContextResponse.data.choices[0].message.content)
  } catch (error) {
    console.error("❌ Error details:")
    console.error("Status:", error.response?.status)
    console.error("Status Text:", error.response?.statusText)
    console.error("Error Data:", JSON.stringify(error.response?.data, null, 2))
    console.error("Message:", error.message)
  }
}

testSimpleGroqCall()
