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

// ─── BRAND COLORS ───────────────────────────────────────────────────────────
// Primary pink: #FE7AAC
// Dark pink:    #E8609A
// Light pink:   #FFF3F7
// Text dark:    #2C2C2C
// ─────────────────────────────────────────────────────────────────────────────

// Hosted logo URL (app_logo.png uploaded to Firebase Storage)
const LOGO_URL = 'https://storage.googleapis.com/rishtaybandhan-firebase.firebasestorage.app/branding/app_logo.png';

function buildEmailTemplate({ title, body }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f4f6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(254, 122, 172, 0.12);">

          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #FE7AAC 0%, #FF9AC2 50%, #FE7AAC 100%); padding: 40px 24px 32px; text-align: center;">
              <!-- App Logo -->
              <img src="${LOGO_URL}" alt="Rishtay Bandhan" width="80" height="80" style="display: block; margin: 0 auto 16px; border-radius: 16px;" />
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">Rishtay Bandhan</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 13px; font-weight: 400; letter-spacing: 0.5px;">Finding your perfect match</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 32px 16px;">
              <h2 style="color: #2C2C2C; font-size: 22px; margin: 0 0 20px 0; font-weight: 700;">${title}</h2>
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <div style="border-top: 1px solid #f0e4ea; padding-top: 20px; text-align: center;">
                <p style="font-size: 12px; color: #c4a0b3; margin: 0; line-height: 1.6;">
                  &copy; 2026 Rishtay Bandhan. All rights reserved.<br/>
                  This is an automated message, please do not reply directly.
                </p>
                <div style="margin-top: 12px;">
                  <a href="https://www.instagram.com/rishtaybandhan/" style="color: #FE7AAC; text-decoration: none; font-size: 12px; font-weight: 500;">Follow us on Instagram</a>
                </div>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
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
