// Renders a transactional email to an HTML file so it can be eyeballed without
// sending anything. Nothing here touches nodemailer's transport.
//
//   node scripts/preview-email.js            -> writes preview-gender-correction.html
//
// Requires no .env: buildEmailTemplate only needs the brand constants.

const fs = require("fs");
const path = require("path");
const { buildEmailTemplate } = require("../services/emailService");
const { buildGenderCorrectionEmail } = require("../services/templates/genderCorrection");

const sample = buildGenderCorrectionEmail({
  name: "Sample Member",
  correctedTo: "Female",
});

const html = buildEmailTemplate({ title: sample.title, body: sample.body });
const out = path.join(__dirname, "..", "preview-gender-correction.html");
fs.writeFileSync(out, html, "utf8");

console.log("subject :", sample.subject);
console.log("title   :", sample.title);
console.log("html    :", out, `(${html.length} bytes)`);
console.log("\n--- plain text part ---\n");
console.log(sample.text);
