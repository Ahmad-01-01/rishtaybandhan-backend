require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Initialize Firebase (must be first)
require("./config/firebase");

// Import routes
const authRoutes = require("./routes/auth");
const imageRoutes = require("./routes/images");

const app = express();
app.use(cors());
app.use(express.json());

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);     // /api/auth/send-otp, /api/auth/verify-otp, /api/auth/reset-password
app.use("/api", imageRoutes);         // /api/upload-pictures, /api/upload-profile-pic, etc.

// Health check
app.get("/", (req, res) => res.send("Rishtay Bandhan API running"));

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
