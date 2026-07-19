const express = require("express");
const router = express.Router();
const { admin, db } = require("../config/firebase");

/**
 * POST /api/notify
 *
 * Sends a push notification the moment a like / match / message happens
 * (called directly by the app, so it's low latency, no Firestore-trigger hop).
 *
 * This backend is deployed per environment (dev branch -> dev project, main ->
 * prod), so it just uses its own project's credentials and Firestore. FCM
 * tokens are project-scoped and match the app talking to this deployment.
 *
 * Auth: caller must send a valid Firebase ID token as `Authorization: Bearer`.
 * Body: { toUid, title, body, type }
 */
router.post("/notify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    if (!idToken) return res.status(401).json({ error: "missing token" });

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: "invalid token" });
    }
    const fromUid = decoded.uid;

    const { toUid, title, body, type } = req.body || {};
    if (!toUid || !body) {
      return res.status(400).json({ error: "toUid and body are required" });
    }
    if (toUid === fromUid) return res.json({ sent: 0 });

    const userDoc = await db.collection("users").doc(toUid).get();
    const tokens = (userDoc.data() || {}).fcmTokens || [];
    if (!tokens.length) return res.json({ sent: 0 });

    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: title || "Rishtay Bandhan", body: String(body) },
      data: { type: String(type || ""), fromUid: String(fromUid) },
      android: {
        priority: "high",
        notification: { channelId: "high_importance_channel", sound: "default" },
      },
      apns: { payload: { aps: { sound: "default" } } },
    });

    // Prune tokens the platform reports as dead.
    const invalid = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          invalid.push(tokens[i]);
        }
      }
    });
    if (invalid.length) {
      await db
        .collection("users")
        .doc(toUid)
        .update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalid),
        });
    }

    return res.json({ sent: resp.successCount });
  } catch (e) {
    console.error("[notify] error:", e);
    return res.status(500).json({ error: "notify failed" });
  }
});

module.exports = router;
