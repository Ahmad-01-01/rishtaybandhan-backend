/**
 * Delete specific test user accounts completely from Firebase Auth + Firestore.
 *
 * Usage: node scripts/delete-test-users.js
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account key,
 * OR run from a machine with default credentials (e.g., Cloud Shell).
 */

const admin = require("firebase-admin");

// Initialize if not already
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "rishtaybandhan-firebase",
  });
}

const db = admin.firestore();
const auth = admin.auth();

const UIDS_TO_DELETE = [
  "EU0vR3vjYrQWxxWpPCpmboteORx1",
  "e9Hv2ODZBSVRiYXcOuItPePguvS2",
  "mbXPxrKX5KaNYCm17FS85bq3mTb2",
];

// Collections where user docs may exist (keyed by UID)
const USER_COLLECTIONS = ["users", "otp_codes"];

// Sub-collections under the user doc in 'users' collection
const USER_SUBCOLLECTIONS = ["likes", "matches", "chats", "notifications"];

async function deleteSubcollection(docRef, subName) {
  const subSnap = await docRef.collection(subName).get();
  if (subSnap.empty) return 0;
  const batch = db.batch();
  subSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return subSnap.size;
}

async function deleteUserCompletely(uid) {
  console.log(`\n--- Deleting UID: ${uid} ---`);

  // 1. Delete from Firebase Auth
  try {
    await auth.deleteUser(uid);
    console.log(`  [Auth] Deleted from Firebase Authentication`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.log(`  [Auth] Not found (already deleted or never existed)`);
    } else {
      console.error(`  [Auth] Error:`, err.message);
    }
  }

  // 2. Delete user document and its sub-collections from 'users' collection
  const userDocRef = db.collection("users").doc(uid);
  const userDoc = await userDocRef.get();
  if (userDoc.exists) {
    // Delete sub-collections first
    for (const sub of USER_SUBCOLLECTIONS) {
      const count = await deleteSubcollection(userDocRef, sub);
      if (count > 0) console.log(`  [Firestore] Deleted ${count} docs from users/${uid}/${sub}`);
    }
    await userDocRef.delete();
    console.log(`  [Firestore] Deleted users/${uid}`);
  } else {
    console.log(`  [Firestore] users/${uid} not found`);
  }

  // 3. Delete from other top-level collections
  for (const col of USER_COLLECTIONS) {
    if (col === "users") continue; // already handled
    const docRef = db.collection(col).doc(uid);
    const doc = await docRef.get();
    if (doc.exists) {
      await docRef.delete();
      console.log(`  [Firestore] Deleted ${col}/${uid}`);
    }
  }

  // 4. Remove UID from other users' 'likes', 'blocked', 'matches' arrays
  const usersSnap = await db.collection("users").get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const updates = {};

    if (Array.isArray(data.likes) && data.likes.includes(uid)) {
      updates.likes = admin.firestore.FieldValue.arrayRemove(uid);
    }
    if (Array.isArray(data.blocked) && data.blocked.includes(uid)) {
      updates.blocked = admin.firestore.FieldValue.arrayRemove(uid);
    }
    if (Array.isArray(data.matches) && data.matches.includes(uid)) {
      updates.matches = admin.firestore.FieldValue.arrayRemove(uid);
    }
    if (Array.isArray(data.likedBy) && data.likedBy.includes(uid)) {
      updates.likedBy = admin.firestore.FieldValue.arrayRemove(uid);
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      console.log(`  [Firestore] Cleaned references from users/${doc.id}`);
    }
  }

  console.log(`  Done.`);
}

async function main() {
  console.log("=== Rishtay Bandhan: Delete Test Users ===");
  console.log(`Deleting ${UIDS_TO_DELETE.length} users...\n`);

  for (const uid of UIDS_TO_DELETE) {
    await deleteUserCompletely(uid);
  }

  console.log("\n=== All done! ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
