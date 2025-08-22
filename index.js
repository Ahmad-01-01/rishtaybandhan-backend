// Always at the top!
require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");

const { detectFaceByBuffer } = require("./utils/faceDetector"); // Adjust path as needed

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const storageBucket = process.env.STORAGE_BUCKET;

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

      // ----------- 👇 ADD THIS SECTION: FACE DETECTION 👇 -----------
      // Prepare list of fields to check for face
      const checkFields = [
        { field: "camera", required: true },
        // Add others you want to check - can be all or some
        { field: "profilePic", required: false },
        { field: "gallery0", required: false },
        { field: "gallery1", required: false },
        { field: "gallery2", required: false },
        { field: "gallery3", required: false },
      ];
      for (const { field, required } of checkFields) {
        if (fileMap[field]) {
          // Might be an array (multer)
          for (const file of fileMap[field]) {
            const hasFace = await detectFaceByBuffer(file.buffer);
            if (!hasFace) {
              return res.status(401).json({
                error: `Uploaded "${field}" image must contain a clear face.`,
              });
            }
          }
        } else if (required) {
          return res
            .status(400)
            .json({ error: `Missing required photo: ${field}` });
        }
      }
      // ----------- 👆 END FACE DETECTION SECTION 👆 -----------

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

      // ...other code continues...

      // Gallery (optional, N allowed, N = up to 4 in this API)
      const galleryUploadTasks = [];
      const galleryIndices = Object.keys(fileMap)
        .filter((k) => k.startsWith("gallery"))
        .map((k) => parseInt(k.replace("gallery", ""), 10))
        .filter((i) => !isNaN(i))
        .sort((a, b) => a - b);

      pictures.gallery = []; // Initialize as empty array

      for (const i of galleryIndices) {
        const files = fileMap[`gallery${i}`];
        if (files && files.length > 0) {
          const file = files[0];
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
              pictures.gallery.push(url);
            });
          galleryUploadTasks.push(task);
        }
      }

      uploadPromises.push(...galleryUploadTasks);

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

// endpoint POST /api/delete-user-images/:uid
app.post("/api/delete-user-images/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    if (!uid) {
      return res.status(400).json({ error: "No uid supplied" });
    }
    // List all files in GCS bucket under user_images/UID/
    const [files] = await bucket.getFiles({ prefix: `user_images/${uid}/` });
    const deletePromises = files.map((file) => file.delete());
    await Promise.all(deletePromises);
    return res.json({ success: true, deleted: files.length });
  } catch (err) {
    console.error("Failed to delete user images:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/upload-profile-pic",
  upload.single("profilePic"),
  async (req, res) => {
    try {
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ error: "No uid supplied" });

      // Ensure a file is uploaded
      if (!req.file) {
        return res.status(400).json({ error: "No profilePic file uploaded." });
      }
      // --- FACE DETECTION BEFORE UPLOAD ---
      const hasFace = await detectFaceByBuffer(req.file.buffer);
      if (!hasFace) {
        return res
          .status(400)
          .json({ error: "Profile picture must clearly show your face." });
      }
      // --- END FACE DETECTION ---
      const file = req.file;
      const name = `${uid}_profilePic.jpg`;
      const gcsPath = `user_images/${uid}/${name}`;
      const fileRef = bucket.file(gcsPath);

      // Upload the file to GCS
      await fileRef.save(file.buffer, {
        resumable: false,
        contentType: file.mimetype,
        metadata: { firebaseStorageDownloadTokens: uuidv4() },
      });

      // Generate a (very long/lifetime) signed URL
      const [signedUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-01-2500",
      });

      // Update only profilePic in Firestore
      await admin.firestore().collection("users").doc(uid).update({
        "pictures.profilePic": signedUrl,
      });

      return res.json({ success: true, profilePic: signedUrl });
    } catch (err) {
      console.error("Failed to upload profile pic:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);
/**
 * /api/list-signed-urls/:uid
 * Lists all images in user_images/:uid and generates never-expiring signed URLs.
 * Returns { files: [ { name, url }, ... ] }
 */
app.get("/api/list-signed-urls/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    if (!uid) return res.status(400).json({ error: "No uid supplied" });

    // List all files in user_images/:uid/
    const [files] = await bucket.getFiles({
      prefix: `user_images/${uid}/`,
    });

    // Ignore "directory" entries (Firebase returns objects for both folders & files)
    const imageFiles = files.filter((f) => !f.name.endsWith("/"));

    // Generate signed URLs for each file
    const urlPromises = imageFiles.map(async (file) => {
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2500", // Never expires in practical sense
      });
      return {
        name: file.name.split("/").pop(),
        url,
      };
    });

    const urls = await Promise.all(urlPromises);

    return res.json({ files: urls });
  } catch (err) {
    console.error("Failed to list or sign URLs:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/modify-gallery-pictures",
  upload.fields([
    { name: "gallery0", maxCount: 1 },
    { name: "gallery1", maxCount: 1 },
    { name: "gallery2", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const uid = req.body.uid;
      if (!uid) return res.status(400).json({ error: "No uid supplied" });

      let galleryUrls = [];

      for (let i = 0; i < 3; i++) {
        let urlField = req.body[`gallery${i}_url`];
        let fileField = req.files && req.files[`gallery${i}`];
        if (fileField && fileField.length > 0) {
          // Upload the new file to GCS
          const file = fileField[0];

          // ---- FACE DETECTION CHECK ----
          const hasFace = await detectFaceByBuffer(file.buffer);
          if (!hasFace) {
            return res
              .status(400)
              .json({
                error: `Gallery photo ${i + 1} must contain a clear face.`,
              });
          }
          // ---- END CHECK ----

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
            .then(([url]) => url);
          galleryUrls[i] = task;
        } else if (
          urlField &&
          typeof urlField === "string" &&
          urlField.trim()
        ) {
          galleryUrls[i] = urlField.trim();
        } else {
          galleryUrls[i] = null;
        }
      }

      // Only await if "then" in actual object (not null/undefined/string)
      for (let i = 0; i < 3; i++) {
        const val = galleryUrls[i];
        if (val && typeof val === "object" && typeof val.then === "function") {
          galleryUrls[i] = await val;
        }
      }

      await admin.firestore().collection("users").doc(uid).update({
        "pictures.gallery": galleryUrls,
      });

      return res.json({ success: true, gallery: galleryUrls });
    } catch (err) {
      console.error("Failed to modify gallery pictures:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

app.get("/", (req, res) => res.send("Photo upload API running"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
