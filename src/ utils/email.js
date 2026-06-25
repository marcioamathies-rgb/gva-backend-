const nodemailer = require('nodemailer');

function transport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendLockoutAlert({ role, attemptedId, recipientEmail }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] SMTP not configured — skipping alert.');
    return;
  }
  await transport().sendMail({
    from:    `"GVA Security" <${process.env.SMTP_USER}>`,
    to:      recipientEmail,
    subject: `⚠️ GVA — 3 Failed Login Attempts on ${role} Account`,
    html: `
      <h2 style="color:#0B3960;">GVA Security Alert</h2>
      <p>3 consecutive failed login attempts were detected.</p>
      <p><strong>Account type:</strong> ${role}</p>
      <p><strong>Attempted ID:</strong> ${attemptedId || 'Unknown'}</p>
      <p><strong>Time:</strong> ${new Date().toUTCString()}</p>
      <hr>
      <p>To reset the password, log into your server shell and run:<br>
      <code>npm run resetAdmin</code></p>
      <p style="color:#888;font-size:12px;">GVA Membership System — automated alert</p>
    `,
  });
  console.log(`[email] Lockout alert sent to ${recipientEmail}`);
}

module.exports = { sendLockoutAlert };
