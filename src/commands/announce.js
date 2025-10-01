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
            pendingAnnouncements = new Map();
        } else {
            const loadedData = JSON.parse(data);
            pendingAnnouncements = new Map(loadedData);
        }
        cleanupAnnouncements();
        logger.info(`✅ Loaded ${pendingAnnouncements.size} pending announcements`);
    } catch (error) {
        if (error.code === "ENOENT") pendingAnnouncements = new Map();
        else logger.error("Error loading announcements:", error);
    }
}

function cleanupAnnouncements() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, announcement] of pendingAnnouncements.entries()) {
        if (!announcement.timestamp) announcement.timestamp = 0;
        if (now - announcement.timestamp > ANNOUNCEMENT_LIFESPAN_MS) {
            pendingAnnouncements.delete(id);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) saveAnnouncements();
}

// Schedule periodic cleanup
setInterval(cleanupAnnouncements, ANNOUNCEMENT_LIFESPAN_MS / 2);
loadAnnouncements();

// --- Gmail Helper ---
async function ensureEmailServiceReady() {
    if (!emailService.isInitialized) {
        logger.info("⏳ Waiting for Gmail API to initialize...");
        await emailService.waitForInit();
    }
}

// --- Helpers to build email content ---
function buildAnnouncementText(announcement) {
    return `Dear McRoberts Scholar,\n\n${announcement.emailContent}\n\nBest regards,\nMcRoberts Scholars Program`;
}

function buildAnnouncementHtml(announcement) {
    const safeBody = (announcement.emailContent || '').replace(/\n/g, '<br>');
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>McRoberts Scholars - ${escapeHtml(announcement.topic)}</title>
</head>
<body style="font-family:Segoe UI, Roboto, Helvetica, Arial,sans-serif;color:#222;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f9fc;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);overflow:hidden;">
<tr><td style="padding:20px 24px;background:#0b72ff;color:#fff;font-size:18px;font-weight:600;">McRoberts Scholars</td></tr>
<tr><td style="padding:24px;">
<h2 style="margin:0 0 12px 0;color:#0b3a82;font-size:20px;">${escapeHtml(announcement.topic)}</h2>
<div style="font-size:15px;line-height:1.6;">${safeBody}</div>
<hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
<p style="margin:0;color:#6b7280;font-size:13px;">Join our Discord: <a href="https://discord.gg/" style="color:#0b72ff;">Connect</a></p>
<p style="margin:16px 0 0 0;font-size:14px;color:#374151;">Best regards,<br>McRoberts Scholars Program</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- Discord announcement ---
async function sendDiscordAnnouncement(interaction, announcement) {
    try {
        const channel = interaction.client.channels.cache.get(announcement.channelId);
        if (!channel) throw new Error("Announcement channel not found");

        let logoAttachment = null;
        try {
            await fs.access(CLUB_LOGO_PATH);
            logoAttachment = { attachment: CLUB_LOGO_PATH, name: "club-logo.png" };
        } catch { /* ignore */ }

        const content = announcement.pingEveryone ? "@everyone\n\n" : "";
        const embed = new EmbedBuilder()
            .setTitle(announcement.topic)
            .setDescription(announcement.discordContent)
            .setColor(0x0099FF)
            .setTimestamp()
            .setFooter({ text: `Announced by ${interaction.user.username}` });

        if (logoAttachment) embed.setThumbnail("attachment://club-logo.png");

        await channel.send({ content, embeds: [embed], files: logoAttachment ? [logoAttachment] : [] });
        logger.info(`Discord announcement sent by ${interaction.user.tag}`);

        await interaction.followUp({ content: "✅ Discord announcement sent successfully!", ephemeral: true });
    } catch (err) {
        logger.error("Error sending Discord announcement:", err);
        await interaction.followUp({ content: `❌ Failed to send Discord announcement: ${err.message}`, ephemeral: true });
    }
}

// --- Email announcement ---
async function sendEmailAnnouncement(interaction, announcement) {
    try {
        await interaction.followUp({ content: "📧 Sending emails...", ephemeral: true });
        await ensureEmailServiceReady();

        const { members } = await googleSheetsService.getMemberEmails();
        if (!members.length) throw new Error("No member emails found");

        const textBody = buildAnnouncementText(announcement);
        const htmlBody = buildAnnouncementHtml(announcement);
        const { results, errors } = await emailService.sendBulkEmail(members, announcement.topic, textBody, htmlBody);

        let resultMsg = `✅ Email sent to ${results.length} recipients`;
        if (errors.length > 0) resultMsg += `\n⚠️ ${errors.length} failed`;

        logger.info(`Email announcement sent: ${results.length} sent, ${errors.length} failed`);
        await interaction.followUp({ content: resultMsg, ephemeral: true });
    } catch (err) {
        logger.error("Error sending email announcement:", err);
        await interaction.followUp({ content: `❌ Failed to send emails: ${err.message}`, ephemeral: true });
    }
}

// --- Slash Command and Handlers ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Create and manage McRoberts Scholars announcements")
        .addStringOption(o => o.setName("topic").setDescription("Topic of the announcement").setRequired(true))
        .addStringOption(o => o.setName("message").setDescription("Announcement content").setRequired(true))
        .addBooleanOption(o => o.setName("ping_everyone").setDescription("Ping @everyone").setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            const topic = interaction.options.getString("topic");
            const message = interaction.options.getString("message");
            const pingEveryone = interaction.options.getBoolean("ping_everyone") || false;
            const announcementId = `${interaction.user.id}-${Date.now()}`;

            pendingAnnouncements.set(announcementId, {
                topic,
                discordContent: message,
                emailContent: message,
                pingEveryone,
                userId: interaction.user.id,
                channelId: config.MEETING_CHANNEL_ID || interaction.channelId,
                timestamp: Date.now()
            });

            await saveAnnouncements();

            const embed = new EmbedBuilder()
                .setTitle("📢 Announcement Control Panel")
                .setColor(0x0099FF)
                .addFields(
                    { name: "Topic", value: topic },
                    { name: "Discord Content", value: message.substring(0, 1024) },
                    { name: "Email Content", value: message.substring(0, 1024) },
                    { name: "Ping Everyone", value: pingEveryone ? "Yes" : "No", inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `ID: ${announcementId.slice(-8)}` });

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`announce_edit_discord_${announcementId}`).setLabel("Edit Discord").setStyle(ButtonStyle.Primary).setEmoji("✏️"),
                    new ButtonBuilder().setCustomId(`announce_edit_email_${announcementId}`).setLabel("Edit Email").setStyle(ButtonStyle.Primary).setEmoji("📝"),
                    new ButtonBuilder().setCustomId(`announce_preview_${announcementId}`).setLabel("Preview").setStyle(ButtonStyle.Secondary).setEmoji("👁️"),
                    new ButtonBuilder().setCustomId(`announce_send_test_${announcementId}`).setLabel("Send Test Email").setStyle(ButtonStyle.Secondary).setEmoji("🧪")
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`announce_send_discord_${announcementId}`).setLabel("Send Discord").setStyle(ButtonStyle.Success).setEmoji("📤"),
                    new ButtonBuilder().setCustomId(`announce_send_email_${announcementId}`).setLabel("Send Email").setStyle(ButtonStyle.Success).setEmoji("📧"),
                    new ButtonBuilder().setCustomId(`announce_send_both_${announcementId}`).setLabel("Send Both").setStyle(ButtonStyle.Success).setEmoji("🚀")
                );

            const row3 = new ActionRowBuilder()
                .addComponents(new ButtonBuilder().setCustomId(`announce_cancel_${announcementId}`).setLabel("Cancel").setStyle(ButtonStyle.Danger).setEmoji("❌"));

            await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });

        } catch (error) {
            logger.error("Error executing announce command:", error);
            await interaction.editReply("❌ An error occurred creating the announcement.");
        }
    },

    async handleButton(interaction) {
        const customId = interaction.customId;
        if (!customId.startsWith("announce_")) return;

        const parts = customId.replace(/^announce_/, "").split("_");
        let action = parts[0], subAction = null, announcementId;

        if (["edit", "send"].includes(action)) {
            subAction = parts[1];
            announcementId = parts.slice(2).join("_");
        } else {
            announcementId = parts.slice(1).join("_");
        }

        const announcement = pendingAnnouncements.get(announcementId);
        if (!announcement) return interaction.reply({ content: "❌ Announcement not found or expired!", ephemeral: true });
        if (announcement.userId !== interaction.user.id) return interaction.reply({ content: "❌ You can only manage your own announcements!", ephemeral: true });

        // --- Actions ---
        if (action === "preview") {
            await interaction.deferReply({ ephemeral: true });

            let logoAttachment = null;
            try { await fs.access(CLUB_LOGO_PATH); logoAttachment = { attachment: CLUB_LOGO_PATH, name: "club-logo.png" }; } catch {}

            const previewEmbed = new EmbedBuilder()
                .setTitle(`📢 ${announcement.topic}`)
                .setDescription(announcement.discordContent)
                .setColor(0x0099FF)
                .setTimestamp()
                .setFooter({ text: `Announced by ${interaction.user.username}` });

            if (logoAttachment) previewEmbed.setThumbnail("attachment://club-logo.png");
            await interaction.editReply({ content: "**Discord Preview:**", embeds: [previewEmbed], files: logoAttachment ? [logoAttachment] : [] });

            const htmlBody = buildAnnouncementHtml(announcement);
            await interaction.followUp({ content: `**Email Preview (HTML):**\n\`\`\`html\n${htmlBody}\n\`\`\``, ephemeral: true });

        } else if (action === "send" && subAction === "test") {
            await interaction.deferReply({ ephemeral: true });
            try {
                await ensureEmailServiceReady();
                await emailService.sendTestEmail(config.GMAIL_USER, announcement.topic, buildAnnouncementText(announcement), buildAnnouncementHtml(announcement));
                await interaction.editReply({ content: `✅ Test email sent to ${config.GMAIL_USER}`, ephemeral: true });
            } catch (err) {
                logger.error("Error sending test email:", err);
                await interaction.editReply({ content: `❌ Failed to send test email: ${err.message}`, ephemeral: true });
            }
        } else if (action === "send") {
            await interaction.deferUpdate();
            if (subAction === "discord" || subAction === "both") await sendDiscordAnnouncement(interaction, announcement);
            if (subAction === "email" || subAction === "both") await sendEmailAnnouncement(interaction, announcement);
        } else if (action === "cancel") {
            pendingAnnouncements.delete(announcementId);
            await saveAnnouncements();
            await interaction.editReply({ content: "❌ Announcement canceled.", embeds: [], components: [] });
        } else if (action === "edit") {
            const modal = new ModalBuilder().setCustomId(`announce_modal_${subAction}_${announcementId}`).setTitle(`Edit ${subAction === "discord" ? "Discord" : "Email"} Content`);
            const input = new TextInputBuilder().setCustomId("content").setLabel(`${subAction === "discord" ? "Discord" : "Email"} Content`).setStyle(TextInputStyle.Paragraph).setValue(subAction === "discord" ? announcement.discordContent : announcement.emailContent).setMaxLength(4000).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
    },

    async handleModal(interaction) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split("_");
        const type = parts[2];
        const announcementId = parts.slice(3).join("_");

        const announcement = pendingAnnouncements.get(announcementId);
        if (!announcement) return interaction.followUp({ content: "❌ Announcement not found!", ephemeral: true });

        const newContent = interaction.fields.getTextInputValue("content");
        if (type === "discord") announcement.discordContent = newContent;
        else announcement.emailContent = newContent;

        await saveAnnouncements();

        const embed = new EmbedBuilder()
            .setTitle("📢 Announcement Control Panel")
            .setColor(0x0099FF)
            .addFields(
                { name: "Topic", value: announcement.topic },
                { name: "Discord Content", value: announcement.discordContent.substring(0, 1024) },
                { name: "Email Content", value: announcement.emailContent.substring(0, 1024) },
                { name: "Ping Everyone", value: announcement.pingEveryone ? "Yes" : "No", inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Updated! | ID: ${announcementId.slice(-8)}` });

        await interaction.editReply({ embeds: [embed], components: interaction.message.components });
    }
};
