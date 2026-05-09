const express = require("express");
const router = express.Router();
const { db, auth } = require("../config/firebase");
const { sendEmail } = require("../services/emailService");

// ─── SEND OTP ────────────────────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

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
      subject: "Your Rishtay Bandhan Verification Code",
      title: "Verify Your Email",
      body: `
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          Use the code below to verify your email address for <strong>${email}</strong>.
        </p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; text-align: center; color: #c0392b; padding: 24px 0; background-color: #fdf2f2; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #999; line-height: 1.5;">
          This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
        </p>
      `,
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
      subject: "Reset your password - Rishtay Bandhan",
      title: "Reset Your Password",
      body: `
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          We received a request to reset the password for your account associated with <strong>${email}</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #c0392b; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
            Reset My Password
          </a>
        </div>
        <p style="font-size: 13px; color: #999; line-height: 1.5;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
        </p>
      `,
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
