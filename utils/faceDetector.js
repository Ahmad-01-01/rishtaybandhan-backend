const vision = require("@google-cloud/vision");

const FACE_IN_IMAGE_THRESHOLD = 1; // At least one clear face per image!

// Authenticate using GOOGLE_APPLICATION_CREDENTIALS
const client = new vision.ImageAnnotatorClient();

async function detectFaceByBuffer(imageBuffer) {
  // Call Cloud Vision API to detect faces in the given image buffer
  const [result] = await client.faceDetection({
    image: { content: imageBuffer },
  });
  const faces = result.faceAnnotations;
  return !!(faces && faces.length >= FACE_IN_IMAGE_THRESHOLD);
}

module.exports = {
  detectFaceByBuffer,
};
