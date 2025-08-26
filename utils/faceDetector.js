const vision = require("@google-cloud/vision");

// Authenticate using GOOGLE_APPLICATION_CREDENTIALS
const client = new vision.ImageAnnotatorClient();

async function detectFaceByBuffer(imageBuffer) {
  // Call Cloud Vision API to detect faces in the given image buffer
  const [result] = await client.faceDetection({
    image: { content: imageBuffer },
  });
  const faces = result.faceAnnotations;
  // Require exactly one face
  return !!(faces && faces.length === 1);
}

module.exports = {
  detectFaceByBuffer,
};
