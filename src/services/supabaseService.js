const { createClient } = require('@supabase/supabase-js');
const config = require('../utils/config.js');
const logger = require('../utils/logger.js');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

async function insertScholarship(scholarship) {
  try {
    const { data, error } = await supabase
      .from('scholarships')
      .insert([{
        name: scholarship.title || 'No Title', // Use 'name' instead of 'title'
        deadline: scholarship.deadline || null,
        amount: scholarship.amount || 'Not specified',
        description: scholarship.description || 'No description',
        requirements: scholarship.requirements || 'Not specified',
        link: scholarship.link
      }]);

    if (error) throw error;
    logger.info(`Inserted scholarship: ${scholarship.title}`);
    return data;
  } catch (error) {
    logger.error(`Error inserting scholarship: ${error.message}`);
    throw error;
  }
}

async function getAllScholarships() {
  try {
    const { data, error } = await supabase
      .from('scholarships')
      .select('*');

    if (error) throw error;
    logger.info(`Retrieved ${data.length} scholarships`);
    return data;
  } catch (error) {
    logger.error(`Error retrieving scholarships: ${error.message}`);
    throw error;
  }
}

module.exports = { insertScholarship, getAllScholarships };