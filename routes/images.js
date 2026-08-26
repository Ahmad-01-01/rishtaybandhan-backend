const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();
const { admin, bucket } = require("../config/firebase");
const { detectFaceByBuffer } = require("../utils/faceDetector");

const upload = multer({ storage: multer.memoryStorage() });

// ─── Helper: identify an image from its magic bytes ──────────────────────────
// Returns null rather than guessing, so an unrecognised buffer is never
// mislabelled (a PNG stored as image/jpeg would break some clients).
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP")
    return "image/webp";
  if (buf.slice(4, 8).toString() === "ftyp") return "image/heic";
  const g = buf.slice(0, 6).toString();
  if (g === "GIF87a" || g === "GIF89a") return "image/gif";
  return null;
}

// ─── Helper: upload file to GCS and return signed URL ────────────────────────
async function uploadAndSign(uid, file, label) {
  // Unique per upload, and this is load-bearing for the cacheControl below.
  // The old scheme was `${uid}_${label}.jpg`, so replacing gallery photo 0
  // overwrote the same object and produced an identical signed URL. Combined
  // with a one-year immutable cache that would pin the OLD photo on every
  // device that had already seen it. A fresh path means a fresh URL, so a
  // replaced photo is picked up immediately and the cache never lies.
  //
  // The superseded object is left behind rather than deleted here: it may still
  // be referenced by a Firestore document that has not been updated yet, and
  // /delete-user-images/:uid removes the whole `user_images/${uid}/` prefix when
  // an account is deleted, so nothing is orphaned permanently.
  const name = `${uid}_${label}_${Date.now()}.jpg`;
  const gcsPath = `user_images/${uid}/${name}`;
  const fileRef = bucket.file(gcsPath);

  // Sniff the real format instead of trusting file.mimetype. The Flutter client
  // sends multipart parts without a content type, so mimetype arrives as
  // application/octet-stream and 708 objects in the bucket were stored with
  // that, which blocks sane caching downstream.
  const sniffed = sniffImageType(file.buffer) || file.mimetype || "image/jpeg";

  await fileRef.save(file.buffer, {
    resumable: false,
    contentType: sniffed,
    // A photo at this path is never rewritten (a new upload gets a new label),
    // so it can be cached hard. Without an explicit cacheControl, GCS serves
    // signed-URL reads as `private, max-age=0`, which told every client the
    // image was stale on arrival and defeated the on-device image cache: each
    // appearance of a card refetched the full photo.
    cacheControl: "public, max-age=31536000, immutable",
    metadata: { firebaseStorageDownloadTokens: uuidv4() },
  });

  const [url] = await fileRef.getSignedUrl({
    action: "read",
    expires: "03-01-2500",
  });

  return url;
}

// ─── Helper: validate face in image ──────────────────────────────────────────
async function validateFace(file, fieldName) {
  const hasFace = await detectFaceByBuffer(file.buffer);
  if (!hasFace) {
    return `Uploaded "${fieldName}" image must contain a clear face.`;
  }
  return null;
}

// ─── UPLOAD PICTURES ─────────────────────────────────────────────────────────
router.post(
  "/upload-pictures",
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

      if (!fileMap["camera"]) {
        return res.status(400).json({ error: "Camera photo is required." });
      }

      // Face detection on all uploaded images
      const checkFields = [
        { field: "camera", required: true },
        { field: "profilePic", required: false },
        { field: "gallery0", required: false },
        { field: "gallery1", required: false },
        { field: "gallery2", required: false },
        { field: "gallery3", required: false },
      ];

      for (const { field, required } of checkFields) {
        if (fileMap[field]) {
          for (const file of fileMap[field]) {
            const error = await validateFace(file, field);
            if (error) return res.status(401).json({ error });
          }
        } else if (required) {
          return res.status(400).json({ error: `Missing required photo: ${field}` });
        }
      }

      // Upload all files
      const pictures = {
        camera: "",
        gallery: [],
        profilePic: "",
        blur: blur === "true",
      };

      const uploadPromises = [];

      // Camera (required)
      uploadPromises.push(
        uploadAndSign(uid, fileMap["camera"][0], "camera").then((url) => {
          pictures.camera = url;
        })
      );

      // Gallery (optional)
      const galleryIndices = Object.keys(fileMap)
        .filter((k) => k.startsWith("gallery"))
        .map((k) => parseInt(k.replace("gallery", ""), 10))
        .filter((i) => !isNaN(i))
        .sort((a, b) => a - b);

      for (const i of galleryIndices) {
        const files = fileMap[`gallery${i}`];
        if (files && files.length > 0) {
          uploadPromises.push(
            uploadAndSign(uid, files[0], `gallery_${i}`).then((url) => {
              pictures.gallery.push(url);
            })
          );
        }
      }

      // Profile Pic (optional)
      if (fileMap["profilePic"]) {
        uploadPromises.push(
          uploadAndSign(uid, fileMap["profilePic"][0], "profilePic").then((url) => {
            pictures.profilePic = url;
          })
        );
      }

      await Promise.all(uploadPromises);

      await admin.firestore().collection("users").doc(uid).update({ pictures });

      return res.json({ success: true, pictures });
    } catch (err) {
      console.error("Failed to upload files:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── UPLOAD PROFILE PIC ─────────────────────────────────────────────────────
router.post("/upload-profile-pic", upload.single("profilePic"), async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: "No uid supplied" });
    if (!req.file) return res.status(400).json({ error: "No profilePic file uploaded." });

    const error = await validateFace(req.file, "profilePic");
    if (error) return res.status(401).json({ error });

    const signedUrl = await uploadAndSign(uid, req.file, "profilePic");

    await admin.firestore().collection("users").doc(uid).update({
      "pictures.profilePic": signedUrl,
    });

    return res.json({ success: true, profilePic: signedUrl });
  } catch (err) {
    console.error("Failed to upload profile pic:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── MODIFY GALLERY PICTURES ────────────────────────────────────────────────
router.post(
  "/modify-gallery-pictures",
  upload.fields([
    { name: "gallery0", maxCount: 1 },
    { name: "gallery1", maxCount: 1 },
    { name: "gallery2", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ error: "No uid supplied" });

      const galleryUrls = [];

      for (let i = 0; i < 3; i++) {
        const urlField = req.body[`gallery${i}_url`];
        const fileField = req.files && req.files[`gallery${i}`];

        if (fileField && fileField.length > 0) {
          const file = fileField[0];
          const faceError = await validateFace(file, `gallery${i}`);
          if (faceError) return res.status(401).json({ error: faceError });

          galleryUrls[i] = await uploadAndSign(uid, file, `gallery_${i}`);
        } else if (urlField && typeof urlField === "string" && urlField.trim()) {
          galleryUrls[i] = urlField.trim();
        } else {
          galleryUrls[i] = null;
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

// ─── LIST SIGNED URLS ───────────────────────────────────────────────────────
router.get("/list-signed-urls/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return res.status(400).json({ error: "No uid supplied" });

    const [files] = await bucket.getFiles({ prefix: `user_images/${uid}/` });
    const imageFiles = files.filter((f) => !f.name.endsWith("/"));

    const urls = await Promise.all(
      imageFiles.map(async (file) => {
        const [url] = await file.getSignedUrl({
          action: "read",
          expires: "03-01-2500",
        });
        return { name: file.name.split("/").pop(), url };
      })
    );

    return res.json({ files: urls });
  } catch (err) {
    console.error("Failed to list or sign URLs:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE USER IMAGES ─────────────────────────────────────────────────────
router.post("/delete-user-images/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return res.status(400).json({ error: "No uid supplied" });

    const [files] = await bucket.getFiles({ prefix: `user_images/${uid}/` });
    await Promise.all(files.map((file) => file.delete()));

    return res.json({ success: true, deleted: files.length });
  } catch (err) {
    console.error("Failed to delete user images:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
