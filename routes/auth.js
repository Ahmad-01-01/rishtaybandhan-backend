const express = require("express");
const router = express.Router();
const { db, auth } = require("../config/firebase");
const {
  sendEmail,
  PINK,
  PINK_DARK,
  PINK_SOFT,
  INK,
  MUTED,
} = require("../services/emailService");

// ─── SEND OTP ────────────────────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Reject addresses that already have an account. Only the server can
    // check this: Firestore rules require sign-in, and the client-side
    // fetchSignInMethodsForEmail API is deprecated. Doing it here also means
    // the user is told BEFORE waiting on a verification code.
    try {
      await auth.getUserByEmail(email);
      return res.status(409).json({
        error: "email-exists",
        message: "An account with this email already exists. Please sign in.",
      });
    } catch (err) {
      if (err.code !== "auth/user-not-found") throw err;
      // Not found is the happy path for signup — carry on.
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store in Firestore
    await db.collection("otp_codes").doc(email).set({
      otp,
      expiresAt,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });

    // Send branded email
    await sendEmail({
      to: email,
      subject: `${otp} is your Rishtay Bandhan verification code`,
      title: "Verify your email",
      body: `
        <p style="font-size: 15px; color: ${MUTED}; line-height: 1.6;">
          Use the code below to verify <strong style="color: ${INK};">${email}</strong>.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background-color: ${PINK_SOFT}; border: 2px solid ${PINK}; border-radius: 12px; padding: 20px 36px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: ${PINK_DARK}; font-family: 'Courier New', monospace;">${otp}</span>
          </div>
        </div>
        <p style="font-size: 13px; color: ${MUTED}; line-height: 1.5; text-align: center;">
          This code expires in <strong>10 minutes</strong>.<br/>Do not share it with anyone.
        </p>
      `,
      text:
        `Your Rishtay Bandhan verification code is ${otp}.\n\n` +
        `It verifies the email address ${email} and expires in 10 minutes.\n` +
        `Do not share this code with anyone.\n\n` +
        `If you did not request it, you can ignore this email.`,
    });

    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ─── VERIFY OTP ──────────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const doc = await db.collection("otp_codes").doc(email).get();
    if (!doc.exists) {
      return res.json({ success: false, message: "No OTP found. Please request a new one." });
    }

    const otpData = doc.data();

    // Brute force protection
    if (otpData.attempts >= 5) {
      await db.collection("otp_codes").doc(email).delete();
      return res.json({ success: false, message: "Too many attempts. Please request a new OTP." });
    }

    // Expiry check
    if (Date.now() > otpData.expiresAt) {
      await db.collection("otp_codes").doc(email).delete();
      return res.json({ success: false, message: "OTP expired. Please request a new one." });
    }

    // Match check
    if (otp.trim() !== otpData.otp) {
      await db.collection("otp_codes").doc(email).update({
        attempts: otpData.attempts + 1,
      });
      return res.json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // Verified — clean up
    await db.collection("otp_codes").doc(email).delete();
    return res.json({ success: true, message: "OTP verified successfully" });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// ─── SEND PASSWORD RESET EMAIL ──────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Generate reset link via Firebase Admin SDK
    const resetLink = await auth.generatePasswordResetLink(email);

    // Send branded email
    await sendEmail({
      to: email,
      subject: "Reset your Rishtay Bandhan password",
      title: "Reset your password",
      body: `
        <p style="font-size: 15px; color: ${MUTED}; line-height: 1.6;">
          We received a request to reset the password for <strong style="color: ${INK};">${email}</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" bgcolor="${PINK}" style="background: linear-gradient(135deg, ${PINK}, ${PINK_DARK}); background-color: ${PINK}; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 16px; font-weight: 700; display: inline-block; letter-spacing: 0.3px;">
            Reset my password
          </a>
        </div>
        <p style="font-size: 13px; color: ${MUTED}; line-height: 1.5; text-align: center;">
          This link expires in <strong>1 hour</strong>. If you didn't ask for it,<br/>you can safely ignore this email — nothing will change.
        </p>
        <p style="font-size: 12px; color: ${MUTED}; line-height: 1.5; word-break: break-all;">
          Button not working? Paste this into your browser:<br/>
          <a href="${resetLink}" style="color: ${PINK};">${resetLink}</a>
        </p>
      `,
      text:
        `We received a request to reset the password for ${email}.\n\n` +
        `Open this link to choose a new password (expires in 1 hour):\n` +
        `${resetLink}\n\n` +
        `If you didn't ask for this, ignore this email and nothing will change.`,
    });

    return res.json({ success: true, message: "Password reset email sent" });
  } catch (err) {
    console.error("Error sending reset email:", err);
    if (err.code === "auth/user-not-found") {
      return res.status(404).json({ error: "No account found with this email" });
    }
    return res.status(500).json({ error: "Failed to send reset email" });
  }
});

module.exports = router;
