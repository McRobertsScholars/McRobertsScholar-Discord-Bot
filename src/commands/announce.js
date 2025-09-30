// McRoberts Scholars Announcement System
// Complete Discord bot with email integration and persistence

const { 
    Client, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    StringSelectMenuBuilder
} = require('discord.js');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Configuration
const CONFIG = {
    // Email configuration
    EMAIL: {
        FROM: process.env.EMAIL_FROM || 'McRoberts Scholars <scholars@mcroberts.edu>',
        REPLY_TO: process.env.EMAIL_REPLY_TO || 'scholars@mcroberts.edu',
        BCC_LIMIT: 100, // Gmail BCC limit
        TEST_EMAIL: process.env.TEST_EMAIL || 'tadjellcraft@gmail.com'
    },
    
    // SMTP configuration
    SMTP: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    },
    
    // Storage configuration
    STORAGE: {
        DIR: process.env.STORAGE_DIR || './announcements',
        EXPIRY_DAYS: 30
    },
    
    // Discord configuration
    DISCORD: {
        ANNOUNCEMENT_ROLE: process.env.ANNOUNCEMENT_ROLE || 'McRoberts Scholar',
        ADMIN_ROLES: ['Administrator', 'Moderator', 'Executive'],
        DEFAULT_COLOR: 0x2B2D31
    }
};

// Initialize email transporter
const emailTransporter = nodemailer.createTransport(CONFIG.SMTP);

// Announcement storage class
class AnnouncementStore {
    constructor() {
        this.storageDir = CONFIG.STORAGE.DIR;
        this.ensureStorageDir();
    }

    async ensureStorageDir() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create storage directory:', error);
        }
    }

    generateId() {
        return `ann_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    getFilePath(id) {
        return path.join(this.storageDir, `${id}.json`);
    }

    async save(announcement) {
        try {
            const filePath = this.getFilePath(announcement.id);
            await fs.writeFile(filePath, JSON.stringify(announcement, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save announcement:', error);
            return false;
        }
    }

    async load(id) {
        try {
            const filePath = this.getFilePath(id);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Failed to load announcement ${id}:`, error);
            return null;
        }
    }

    async delete(id) {
        try {
            const filePath = this.getFilePath(id);
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error(`Failed to delete announcement ${id}:`, error);
            return false;
        }
    }

    async list() {
        try {
            const files = await fs.readdir(this.storageDir);
            const announcements = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const id = file.replace('.json', '');
                    const announcement = await this.load(id);
                    if (announcement) {
                        announcements.push(announcement);
                    }
                }
            }
            
            return announcements.sort((a, b) => b.createdAt - a.createdAt);
        } catch (error) {
            console.error('Failed to list announcements:', error);
            return [];
        }
    }

    async cleanup() {
        try {
            const expiryDate = Date.now() - (CONFIG.STORAGE.EXPIRY_DAYS * 24 * 60 * 60 * 1000);
            const announcements = await this.list();
            let deleted = 0;
            
            for (const announcement of announcements) {
                if (announcement.createdAt < expiryDate && announcement.sent) {
                    await this.delete(announcement.id);
                    deleted++;
                }
            }
            
            console.log(`Cleaned up ${deleted} expired announcements`);
            return deleted;
        } catch (error) {
            console.error('Cleanup failed:', error);
            return 0;
        }
    }
}

// Email service class
class EmailService {
    constructor() {
        this.transporter = emailTransporter;
    }

    generateEmailHTML(announcement) {
        const { title, content, author, footer } = announcement;
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">McRoberts Scholars</h1>
            <p style="margin: 10px 0 0 0; color: #ffffff; opacity: 0.9; font-size: 14px;">Excellence in Education • Community • Leadership</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">
                ${this.escapeHtml(title)}
            </h2>
            
            <div style="color: #555555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                ${this.formatContent(content)}
            </div>
            
            ${footer ? `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="color: #777777; font-size: 14px; margin: 0;">
                    ${this.escapeHtml(footer)}
                </p>
            </div>
            ` : ''}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 10px 0; color: #666666; font-size: 12px;">
                This announcement was sent by ${this.escapeHtml(author)} via the McRoberts Scholars announcement system.
            </p>
            <p style="margin: 0; color: #999999; font-size: 11px;">
                © ${new Date().getFullYear()} McRoberts Scholars. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    formatContent(content) {
        // Convert markdown-style formatting to HTML
        let formatted = this.escapeHtml(content);
        
        // Convert line breaks to paragraphs
        formatted = formatted.split('\n\n').map(para => 
            `<p style="margin: 0 0 15px 0;">${para.replace(/\n/g, '<br>')}</p>`
        ).join('');
        
        // Convert **bold** to <strong>
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert *italic* to <em>
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert [text](url) to links
        formatted = formatted.replace(/$$([^$$]+)\]([^)]+)/g, 
            '<a href="$2" style="color: #667eea; text-decoration: none;">$1</a>');
        
        return formatted;
    }

    async sendBulkEmail(announcement, recipients) {
        const results = { success: 0, failed: 0, errors: [] };
        
        // Split recipients into chunks for BCC limit
        const chunks = [];
        for (let i = 0; i < recipients.length; i += CONFIG.EMAIL.BCC_LIMIT) {
            chunks.push(recipients.slice(i, i + CONFIG.EMAIL.BCC_LIMIT));
        }
        
        for (const chunk of chunks) {
            try {
                const info = await this.transporter.sendMail({
                    from: CONFIG.EMAIL.FROM,
                    replyTo: CONFIG.EMAIL.REPLY_TO,
                    bcc: chunk,
                    subject: `[McRoberts Scholars] ${announcement.title}`,
                    html: this.generateEmailHTML(announcement),
                    text: this.generatePlainText(announcement)
                });
                
                results.success += chunk.length;
                console.log(`Email batch sent successfully: ${info.messageId}`);
            } catch (error) {
                results.failed += chunk.length;
                results.errors.push(error.message);
                console.error('Email batch failed:', error);
            }
        }
        
        return results;
    }

    async sendTestEmail(announcement, testEmail) {
        try {
            const info = await this.transporter.sendMail({
                from: CONFIG.EMAIL.FROM,
                replyTo: CONFIG.EMAIL.REPLY_TO,
                to: testEmail,
                subject: `[TEST] [McRoberts Scholars] ${announcement.title}`,
                html: this.generateEmailHTML(announcement),
                text: this.generatePlainText(announcement)
            });
            
            console.log(`Test email sent successfully: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Test email failed:', error);
            return { success: false, error: error.message };
        }
    }

    generatePlainText(announcement) {
        const { title, content, author, footer } = announcement;
        let text = `McRoberts Scholars Announcement\n`;
        text += `================================\n\n`;
        text += `${title}\n\n`;
        text += `${content}\n\n`;
        if (footer) {
            text += `---\n${footer}\n\n`;
        }
        text += `Sent by ${author} via the McRoberts Scholars announcement system.\n`;
        return text;
    }
}

// Main announcement handler class
class AnnouncementHandler {
    constructor(client) {
        this.client = client;
        this.store = new AnnouncementStore();
        this.emailService = new EmailService();
        this.activeAnnouncements = new Map();
        
        // Start cleanup scheduler
        this.scheduleCleanup();
    }

    scheduleCleanup() {
        // Run cleanup daily
        setInterval(() => {
            this.store.cleanup();
        }, 24 * 60 * 60 * 1000);
        
        // Initial cleanup
        this.store.cleanup();
    }

    async handleSlashCommand(interaction) {
        try {
            // Check permissions
            if (!this.hasPermission(interaction.member)) {
                await interaction.reply({
                    content: '❌ You do not have permission to create announcements.',
                    ephemeral: true
                });
                return;
            }

            // Defer reply immediately to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            // Create new announcement
            const announcement = {
                id: this.store.generateId(),
                title: '',
                content: '',
                footer: '',
                channelId: null,
                emailList: [],
                author: interaction.user.tag,
                authorId: interaction.user.id,
                createdAt: Date.now(),
                sent: false,
                sendToDiscord: true,
                sendToEmail: true
            };

            // Save initial announcement
            await this.store.save(announcement);
            this.activeAnnouncements.set(interaction.user.id, announcement.id);

            // Create initial embed
            const embed = this.createAnnouncementEmbed(announcement);
            const components = this.createAnnouncementComponents(announcement);

            await interaction.editReply({
                content: '📢 **Create New Announcement**',
                embeds: [embed],
                components: components
            });
        } catch (error) {
            console.error('Error handling slash command:', error);
            const errorMsg = '❌ An error occurred while creating the announcement.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMsg });
            } else {
                await interaction.reply({ content: errorMsg, ephemeral: true });
            }
        }
    }

    async handleButtonInteraction(interaction) {
        try {
            // Defer update immediately
            await interaction.deferUpdate();

            const [action, announcementId] = interaction.customId.split('_');
            
            // Load announcement
            const announcement = await this.store.load(announcementId);
            if (!announcement) {
                await interaction.followUp({
                    content: '❌ Announcement not found.',
                    ephemeral: true
                });
                return;
            }

            // Check ownership
            if (announcement.authorId !== interaction.user.id) {
                await interaction.followUp({
                    content: '❌ You can only modify your own announcements.',
                    ephemeral: true
                });
                return;
            }

            // Handle different actions
            switch (action) {
                case 'edit':
                    await this.showEditModal(interaction, announcement);
                    break;
                    
                case 'preview':
                    await this.showPreview(interaction, announcement);
                    break;
                    
                case 'send':
                    await this.sendAnnouncement(interaction, announcement);
                    break;
                    
                case 'cancel':
                    await this.cancelAnnouncement(interaction, announcement);
                    break;
                    
                case 'test':
                    await this.sendTestEmail(interaction, announcement);
                    break;
                    
                case 'channel':
                    await this.showChannelSelect(interaction, announcement);
                    break;
                    
                case 'toggleDiscord':
                    announcement.sendToDiscord = !announcement.sendToDiscord;
                    await this.updateAnnouncement(interaction, announcement);
                    break;
                    
                case 'toggleEmail':
                    announcement.sendToEmail = !announcement.sendToEmail;
                    await this.updateAnnouncement(interaction, announcement);
                    break;
                    
                default:
                    await interaction.followUp({
                        content: '❌ Unknown action.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            await interaction.followUp({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
            });
        }
    }

    async showEditModal(interaction, announcement) {
        const modal = new ModalBuilder()
            .setCustomId(`modal_${announcement.id}`)
            .setTitle('Edit Announcement');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Announcement Title')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter announcement title...')
            .setRequired(true)
            .setMaxLength(100)
            .setValue(announcement.title || '');

        const contentInput = new TextInputBuilder()
            .setCustomId('content')
            .setLabel('Announcement Content')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter announcement content...')
            .setRequired(true)
            .setMaxLength(2000)
            .setValue(announcement.content || '');

        const footerInput = new TextInputBuilder()
            .setCustomId('footer')
            .setLabel('Footer (Optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Optional footer text...')
            .setRequired(false)
            .setMaxLength(100)
            .setValue(announcement.footer || '');

        const emailInput = new TextInputBuilder()
            .setCustomId('emails')
            .setLabel('Email Recipients (comma-separated)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('email1@example.com, email2@example.com')
            .setRequired(false)
            .setMaxLength(1000)
            .setValue(announcement.emailList.join(', '));

        const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
        const secondActionRow = new ActionRowBuilder().addComponents(contentInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(footerInput);
        const fourthActionRow = new ActionRowBuilder().addComponents(emailInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

        await interaction.showModal(modal);
    }

    async handleModalSubmit(interaction) {
        try {
            // Defer update immediately
            await interaction.deferUpdate();

            const announcementId = interaction.customId.split('_')[1];
            const announcement = await this.store.load(announcementId);

            if (!announcement) {
                await interaction.followUp({
                    content: '❌ Announcement not found.',
                    ephemeral: true
                });
                return;
            }

            // Update announcement with modal data
            announcement.title = interaction.fields.getTextInputValue('title');
            announcement.content = interaction.fields.getTextInputValue('content');
            announcement.footer = interaction.fields.getTextInputValue('footer') || '';
            
            const emailsRaw = interaction.fields.getTextInputValue('emails') || '';
            announcement.emailList = emailsRaw
                .split(',')
                .map(email => email.trim())
                .filter(email => this.isValidEmail(email));

            // Save updated announcement
            await this.store.save(announcement);

            // Update the message
            const embed = this.createAnnouncementEmbed(announcement);
            const components = this.createAnnouncementComponents(announcement);

            await interaction.editReply({
                embeds: [embed],
                components: components
            });
        } catch (error) {
            console.error('Error handling modal submit:', error);
            await interaction.followUp({
                content: '❌ An error occurred while saving your changes.',
                ephemeral: true
            });
        }
    }

    async showChannelSelect(interaction, announcement) {
        const channels = interaction.guild.channels.cache
            .filter(ch => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)
            .map(ch => ({
                label: `#${ch.name}`,
                value: ch.id,
                description: ch.topic ? ch.topic.substring(0, 100) : 'No description',
                default: ch.id === announcement.channelId
            }))
            .slice(0, 25); // Discord limit

        if (channels.length === 0) {
            await interaction.followUp({
                content: '❌ No text channels available.',
                ephemeral: true
            });
            return;
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_${announcement.id}`)
            .setPlaceholder('Select a channel for the announcement')
            .addOptions(channels);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.followUp({
            content: '📌 **Select Announcement Channel:**',
            components: [row],
            ephemeral: true
        });
    }

    async handleSelectMenu(interaction) {
        try {
            await interaction.deferUpdate();

            const announcementId = interaction.customId.split('_')[1];
            const announcement = await this.store.load(announcementId);

            if (!announcement) {
                await interaction.followUp({
                    content: '❌ Announcement not found.',
                    ephemeral: true
                });
                return;
            }

            announcement.channelId = interaction.values[0];
            await this.store.save(announcement);

            // Update main message
            const embed = this.createAnnouncementEmbed(announcement);
            const components = this.createAnnouncementComponents(announcement);

            await interaction.message.edit({
                embeds: [embed],
                components: components
            });

            // Delete the select menu message
            await interaction.deleteReply();
        } catch (error) {
            console.error('Error handling select menu:', error);
            await interaction.followUp({
                content: '❌ An error occurred while selecting the channel.',
                ephemeral: true
            });
        }
    }

    async showPreview(interaction, announcement) {
        if (!announcement.title || !announcement.content) {
            await interaction.followUp({
                content: '❌ Please add a title and content before previewing.',
                ephemeral: true
            });
            return;
        }

        // Discord preview
        const discordEmbed = new EmbedBuilder()
            .setTitle(announcement.title)
            .setDescription(announcement.content)
            .setColor(CONFIG.DISCORD.DEFAULT_COLOR)
            .setAuthor({
                name: 'McRoberts Scholars',
                iconURL: interaction.guild.iconURL()
            })
            .setTimestamp();

        if (announcement.footer) {
            discordEmbed.setFooter({ text: announcement.footer });
        }

        // Email preview (truncated)
        const emailPreview = this.emailService.generateEmailHTML(announcement);
        const emailPreviewText = emailPreview
            .replace(/<[^>]*>/g, '')
            .substring(0, 500) + '...';

        await interaction.followUp({
            content: '**📋 Announcement Preview**\n\n**Discord Preview:**',
            embeds: [discordEmbed],
            ephemeral: true
        });

        await interaction.followUp({
            content: `**Email Preview (Text):**\n\`\`\`\n${emailPreviewText}\n\`\`\``,
            ephemeral: true
        });
    }

    async sendTestEmail(interaction, announcement) {
        if (!announcement.title || !announcement.content) {
            await interaction.followUp({
                content: '❌ Please add a title and content before sending a test email.',
                ephemeral: true
            });
            return;
        }

        await interaction.followUp({
            content: '📧 Sending test email...',
            ephemeral: true
        });

        const result = await this.emailService.sendTestEmail(
            announcement,
            CONFIG.EMAIL.TEST_EMAIL
        );

        if (result.success) {
            await interaction.followUp({
                content: `✅ Test email sent successfully to ${CONFIG.EMAIL.TEST_EMAIL}`,
                ephemeral: true
            });
        } else {
            await interaction.followUp({
                content: `❌ Failed to send test email: ${result.error}`,
                ephemeral: true
            });
        }
    }

    async sendAnnouncement(interaction, announcement) {
        // Validation
        if (!announcement.title || !announcement.content) {
            await interaction.followUp({
                content: '❌ Please add a title and content before sending.',
                ephemeral: true
            });
            return;
        }

        if (announcement.sendToDiscord && !announcement.channelId) {
            await interaction.followUp({
                content: '❌ Please select a Discord channel before sending.',
                ephemeral: true
            });
            return;
        }

        if (announcement.sendToEmail && announcement.emailList.length === 0) {
            await interaction.followUp({
                content: '❌ Please add email recipients before sending.',
                ephemeral: true
            });
            return;
        }

        if (!announcement.sendToDiscord && !announcement.sendToEmail) {
            await interaction.followUp({
                content: '❌ Please enable at least one sending method (Discord or Email).',
                ephemeral: true
            });
            return;
        }

        await interaction.followUp({
            content: '📤 Sending announcement...',
            ephemeral: true
        });

        let discordSuccess = !announcement.sendToDiscord;
        let emailResults = null;

        // Send to Discord
        if (announcement.sendToDiscord) {
            try {
                const channel = await this.client.channels.fetch(announcement.channelId);
                const embed = new EmbedBuilder()
                    .setTitle(announcement.title)
                    .setDescription(announcement.content)
                    .setColor(CONFIG.DISCORD.DEFAULT_COLOR)
                    .setAuthor({
                        name: 'McRoberts Scholars',
                        iconURL: interaction.guild.iconURL()
                    })
                    .setTimestamp();

                if (announcement.footer) {
                    embed.setFooter({ text: announcement.footer });
                }

                await channel.send({
                    content: `@everyone`,
                    embeds: [embed]
                });
                discordSuccess = true;
            } catch (error) {
                console.error('Failed to send Discord announcement:', error);
                discordSuccess = false;
            }
        }

        // Send emails
        if (announcement.sendToEmail && announcement.emailList.length > 0) {
            emailResults = await this.emailService.sendBulkEmail(
                announcement,
                announcement.emailList
            );
        }

        // Mark as sent and save
        announcement.sent = true;
        announcement.sentAt = Date.now();
        await this.store.save(announcement);

        // Prepare result message
        let resultMsg = '📊 **Announcement Send Results:**\n\n';
        
        if (announcement.sendToDiscord) {
            resultMsg += discordSuccess 
                ? '✅ Discord: Sent successfully\n' 
                : '❌ Discord: Failed to send\n';
        }
        
        if (announcement.sendToEmail && emailResults) {
            resultMsg += `📧 Email: ${emailResults.success} sent, ${emailResults.failed} failed\n`;
            if (emailResults.errors.length > 0) {
                resultMsg += `Errors: ${emailResults.errors.join(', ')}\n`;
            }
        }

        await interaction.followUp({
            content: resultMsg,
            ephemeral: true
        });

        // Update the original message to show sent status
        const embed = this.createAnnouncementEmbed(announcement);
        await interaction.editReply({
            content: '✅ **Announcement Sent Successfully!**',
            embeds: [embed],
            components: [] // Remove buttons after sending
        });
    }

    async cancelAnnouncement(interaction, announcement) {
        await this.store.delete(announcement.id);
        this.activeAnnouncements.delete(interaction.user.id);

        await interaction.editReply({
            content: '❌ Announcement cancelled and deleted.',
            embeds: [],
            components: []
        });
    }

    async updateAnnouncement(interaction, announcement) {
        await this.store.save(announcement);
        
        const embed = this.createAnnouncementEmbed(announcement);
        const components = this.createAnnouncementComponents(announcement);

        await interaction.editReply({
            embeds: [embed],
            components: components
        });
    }

    createAnnouncementEmbed(announcement) {
        const embed = new EmbedBuilder()
            .setTitle('📢 Announcement Draft')
            .setColor(announcement.sent ? 0x00ff00 : 0xffff00)
            .setTimestamp();

        // Add fields
        embed.addFields(
            {
                name: 'Title',
                value: announcement.title || '*Not set*',
                inline: false
            },
            {
                name: 'Content',
                value: announcement.content ? 
                    (announcement.content.substring(0, 500) + 
                    (announcement.content.length > 500 ? '...' : '')) : 
                    '*Not set*',
                inline: false
            }
        );

        if (announcement.footer) {
            embed.addFields({
                name: 'Footer',
                value: announcement.footer,
                inline: false
            });
        }

        // Status fields
        embed.addFields(
            {
                name: 'Discord Channel',
                value: announcement.channelId ? 
                    `<#${announcement.channelId}>` : 
                    '*Not selected*',
                inline: true
            },
            {
                name: 'Email Recipients',
                value: announcement.emailList.length > 0 ? 
                    `${announcement.emailList.length} recipients` : 
                    '*None*',
                inline: true
            },
            {
                name: 'Status',
                value: announcement.sent ? 
                    '✅ Sent' : 
                    '📝 Draft',
                inline: true
            }
        );

        embed.addFields(
            {
                name: 'Send to Discord',
                value: announcement.sendToDiscord ? '✅ Yes' : '❌ No',
                inline: true
            },
            {
                name: 'Send to Email',
                value: announcement.sendToEmail ? '✅ Yes' : '❌ No',