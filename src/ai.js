const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config(); // Load environment variables from .env file

// Create Supabase client using environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Mistral API setup
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// Fetch scholarships from Supabase
async function getScholarships() {
  const { data, error } = await supabase
    .from('scholarships')
    .select('*');
  if (error) {
    console.error('Error fetching scholarships:', error);
    return [];
  }
  return data;
}

// Fetch resources from Supabase
async function getResources() {
  const { data, error } = await supabase
    .from('resources')
    .select('*');
  if (error) {
    console.error('Error fetching resources:', error);
    return [];
  }
  return data;
}

// Fetch knowledge.txt from GitHub
async function getKnowledgeFromGitHub() {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/McRobertsScholars/McRoberts-Scholars/main/data/knowledge.txt');
    return response.data;
  } catch (error) {
    console.error('Error fetching knowledge.txt from GitHub:', error);
    return '';
  }
}

// Mistral AI chat function to query the AI with context
async function askMistral(query) {
  try {
    const knowledgeText = await getKnowledgeFromGitHub();
    const scholarships = await getScholarships();
    const resources = await getResources();

    // Build context from scholarships, resources, and knowledge.txt
    const context = `
      Scholarships:
      ${scholarships.map(s => `**${s.name}**: ${s.description}`).join('\n')}
      
      Resources:
      ${resources.map(r => `**${r.name}**: ${r.link}`).join('\n')}
      
      Knowledge Base:
      ${knowledgeText}

      Query: ${query}
    `;

    // Send query to Mistral API
    const response = await axios.post(
      MISTRAL_API_URL,
      {
        model: 'mistral-tiny', // Use the correct model here
        messages: [{ role: 'user', content: context }],
      },
      {
        headers: {
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error interacting with Mistral API:', error);
    return 'There was an error querying the AI.';
  }
}

// Set up AI interaction logic for incoming messages
async function setupAI(client) {
  client.on('messageCreate', async (message) => {
    if (message.channel.id === '1339802012232974377' && !message.author.bot) {
      const question = message.content;  // Get the question from the user's message

      if (question.toLowerCase().includes("ask")) {  // Trigger for 'ask' command (or any keyword you like)
        try {
          const answer = await askMistral(question);  // Call the askMistral function
          message.reply(answer);  // Send the AI's answer back to the user
        } catch (error) {
          message.reply('Sorry, I couldn’t get an answer from the AI.');
        }
      }
    }
  });
}

// Export functions
module.exports = { getScholarships, getResources, askMistral, setupAI };