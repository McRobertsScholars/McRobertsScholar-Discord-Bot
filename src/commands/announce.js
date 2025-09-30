const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    PermissionFlagsBits 
} = require("discord.js");
const config = require("../utils/config");
const logger = require("../utils/logger");
const googleSheetsService = require("../services/googleSheetsService");
const emailService = require("../services/emailService");
const fs = require("fs").promises;
const path = require("path");
// File path for persistent storage
const ANNOUNCEMENTS_FILE = path.join(process.cwd(), "data", "pendingAnnouncements.json");
const ANNOUNCEMENT_LIFESPAN_MS = 30 * 60 * 1000; // 30 minutes
const CLUB_LOGO_PATH = path.join(process.cwd(), "src", "assets", "club-logo.png");
// Store pending announcements
let pendingAnnouncements = new Map();
// --- Persistence Functions ---
async function ensureDataDirectory() {
    const dataDir = path.dirname(ANNOUNCEMENTS_FILE);
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
        logger.error("Error creating data directory:", error);
    }
}
async function saveAnnouncements() {
    try {
        await ensureDataDirectory();
        const dataToSave = Array.from(pendingAnnouncements.entries());
        await fs.writeFile(ANNOUNCEMENTS_FILE, JSON.stringify(dataToSave, null, 2));
        logger.info(`✅ Saved ${dataToSave.length} pending announcements`);
    } catch (error) {
        logger.error("Error saving announcements:", error);
    }
}
async function loadAnnouncements() {
    try {
        const data = await fs.readFile(ANNOUNCEMENTS_FILE, "utf8");
        if (!data || data.trim().length === 0) {
            logger.info("Announcements file empty, starting fresh");
            pendingAnnouncements = new Map();
        } else {
            const loadedData = JSON.parse(data);
            pendingAnnouncements = new Map(loadedData);
            logger.info(`✅ Loaded ${pendingAnnouncements.size} pending announcements`);
        }
        cleanupAnnouncements();
    } catch (error) {
        if (error.code === "ENOENT") {
            logger.info("No announcements file found, starting fresh");
            pendingAnnouncements = new Map();
        } else {
            logger.error("Error loading announcements:", error);
        }
    }
}
function cleanupAnnouncements() {
    const now = Date.now();
    let cleanedCount = 0;
    const initialSize = pendingAnnouncements.size;
    
    for (const [id, announcement] of pendingAnnouncements.entries()) {
        if (!announcement.timestamp) {
            const idParts = id.split("-");
            if (idParts.length > 1) {
                announcement.timestamp = parseInt(idParts[idParts.length - 1], 10);
            } else {
                announcement.timestamp = 0;
            }
        }
        if (now - announcement.timestamp > ANNOUNCEMENT_LIFESPAN_MS) {
            logger.info(`🧹 Cleaning expired announcement: ${id}`);
            pendingAnnouncements.delete(id);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        logger.info(`🧹 Cleaned ${cleanedCount} expired announcements`);
        saveAnnouncements();
    }
}
// Schedule periodic cleanup
setInterval(cleanupAnnouncements, ANNOUNCEMENT_LIFESPAN_MS / 2);
// Initialize on module load
loadAnnouncements();
module.exports = {
  data: new SlashCommandBuilder()
    .setName("announce")
        .setDescription("Create and manage McRoberts Scholars announcements")
        .addStringOption(option =>
            option.setName("topic")
                .setDescription("The topic/subject of the announcement")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("message")
                .setDescription("The announcement message content")
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName("ping_everyone")
                .setDescription("Ping @everyone in Discord (default: false)")
                .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    try {
            await interaction.deferReply({ ephemeral: true });
            const topic = interaction.options.getString("topic");
            const message = interaction.options.getString("message");
            const pingEveryone = interaction.options.getBoolean("ping_everyone") || false;
            const announcementId = `${interaction.user.id}-${Date.now()}`;
            // Store announcement data
            pendingAnnouncements.set(announcementId, {
                topic,
                discordContent: message,
                emailContent: message,
                pingEveryone,
                userId: interaction.user.id,
                channelId: config.MEETING_CHANNEL_ID || interaction.channelId,
                timestamp: Date.now()
            });
            logger.info(`✨ New announcement created: ${announcementId} by ${interaction.user.tag}`);
            await saveAnnouncements();
            // Create control panel embed
            const embed = new EmbedBuilder()
                .setTitle("📢 McRoberts Scholars Announcement Control Panel")
                .setColor(0x0099FF)
                .addFields(
                    { name: "📌 Topic", value: topic },
                    { name: "💬 Discord Content", value: message.substring(0, 1024) },
                    { name: "📧 Email Content", value: message.substring(0, 1024) },
                    { name: "🔔 Ping Everyone", value: pingEveryone ? "Yes" : "No", inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `ID: ${announcementId.slice(-8)}` });
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`announce_edit_discord_${announcementId}`)
                        .setLabel("Edit Discord")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji("✏️"),
                    new ButtonBuilder()
                        .setCustomId(`announce_edit_email_${announcementId}`)
                        .setLabel("Edit Email")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji("📝"),
                    new ButtonBuilder()
                        .setCustomId(`announce_preview_${announcementId}`)
                        .setLabel("Preview")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji("👁️")
                );
            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`announce_send_discord_${announcementId}`)
                        .setLabel("Send Discord")
                        .setStyle(ButtonStyle.Success)
                        .setEmoji("📤"),
                    new ButtonBuilder()
                        .setCustomId(`announce_send_email_${announcementId}`)
                        .setLabel("Send Email")
                        .setStyle(ButtonStyle.Success)
                        .setEmoji("📧"),
                    new ButtonBuilder()
                        .setCustomId(`announce_send_both_${announcementId}`)
                        .setLabel("Send Both")
                        .setStyle(ButtonStyle.Success)
                        .setEmoji("🚀")
                );
            const row3 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`announce_cancel_${announcementId}`)
                        .setLabel("Cancel")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji("❌")
                );
            await interaction.editReply({
                embeds: [embed],
                components: [row1, row2, row3]
            });
        } catch (error) {
            logger.error("Error executing announce command:", error);
            await interaction.editReply("❌ An error occurred creating the announcement.");
        }
    },
    async handleButton(interaction) {
        const customId = interaction.customId;
        if (!customId.startsWith("announce_")) return;
        const withoutPrefix = customId.replace(/^announce_/, "");
        let action, subAction = null, announcementId;
        if (withoutPrefix.startsWith("edit_") || withoutPrefix.startsWith("send_")) {
            const parts = withoutPrefix.split("_");
            action = parts[0];
            subAction = parts[1];
            announcementId = parts.slice(2).join("_");
        } else {
            const parts = withoutPrefix.split("_");
            action = parts[0];
            announcementId = parts.slice(1).join("_");
        }
        const announcement = pendingAnnouncements.get(announcementId);
        
        if (!announcement) {
            await interaction.reply({ 
                content: "❌ Announcement not found or expired!", 
                ephemeral: true 
            });
            return;
        }
        // Check if user owns the announcement
        if (announcement.userId !== interaction.user.id) {
            await interaction.reply({ 
                content: "❌ You can only manage your own announcements!", 
                ephemeral: true 
            });
            return;
        }
        // Handle different actions
        if (action === "preview") {
            await interaction.deferReply({ ephemeral: true });
            
            let logoAttachment = null;
            try {
                await fs.access(CLUB_LOGO_PATH);
                logoAttachment = {
                    attachment: CLUB_LOGO_PATH,
                    name: "club-logo.png"
                };
            } catch (err) {
                logger.warn("Club logo not found at:", CLUB_LOGO_PATH);
            }
            const previewEmbed = new EmbedBuilder()
                .setTitle(`📢 McRoberts Scholars: ${announcement.topic}`)
                .setDescription(announcement.discordContent)
                .setColor(0x0099FF)
                .setFooter({ text: `Announced by ${interaction.user.username}` })
                .setTimestamp();
            if (logoAttachment) {
                previewEmbed.setThumbnail("attachment://club-logo.png");
            }
            const files = logoAttachment ? [logoAttachment] : [];
            await interaction.editReply({
                content: "**Discord Preview:**",
                embeds: [previewEmbed],
                files
            });
            await interaction.followUp({
                content: `**Email Preview:**\\n\\n**Subject:** ${announcement.topic}\\n\\n**Content:**\\n\`\`\`\\n${announcement.emailContent}\\n\`\`\``,
                ephemeral: true
            });
        } else if (action === "cancel") {
            await interaction.deferUpdate();
            pendingAnnouncements.delete(announcementId);
            await saveAnnouncements();
            
            await interaction.editReply({
                content: "❌ Announcement canceled and removed.",
                embeds: [],
                components: []
            });
        } else if (action === "edit") {
            if (subAction === "discord") {
                const modal = new ModalBuilder()
                    .setCustomId(`announce_modal_discord_${announcementId}`)
                    .setTitle("Edit Discord Content");
                const contentInput = new TextInputBuilder()
                    .setCustomId("content")
                    .setLabel("Discord Message Content")
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(announcement.discordContent)
                    .setMaxLength(4000)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(contentInput));
                await interaction.showModal(modal);
                
            } else if (subAction === "email") {
                const modal = new ModalBuilder()
                    .setCustomId(`announce_modal_email_${announcementId}`)
                    .setTitle("Edit Email Content");
                const contentInput = new TextInputBuilder()
                    .setCustomId("content")
                    .setLabel("Email Body Content")
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(announcement.emailContent)
                    .setMaxLength(4000)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(contentInput));
                await interaction.showModal(modal);
            }
        } else if (action === "send") {
            await interaction.deferUpdate();
            
            if (subAction === "discord" || subAction === "both") {
                await sendDiscordAnnouncement(interaction, announcement, announcementId);
            }
            
            if (subAction === "email" || subAction === "both") {
                await sendEmailAnnouncement(interaction, announcement, announcementId);
            }
        }
    },
    async handleModal(interaction) {
        await interaction.deferUpdate();
        const customId = interaction.customId;
        if (!customId.startsWith("announce_modal_")) return;
        const parts = customId.split("_");
        const type = parts[2];
        const announcementId = parts.slice(3).join("_");
        const announcement = pendingAnnouncements.get(announcementId);
        
        if (!announcement) {
            await interaction.followUp({
                content: "❌ Announcement not found or expired!",
                ephemeral: true
            });
            return;
        }
        const newContent = interaction.fields.getTextInputValue("content");
        if (type === "discord") {
            announcement.discordContent = newContent;
        } else if (type === "email") {
            announcement.emailContent = newContent;
        }
        
        await saveAnnouncements();
        // Update control panel
        const embed = new EmbedBuilder()
            .setTitle("📢 McRoberts Scholars Announcement Control Panel")
            .setColor(0x0099FF)
            .addFields(
                { name: "📌 Topic", value: announcement.topic },
                { name: "💬 Discord Content", value: announcement.discordContent.substring(0, 1024) },
                { name: "📧 Email Content", value: announcement.emailContent.substring(0, 1024) },
                { name: "🔔 Ping Everyone", value: announcement.pingEveryone ? "Yes" : "No", inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Updated! | ID: ${announcementId.slice(-8)}` });
        await interaction.editReply({
            embeds: [embed],
            components: interaction.message.components
        });
    }
};
// Helper functions
async function sendDiscordAnnouncement(interaction, announcement, announcementId) {
    try {
        const channel = interaction.client.channels.cache.get(announcement.channelId);
        
        if (!channel) {
            throw new Error("Announcement channel not found!");
        }
        let logoAttachment = null;
        try {
            await fs.access(CLUB_LOGO_PATH);
            logoAttachment = {
                attachment: CLUB_LOGO_PATH,
                name: "club-logo.png"
            };
        } catch (err) {
            logger.warn("Club logo not found");
        }
        let content = announcement.pingEveryone ? "@everyone\\n\\n" : "";
        content += `📢 **McRoberts Scholars Announcement**`;
        const announceEmbed = new EmbedBuilder()
            .setTitle(announcement.topic)
            .setDescription(announcement.discordContent)
            .setColor(0x0099FF)
            .setTimestamp()
            .setFooter({ text: `Announced by ${interaction.user.username}` });
        if (logoAttachment) {
            announceEmbed.setThumbnail("attachment://club-logo.png");
        }
        const messageOptions = {
            content,
            embeds: [announceEmbed]
        };
        if (logoAttachment) {
            messageOptions.files = [logoAttachment];
        }
        await channel.send(messageOptions);
        
        logger.info(`Discord announcement sent by ${interaction.user.tag}`);
        
        await interaction.followUp({
            content: "✅ Discord announcement sent successfully!",
            ephemeral: true
        });
    } catch (error) {
        logger.error("Error sending Discord announcement:", error);
        await interaction.followUp({
            content: `❌ Failed to send Discord announcement: ${error.message}`,
            ephemeral: true
        });
    }
}
async function sendEmailAnnouncement(interaction, announcement, announcementId) {
    try {
        await interaction.followUp({
            content: "📧 Sending emails... This may take a moment.",
            ephemeral: true
        });
        const { members } = await googleSheetsService.getMemberEmails();
        
        if (members.length === 0) {
            throw new Error("No member emails found!");
        }
        const emailContent = `
Dear McRoberts Scholar,
${announcement.emailContent}
Best regards,
McRoberts Scholars Program
        `.trim();
        const { results, errors } = await emailService.sendBulkEmail(
            members,
            announcement.topic,
            emailContent
        );
        let resultMessage = `✅ Email sent to ${results.length} recipients`;
        if (errors.length > 0) {
            resultMessage += `\\n⚠️ ${errors.length} failed`;
        }
        logger.info(`Email announcement sent by ${interaction.user.tag}: ${results.length} sent, ${errors.length} failed`);
        
        await interaction.followUp({
            content: resultMessage,
            ephemeral: true
        });
    } catch (error) {
        logger.error("Error sending email announcement:", error);
        await interaction.followUp({
            content: `❌ Failed to send emails: ${error.message}`,
            ephemeral: true
        });
    }
}
