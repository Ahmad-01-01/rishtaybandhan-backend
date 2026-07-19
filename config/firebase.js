require("dotenv").config();
const admin = require("firebase-admin");

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const storageBucket = process.env.STORAGE_BUCKET;

admin.initializeApp({
  // Use an explicit service-account key when provided (local / existing prod);
  // otherwise fall back to the runtime default service account, which is what
  // Cloud Run provides (used by the dev deployment — no key file needed).
  credential: serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault(),
  storageBucket,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const auth = admin.auth();

module.exports = { admin, db, bucket, auth };
