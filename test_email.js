const nodemailer = require('nodemailer');
require('dotenv').config({ path: './local.env' }); // Explicitly load from local.env

async function sendTestEmail() {
    const testUser = process.env.EMAIL_FROM;
    const testPass = process.env.EMAIL_PASSWORD;
    const recipient = 'your-personal-email@example.com'; // **Change this to a personal email address you can check**

    if (!testUser || !testPass) {
        console.error('ERROR: EMAIL_FROM or EMAIL_PASSWORD not set in environment.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // use STARTTLS
        auth: {
            user: testUser,
            pass: testPass,
        },
        tls: {
            // Do not fail on invalid certs (useful for some environments, though not strictly needed for Gmail usually)
            // This can sometimes help with stubborn connection issues
            rejectUnauthorized: false
        }
    });

    const mailOptions = {
        from: `Test Bot <${testUser}>`,
        to: recipient,
        subject: 'Test Email from Discord Bot Local Script',
        text: 'This is a test email sent from a local script to verify Gmail App Password.',
        html: '<b>This is a test email sent from a local script to verify Gmail App Password.</b>',
        timeout: 15000 // 15 seconds
    };

    try {
        console.log(`Attempting to send test email from ${testUser} to ${recipient}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
    } catch (error) {
        console.error('❌ Failed to send test email:', error);
        if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEOUT') {
            console.error('This is a connection timeout. Double-check your App Password and network.');
        } else if (error.code === 'EAUTH') {
            console.error('Authentication failed. App Password might be incorrect or revoked.');
        }
    }
}

sendTestEmail();