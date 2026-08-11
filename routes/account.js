const express = require("express");
const router = express.Router();
const { admin, db, auth } = require("../config/firebase");

// ─── ACCOUNT DELETION ────────────────────────────────────────────────────────
//
// Deletion moved to the server because the client physically cannot finish the
// job:
//
//   1. Legacy photos live in `rishtaybandhan-storage`, which is a plain GCS
//      bucket and NOT linked to Firebase, so the Storage SDK on the device has
//      no way to reach it. Every existing prod member's photos are there.
//   2. Photos are stored under `user_images/<uid>/` (both buckets), while the
//      client only ever cleared `users/<uid>/` — so on prod it deleted none.
//   3. Existing members' threads are in the legacy `chats` collection; the
//      client only cleared `conversations`, which prod does not even have yet.
//   4. `user.delete()` on the client fails with requires-recent-login on an
//      older session. The Admin SDK has no such restriction.
//
// The caller proves who they are with a Firebase ID token; a member can only
// ever delete themselves.

// Both prefixes: `users/` is what the revamped app writes, `user_images/` is
// what every pre-revamp upload used.
const PHOTO_PREFIXES = ["users/", "user_images/"];

// Every bucket that has ever held a profile photo, named explicitly.
//
// Do NOT rely on admin.storage().bucket(): it resolves to STORAGE_BUCKET,
// which on prod is the LEGACY bucket, not the Firebase default one. Trusting
// it meant the default bucket was never cleaned — caught by the end-to-end
// test on prod, where the legacy photo went and the two default-bucket photos
// stayed behind.
function projectId() {
  // Cloud Run does not reliably export GOOGLE_CLOUD_PROJECT, and
  // admin.app().options.projectId is only populated when it was passed to
  // initializeApp (it is not here). The service-account key file is the one
  // source that is always present on prod.
  const fromEnv =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    admin.app().options.projectId;
  if (fromEnv) return fromEnv;
  try {
    const fs = require("fs");
    const key = JSON.parse(
      fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")
    );
    return key.project_id || "";
  } catch (err) {
    return "";
  }
}

function bucketNames() {
  const project = projectId();
  const names = [
    process.env.STORAGE_BUCKET,
    process.env.LEGACY_STORAGE_BUCKET || "rishtaybandhan-storage",
    project ? `${project}.firebasestorage.app` : null,
    // Pre-2024 Firebase default naming, harmless if it does not exist.
    project ? `${project}.appspot.com` : null,
  ].filter(Boolean);
  return [...new Set(names)];
}

/** Deletes every doc in a query, plus each doc's `messages` subcollection. */
async function deleteThreads(collection, uid, report) {
  const snap = await db
    .collection(collection)
    .where("participants", "array-contains", uid)
    .get();
  for (const doc of snap.docs) {
    const messages = await doc.ref.collection("messages").get();
    for (const m of messages.docs) {
      await m.ref.delete();
      report.messages += 1;
    }
    await doc.ref.delete();
    report[collection] += 1;
  }
}

router.post("/delete-account", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing Authorization bearer token" });
  }

  let uid;
  try {
    // checkRevoked so a token from an already-signed-out session is rejected.
    ({ uid } = await auth.verifyIdToken(token, true));
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const report = {
    conversations: 0,
    chats: 0,
    messages: 0,
    notifications: 0,
    photos: 0,
    profile: false,
    login: false,
  };

  try {
    // Threads, new and legacy. Firestore does not cascade, so the messages
    // subcollection has to go first.
    await deleteThreads("conversations", uid, report);
    await deleteThreads("chats", uid, report);

    // Notifications in both directions.
    for (const field of ["toUid", "fromUid"]) {
      const snap = await db
        .collection("notifications")
        .where(field, "==", uid)
        .get();
      for (const doc of snap.docs) {
        await doc.ref.delete();
        report.notifications += 1;
      }
    }

    // Photos: every prefix, in every bucket. A bucket that does not exist in
    // this project simply errors and is skipped. The list is echoed back in
    // the response so a misconfigured bucket is visible from the outside
    // instead of silently deleting nothing.
    report.bucketsTried = bucketNames();
    for (const name of report.bucketsTried) {
      const bucket = admin.storage().bucket(name);
      for (const prefix of PHOTO_PREFIXES) {
        try {
          const [files] = await bucket.getFiles({ prefix: `${prefix}${uid}/` });
          for (const file of files) {
            await file.delete();
            report.photos += 1;
          }
        } catch (err) {
          // Expected for buckets that do not exist in this environment; a real
          // permission problem shows up here too, so it is logged either way.
          console.error(
            `photo cleanup skipped (${name}/${prefix}${uid}):`,
            err.message
          );
        }
      }
    }

    // The profile document.
    await db.collection("users").doc(uid).delete();
    report.profile = true;

    // The login last: everything above is keyed on the uid.
    await auth.deleteUser(uid);
    report.login = true;

    console.log(`account ${uid} deleted:`, JSON.stringify(report));
    return res.json({ success: true, deleted: report });
  } catch (err) {
    console.error("delete-account failed for", uid, err);
    // Report what did get removed: a half-finished deletion is exactly the
    // state the client used to leave behind silently.
    return res.status(500).json({
      error: "Deletion did not complete",
      deleted: report,
    });
  }
});

module.exports = router;
