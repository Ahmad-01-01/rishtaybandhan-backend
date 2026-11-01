// PINK and PINK_SOFT are deliberately not pulled in. The brand pink carries the
// header; inside the message it is spent only on the corrected value and on
// links, where PINK_DARK holds its contrast against white far better.
const { PINK_DARK, INK, MUTED } = require("../emailService");

/**
 * Notifies a member that we corrected the gender recorded on their profile.
 *
 * Sent after a human has reviewed the profile in the moderation console and
 * decided the stored value was wrong. Formal register throughout: this is an
 * unrequested change to someone's profile, and it should read as a considered
 * administrative notice rather than a chatty product email.
 *
 * Every send must keep a route back. The member did not ask for this change,
 * so the correction path is stated plainly and without conditions.
 *
 * Returns the { subject, title, body, text } shape that sendEmail expects.
 */
function buildGenderCorrectionEmail({
  name,
  correctedTo,
  contactEmail = "rishtabandhan01@gmail.com",
  instagramUrl = "https://www.instagram.com/rishtaybandhan/",
  reviewedOn = null,
}) {
  if (!name || !correctedTo) {
    throw new Error("name and correctedTo are required");
  }

  const firstName = String(name).trim().split(/\s+/)[0];
  const to = String(correctedTo).trim();
  const other = to.toLowerCase() === "female" ? "Male" : "Female";

  const reviewDate =
    reviewedOn ||
    new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  // Hairlines and label grey, kept local rather than added to the shared brand
  // constants, which are referenced by every other transactional template.
  const RULE = "#E8DFE3";
  const LABEL = "#9A8E94";

  // The change itself is the substance of this email, so it is set as a record
  // rather than described in a sentence: label column, value column, one rule
  // per row. A reader skimming sees what changed without reading any prose.
  const changeRecord = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 0 0 26px;">
      <tr>
        <td colspan="2" style="padding: 0 0 10px; border-bottom: 2px solid ${INK};">
          <span style="font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: ${LABEL}; font-weight: 700;">Record of change</span>
        </td>
      </tr>
      <tr>
        <td width="130" style="padding: 13px 12px 13px 0; border-bottom: 1px solid ${RULE}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${LABEL}; vertical-align: middle;">Profile field</td>
        <td style="padding: 13px 0; border-bottom: 1px solid ${RULE}; font-size: 15px; color: ${INK}; font-weight: 600; vertical-align: middle;">Gender</td>
      </tr>
      <tr>
        <td width="130" style="padding: 13px 12px 13px 0; border-bottom: 1px solid ${RULE}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${LABEL}; vertical-align: middle;">Previously</td>
        <td style="padding: 13px 0; border-bottom: 1px solid ${RULE}; font-size: 15px; color: ${MUTED}; vertical-align: middle;">
          <span style="text-decoration: line-through;">${other}</span>
        </td>
      </tr>
      <tr>
        <td width="130" style="padding: 13px 12px 13px 0; border-bottom: 1px solid ${RULE}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${LABEL}; vertical-align: middle;">Corrected to</td>
        <td style="padding: 13px 0; border-bottom: 1px solid ${RULE}; font-size: 17px; color: ${PINK_DARK}; font-weight: 700; vertical-align: middle;">${to}</td>
      </tr>
      <tr>
        <td width="130" style="padding: 13px 12px 13px 0; border-bottom: 1px solid ${RULE}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${LABEL}; vertical-align: middle;">Reviewed on</td>
        <td style="padding: 13px 0; border-bottom: 1px solid ${RULE}; font-size: 15px; color: ${INK}; vertical-align: middle;">${reviewDate}</td>
      </tr>
    </table>
  `;

  const subject = "An important update regarding your Rishtay Bandhan profile";
  const title = "A correction to your profile";

  const body = `
    <p style="font-size: 15px; color: ${MUTED}; line-height: 1.7; margin: 0 0 18px;">
      Hi <strong style="color: ${INK};">${firstName}</strong>,
    </p>

    <p style="font-size: 15px; color: ${MUTED}; line-height: 1.7; margin: 0 0 18px;">
      At Rishtay Bandhan we conduct regular quality reviews of member profiles.
      Maintaining accurate and genuine profiles is central to the service we
      provide, and it is what allows our members to meet one another with
      confidence.
    </p>

    <p style="font-size: 15px; color: ${MUTED}; line-height: 1.7; margin: 0 0 26px;">
      During a recent review, your profile was flagged because the gender
      recorded on it did not align with the remainder of your profile details.
      We have treated this as an error made at the time of registration and have
      corrected it on your behalf.
    </p>

    ${changeRecord}

    <p style="font-size: 15px; color: ${MUTED}; line-height: 1.7; margin: 0 0 18px;">
      This setting determines which members your profile is shown to, and which
      profiles are shown to you. For as long as the incorrect value remained in
      place, your profile was being presented to the wrong members, and those
      you are seeking were unable to find you. That is the reason the correction
      could not be left to stand.
    </p>

    <p style="font-size: 15px; color: ${MUTED}; line-height: 1.7; margin: 0 0 18px;">
      Should you have any queries regarding this change, or should you wish to
      have it reversed, please write to us at
      <a href="mailto:${contactEmail}" style="color: ${PINK_DARK}; text-decoration: underline; font-weight: 600;">${contactEmail}</a>
      and we will attend to it promptly. You may also amend the setting yourself
      at any time from Edit Profile within the app.
    </p>

    <p style="font-size: 15px; color: ${MUTED}; line-height: 1.7; margin: 0 0 26px;">
      No other part of your profile has been altered. Your photographs, personal
      details, matches and conversations remain exactly as you left them. All
      such reviews are carried out internally by our own team and are held in
      strict confidence.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; border-top: 1px solid ${RULE}; margin: 0 0 4px;">
      <tr>
        <td style="padding: 22px 0 0;">
          <p style="font-size: 15px; color: ${MUTED}; line-height: 1.7; margin: 0 0 18px;">
            Thank you for placing your trust in Rishtay Bandhan. We are grateful
            to have you as a member, and we remain committed to keeping this a
            safe and genuine place to find the right match.
          </p>
          <p style="font-size: 15px; color: ${INK}; line-height: 1.7; margin: 0 0 4px;">
            Warm regards,
          </p>
          <p style="font-size: 15px; color: ${INK}; line-height: 1.7; margin: 0 0 20px; font-weight: 700;">
            The Rishtay Bandhan Team
          </p>
          <p style="font-size: 13px; color: ${LABEL}; line-height: 1.6; margin: 0;">
            Stay tuned for more updates. We announce new features at
            <a href="${instagramUrl}" style="color: ${PINK_DARK}; text-decoration: underline;">@rishtaybandhan</a>.
          </p>
        </td>
      </tr>
    </table>
  `;

  const text =
    `Hi ${firstName},\n\n` +
    `At Rishtay Bandhan we conduct regular quality reviews of member profiles. ` +
    `Maintaining accurate and genuine profiles is central to the service we ` +
    `provide, and it is what allows our members to meet one another with ` +
    `confidence.\n\n` +
    `During a recent review, your profile was flagged because the gender ` +
    `recorded on it did not align with the remainder of your profile details. ` +
    `We have treated this as an error made at the time of registration and have ` +
    `corrected it on your behalf.\n\n` +
    `RECORD OF CHANGE\n` +
    `  Profile field   Gender\n` +
    `  Previously      ${other}\n` +
    `  Corrected to    ${to}\n` +
    `  Reviewed on     ${reviewDate}\n\n` +
    `This setting determines which members your profile is shown to, and which ` +
    `profiles are shown to you. For as long as the incorrect value remained in ` +
    `place, your profile was being presented to the wrong members, and those ` +
    `you are seeking were unable to find you. That is the reason the correction ` +
    `could not be left to stand.\n\n` +
    `Should you have any queries regarding this change, or should you wish to ` +
    `have it reversed, please write to us at ${contactEmail} and we will attend ` +
    `to it promptly. You may also amend the setting yourself at any time from ` +
    `Edit Profile within the app.\n\n` +
    `No other part of your profile has been altered. Your photographs, personal ` +
    `details, matches and conversations remain exactly as you left them. All ` +
    `such reviews are carried out internally by our own team and are held in ` +
    `strict confidence.\n\n` +
    `Thank you for placing your trust in Rishtay Bandhan. We are grateful to ` +
    `have you as a member, and we remain committed to keeping this a safe and ` +
    `genuine place to find the right match.\n\n` +
    `Warm regards,\n` +
    `The Rishtay Bandhan Team\n\n` +
    `Stay tuned for more updates. We announce new features at @rishtaybandhan: ` +
    `${instagramUrl}`;

  return { subject, title, body, text };
}

module.exports = { buildGenderCorrectionEmail };
