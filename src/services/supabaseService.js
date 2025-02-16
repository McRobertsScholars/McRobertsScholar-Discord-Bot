const { createClient } = require('@supabase/supabase-js');
const config = require('../utils/config.js');
const logger = require('../utils/logger.js');
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

// Insert a new scholarship into the database
async function insertScholarship(scholarship) {
  try {
    const { data, error } = await supabase
      .from('scholarships')
      .insert([{
        name: scholarship.name || 'No Title', // Use 'name' instead of 'title'
        deadline: scholarship.deadline || null,
        amount: scholarship.amount || 'Not specified',
        description: scholarship.description || 'No description',
        requirements: scholarship.requirements || 'Not specified',
        link: scholarship.link
      }]);

    if (error) throw error;
    logger.info(`Inserted scholarship: ${scholarship.name}`);
    return data;
  } catch (error) {
    logger.error(`Error inserting scholarship: ${error.message}`);
    throw error;
  }
}

// Get all scholarships from the database
async function getAllScholarships() {
  // Query logic for fetching scholarships
  const { data, error } = await supabase
    .from('scholarships')
    .select('*');
  if (error) {
    throw new Error('Error fetching scholarships: ' + error.message);
  }
  return data;
}

module.exports = { getAllScholarships };


module.exports = { insertScholarship, getAllScholarships };
