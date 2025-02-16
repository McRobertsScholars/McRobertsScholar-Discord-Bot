const { Events } = require('discord.js');
const logger = require('./utils/logger.js');

async function setupPersistentMessage(client) {
  try {
    const guild = await client.guilds.fetch('1295906651332935743'); // Guild ID
    const channel = await guild.channels.fetch('1340570258791989259'); // Channel ID
    const role = await guild.roles.fetch('1339819275602493502'); // Role ID

    logger.info('✅ Found Guild: ' + guild.name);
    logger.info('✅ Found Channel: ' + channel.name);
    logger.info('✅ Found Role: ' + role.name);

    // Send the "type verify to verify" message if it doesn't exist
    let existingMessage = null;
    const messages = await channel.messages.fetch({ limit: 10 });
    existingMessage = messages.find(msg => msg.content.includes('type verify to verify'));
    
    if (!existingMessage) {
      existingMessage = await channel.send({
        content: 'Type "verify" to verify.',
      });
      logger.info('✅ Sent verification message.');
    } else {
      logger.info('✅ Found existing persistent message.');
    }

    // Listen for new messages in the channel
    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot || message.channel.id !== channel.id) return;  // Only handle messages in the verify channel

      // If the message content is "verify", assign the role and delete the message
      if (message.content.toLowerCase() === "verify") {
        try {
          const member = await guild.members.fetch(message.author.id);
          await member.roles.add(role);  // Add the role
          await message.delete();  // Delete the "verify" message
          logger.info(`✅ Added "Member" role to ${message.author.tag}`);
        } catch (error) {
          logger.error(`❌ Error adding role: ${error.message}`);
        }
      } else {
        // Delete any other message that is not "verify"
        await message.delete();
      }
    });

  } catch (error) {
    logger.error(`❌ Error in setupPersistentMessage: ${error.message}`);
  }
}

// Make sure to export the function after it's defined
module.exports = { setupPersistentMessage };
