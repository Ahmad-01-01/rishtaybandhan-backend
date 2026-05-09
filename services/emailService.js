const nodemailer = require("nodemailer");

const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_EMAIL,
    pass: GMAIL_APP_PASSWORD,
  },
});

// ─── BRANDED EMAIL TEMPLATE ─────────────────────────────────────────────────
function buildEmailTemplate({ title, body }) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: auto; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #c0392b, #e74c3c); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Rishtay Bandhan</h1>
        <p style="color: #f5c6cb; margin: 8px 0 0 0; font-size: 13px;">Finding your perfect match</p>
      </div>
      <div style="padding: 32px 24px; border: 1px solid #f0f0f0; border-top: none;">
        <h2 style="color: #333; font-size: 20px; margin-top: 0;">${title}</h2>
        ${body}
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0;" />
        <p style="font-size: 12px; color: #bbb; text-align: center; margin-bottom: 0;">
          &copy; 2025 Rishtay Bandhan. All rights reserved.<br/>
          This is an automated message, please do not reply directly.
        </p>
      </div>
    </div>
  `;
}

async function sendEmail({ to, subject, title, body }) {
  const mailOptions = {
    from: `Rishtay Bandhan <${GMAIL_EMAIL}>`,
    to,
    subject,
    html: buildEmailTemplate({ title, body }),
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendEmail };
