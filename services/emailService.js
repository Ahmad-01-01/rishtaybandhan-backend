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
// Kept in step with lib/core/rb_design.dart in the app. The old pale pink
// (#FE7AAC) predates the revamp and no longer matches anything the member
// sees on screen.
// Primary pink: #ED1B6F
// Dark pink:    #C91560
// Soft pink:    #FFEAF1
// Text dark:    #1A1A1A
// Muted text:   #6B6B6B
// ─────────────────────────────────────────────────────────────────────────────
const PINK = "#ED1B6F";
const PINK_DARK = "#C91560";
const PINK_SOFT = "#FFEAF1";
const INK = "#1A1A1A";
const MUTED = "#6B6B6B";

// Hosted logo, generated from the app's own assets/images/app_logo_rounded.png
// (the mark used on the splash screen and in the nav bar) at 240px, which is 3x
// the 80px it renders at.
//
// The filename is versioned on purpose. Mail clients cache images by URL for a
// long time, so overwriting the old branding/app_logo.png would have kept
// serving the pre-revamp logo to anyone who had already received an email.
// Bump the year suffix again if the mark changes.
const LOGO_URL =
  'https://storage.googleapis.com/rishtaybandhan-firebase.firebasestorage.app/branding/app_logo_2026.png';

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
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(237, 27, 111, 0.12);">

          <!-- Header. bgcolor + background-color repeat the pink because
               several clients (older Outlook, some Gmail views) drop the
               gradient and would otherwise render white-on-white. -->
          <tr>
            <td bgcolor="${PINK}" style="background: linear-gradient(135deg, ${PINK} 0%, ${PINK_DARK} 100%); background-color: ${PINK}; padding: 40px 24px 32px; text-align: center;">
              <!-- App Logo -->
              <img src="${LOGO_URL}" alt="Rishtay Bandhan" width="80" height="80" style="display: block; margin: 0 auto 16px; border-radius: 16px;" />
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Rishtay Bandhan</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 13px; font-weight: 400; letter-spacing: 0.5px;">Finding your perfect match</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 32px 16px;">
              <h2 style="color: ${INK}; font-size: 22px; margin: 0 0 20px 0; font-weight: 700;">${title}</h2>
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <div style="border-top: 1px solid #EFE3EA; padding-top: 20px; text-align: center;">
                <p style="font-size: 12px; color: ${MUTED}; margin: 0; line-height: 1.6;">
                  &copy; 2026 Rishtay Bandhan. All rights reserved.<br/>
                  This is an automated message, please do not reply directly.
                </p>
                <div style="margin-top: 12px;">
                  <a href="https://www.instagram.com/rishtaybandhan/" style="color: ${PINK}; text-decoration: none; font-size: 12px; font-weight: 600;">Follow us on Instagram</a>
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

/**
 * @param {string} text Plain-text alternative. Worth passing on every send:
 *   an HTML-only message is a well-known spam signal, and a multipart mail
 *   also renders in clients that block HTML.
 */
async function sendEmail({ to, subject, title, body, text }) {
  const mailOptions = {
    from: `Rishtay Bandhan <${GMAIL_EMAIL}>`,
    to,
    subject,
    html: buildEmailTemplate({ title, body }),
    ...(text ? { text } : {}),
  };
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendEmail,
  // Exported so the templates can be rendered and eyeballed without sending.
  buildEmailTemplate,
  PINK,
  PINK_DARK,
  PINK_SOFT,
  INK,
  MUTED,
};
