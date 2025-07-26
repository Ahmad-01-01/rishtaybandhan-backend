// Always at the top!
require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");

const keyPath =
  "./rishtaybandhan-firebase-firebase-adminsdk-fbsvc-77c0ba15c7.json" ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = require(keyPath);

// Access .env variables!
const storageBucket =
  "gs://rishtaybandhan-firebase.firebasestorage.app" ||
  process.env.STORAGE_BUCKET;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket,
});
const app = express();
app.use(cors());

const bucket = admin.storage().bucket();

// Multer settings: Store files in memory (not on disk)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * /api/upload-pictures
 * Expected fields:
 * - uid (string, required)
 * - camera, gallery0, gallery1, ..., profilePic (file fields, optional)
 */
app.post(
  "/api/upload-pictures",
  upload.fields([
    { name: "camera", maxCount: 1 },
    { name: "gallery0", maxCount: 1 },
    { name: "gallery1", maxCount: 1 },
    { name: "gallery2", maxCount: 1 },
    { name: "gallery3", maxCount: 1 },
    { name: "profilePic", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { uid, blur } = req.body;
      if (!uid) return res.status(400).json({ error: "No uid supplied" });

      const fileMap = req.files;

      // ---- Camera is required ----
      if (!fileMap["camera"]) {
        return res.status(400).json({ error: "Camera photo is required." });
      }

      const pictures = {
        camera: "",
        gallery: [],
        profilePic: "",
        blur: blur === "true",
      };
      const uploadPromises = [];

      // Camera (REQUIRED)
      {
        const file = fileMap["camera"][0];
        const name = `${uid}_camera.jpg`;
        const task = bucket
          .file(`user_images/${uid}/${name}`)
          .save(file.buffer, {
            resumable: false,
            contentType: file.mimetype,
            metadata: { firebaseStorageDownloadTokens: uuidv4() },
          })
          .then(() =>
            bucket.file(`user_images/${uid}/${name}`).getSignedUrl({
              action: "read",
              expires: "03-01-2500",
            })
          )
          .then(([url]) => {
            pictures.camera = url;
          });
        uploadPromises.push(task);
      }

      // Gallery (optional, 0–4 allowed)
      for (let i = 0; i < 4; i++) {
        if (fileMap[`gallery${i}`]) {
          const file = fileMap[`gallery${i}`][0];
          const name = `${uid}_gallery_${i}.jpg`;
          const task = bucket
            .file(`user_images/${uid}/${name}`)
            .save(file.buffer, {
              resumable: false,
              contentType: file.mimetype,
              metadata: { firebaseStorageDownloadTokens: uuidv4() },
            })
            .then(() =>
              bucket.file(`user_images/${uid}/${name}`).getSignedUrl({
                action: "read",
                expires: "03-01-2500",
              })
            )
            .then(([url]) => {
              pictures.gallery[i] = url;
            });
          uploadPromises.push(task);
        } else {
          pictures.gallery[i] = "";
        }
      }

      // Profile Pic (optional)
      if (fileMap["profilePic"]) {
        const file = fileMap["profilePic"][0];
        const name = `${uid}_profilePic.jpg`;
        const task = bucket
          .file(`user_images/${uid}/${name}`)
          .save(file.buffer, {
            resumable: false,
            contentType: file.mimetype,
            metadata: { firebaseStorageDownloadTokens: uuidv4() },
          })
          .then(() =>
            bucket.file(`user_images/${uid}/${name}`).getSignedUrl({
              action: "read",
              expires: "03-01-2500",
            })
          )
          .then(([url]) => {
            pictures.profilePic = url;
          });
        uploadPromises.push(task);
      } else {
        pictures.profilePic = "";
      }

      await Promise.all(uploadPromises);

      // Write to Firestore
      await admin.firestore().collection("users").doc(uid).update({
        pictures, // same as your format
      });

      return res.json({ success: true, pictures });
    } catch (err) {
      console.error("Failed to upload files:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);
app.get("/", (req, res) => res.send("Photo upload API running"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
