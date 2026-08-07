// src/config/cloudinary.js

const cloudinary = require('cloudinary').v2

// Configure cloudinary with credentials from .env
// This must run before any upload calls
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// ─────────────────────────────────────────────────────
// uploadToCloudinary
// Takes a file buffer (from multer) and uploads it to Cloudinary
//
// WHY BUFFER APPROACH:
// We use multer's memoryStorage() which keeps the file in RAM
// as a Buffer instead of saving it to disk.
// We then pipe that Buffer directly to Cloudinary.
// This means no temporary files are created on the server.
// ─────────────────────────────────────────────────────
const uploadToCloudinary = (buffer, folder = 'turfly/facilities') => {
  return new Promise((resolve, reject) => {

    // upload_stream sends data to Cloudinary as a stream
    // We pass our options (folder, image transformations)
    // and a callback that fires when upload completes
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,                    // Organizes images in Cloudinary dashboard
        transformation: [
          { width: 1200, height: 800, crop: 'fill' },  // Resize to consistent dimensions
          { quality: 'auto' },                          // Auto-optimize quality
          { fetch_format: 'auto' }                      // Serve webp to browsers that support it
        ]
      },
      (error, result) => {
        if (error) {
          reject(new Error('Cloudinary upload failed: ' + error.message))
        } else {
          resolve(result)  // result.secure_url is the image URL we save to DB
        }
      }
    )

    // .end() sends the buffer through the stream to Cloudinary
    uploadStream.end(buffer)
  })
}

module.exports = { uploadToCloudinary }