const { createClient } = require("@supabase/supabase-js")
const axios = require("axios")
require("dotenv").config()

// Create Supabase client using environment variables
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Groq API setup
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_API_KEY = process.env.GROQ_API_KEY

// Function to search knowledge base using text search
async function searchKnowledgeBase(query, matchCount = 5) {
  try {
    console.log("Searching knowledge base for:", query)

    // Use text search with keywords
    const keywords = query
      .toLowerCase()
      .split(" ")
      .filter((word) => word.length > 3)

    let results = null

    // Try different search approaches
    for (const keyword of keywords) {
      const { data: searchResults, error } = await supabase
        .from("knowledge_base")
        .select("content, metadata")
        .ilike("content", `%${keyword}%`)
        .limit(matchCount)

      if (!error && searchResults && searchResults.length > 0) {
        results = searchResults
        break
      }
    }

    // If no keyword matches, get some general content
    if (!results || results.length === 0) {
      const { data: generalResults, error } = await supabase.from("knowledge_base").select("content, metadata").limit(3)

      if (!error) {
        results = generalResults
      }
    }

    if (!results || results.length === 0) {
      console.log("No knowledge base results found")
      return ""
    }

    console.log(`Found ${results.length} relevant knowledge chunks`)
    return results.map((result) => result.content).join("\n\n")
  } catch (error) {
    console.error("Knowledge base search error:", error)
    return ""
  }
}

// Fetch scholarships from Supabase
async function getScholarships() {
  const { data, error } = await supabase.from("scholarships").select("*")
  if (error) {
    console.error("Error fetching scholarships:", error)
    return []
  }
  return data
}

// Fetch resources from Supabase
async function getResources() {
  const { data, error } = await supabase.from("resources").select("*")
  if (error) {
    console.error("Error fetching resources:", error)
    return []
  }
  return data
}

// Fetch knowledge.txt from GitHub (fallback)
async function getKnowledgeFromGitHub() {
  try {
    const response = await axios.get(
      "https://raw.githubusercontent.com/McRobertsScholars/McRoberts-Scholars/main/data/knowledge.txt",
    )
    return response.data
  } catch (error) {
    console.error("Error fetching knowledge.txt from GitHub:", error)
    return ""
  }
}

// Groq AI chat function to query the AI with context
async function askGroq(query) {
  try {
    console.log("Processing query with Groq AI:", query)

    // Search knowledge base for relevant information
    const relevantKnowledge = await searchKnowledgeBase(query)
    console.log("Knowledge chunks found:", relevantKnowledge ? "Yes" : "No")
    if (relevantKnowledge) {
      console.log("Knowledge content preview:", relevantKnowledge.substring(0, 200) + "...")
    }

    // Fallback to GitHub knowledge if no database results
    const githubKnowledge = relevantKnowledge ? "" : await getKnowledgeFromGitHub()

    const scholarships = await getScholarships()
    const resources = await getResources()

    // Format data for the AI
    const formattedScholarships = scholarships
      ? scholarships
          .map(
            (s) =>
              `${s.name}\nDeadline: ${s.deadline}\nAmount: ${s.amount}\nDescription: ${s.description}\nEligibility: ${s.eligibility || s.requirements || "Not specified"}\nLink: ${s.link}`,
          )
          .join("\n\n")
      : ""

    const formattedResources = resources
      ? resources.map((r) => `${r.title || r.name} (${r.type || "Resource"}): ${r.link}`).join("\n\n")
      : ""

    // Create comprehensive context
    const contextInfo = `
KNOWLEDGE BASE:
${relevantKnowledge || githubKnowledge}

SCHOLARSHIPS:
${formattedScholarships}

RESOURCES:
${formattedResources}

CLUB INFO:
- Email: mcrobertsscholars@gmail.com
- Meetings: Wednesdays 3:00-4:30 PM, Student Center Room 204
- Discord: https://discord.gg/j8SP6zxraN
`

    // Prepare messages for Groq with proper structure
    const messages = [
      {
        role: "system",
        content:
          "You are an AI assistant for McRoberts Scholars, a student club that helps peers find scholarships. Use the provided context to answer questions accurately and helpfully. Keep responses concise for Discord.",
      },
      {
        role: "user",
        content: `Context: ${contextInfo}\n\nQuestion: ${query}`,
      },
    ]

    console.log("Calling Groq API with model: llama3-70b-8192")
    console.log("Message length:", JSON.stringify(messages).length)

    // Call Groq API with proper error handling
    try {
      const response = await axios.post(
        GROQ_API_URL,
        {
          model: "llama3-70b-8192",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000, // Reduced to avoid issues
          top_p: 0.9,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 second timeout
        },
      )

      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        console.log("Primary model response received successfully")
        return response.data.choices[0].message.content
      } else {
        throw new Error("Invalid response structure from primary model")
      }
    } catch (primaryError) {
      console.error("Primary model error details:", {
        status: primaryError.response?.status,
        statusText: primaryError.response?.statusText,
        data: primaryError.response?.data,
        message: primaryError.message,
      })

      // Try fallback model with the SAME context
      console.log("Trying fallback model: llama3-8b-8192")

      const fallbackResponse = await axios.post(
        GROQ_API_URL,
        {
          model: "llama3-8b-8192",
          messages: messages, // Use the same messages with context
          temperature: 0.7,
          max_tokens: 800,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        },
      )

      if (fallbackResponse.data.choices && fallbackResponse.data.choices[0]) {
        console.log("Fallback model response received successfully")
        return fallbackResponse.data.choices[0].message.content
      } else {
        throw new Error("Both models failed to provide valid responses")
      }
    }
  } catch (error) {
    console.error("Complete AI service failure:", error.message)
    return "Sorry, I'm having trouble connecting to the AI service right now. For immediate help, you can email us at mcrobertsscholars@gmail.com or join our Discord at https://discord.gg/j8SP6zxraN"
  }
}

// Set up AI interaction logic for incoming messages
async function setupAI(client) {
  client.on("messageCreate", async (message) => {
    if (message.channel.id === "1339802012232974377" && !message.author.bot) {
      const question = message.content

      if (question.toLowerCase().includes("ask") || message.mentions.has(client.user)) {
        try {
          const answer = await askGroq(question)

          // Split long messages if needed (Discord has 2000 char limit)
          if (answer.length > 2000) {
            const chunks = answer.match(/.{1,1900}/g) || [answer]
            for (const chunk of chunks) {
              await message.reply(chunk)
            }
          } else {
            await message.reply(answer)
          }
        } catch (error) {
          console.error("Error in AI response:", error)
          message.reply("Sorry, I couldn't get an answer from the AI right now.")
        }
      }
    }
  })
}

// Export functions (updated function names)
module.exports = {
  getScholarships,
  getResources,
  askGroq, // Updated from askMistral
  setupAI,
  searchKnowledgeBase, // New export
}
