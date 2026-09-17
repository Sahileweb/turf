const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})


const uploadToCloudinary = (buffer, folder = 'turfly/facilities') => {
  return new Promise((resolve, reject) => {

    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,                    
        transformation: [
          { width: 1200, height: 800, crop: 'fill' },  
          { quality: 'auto' },                          
          { fetch_format: 'auto' }                      
        ]
      },
      (error, result) => {
        if (error) {
          reject(new Error('Cloudinary upload failed: ' + error.message))
        } else {
          resolve(result)  
        }
      }
    )

    // .end() sends the buffer through the stream to Cloudinary
    uploadStream.end(buffer)
  })
}

// Upload multiple images — returns array of secure URLs
const uploadMultipleToCloudinary = async (buffers, folder = 'turfly/facilities') => {
  const uploadPromises = buffers.map(buffer => uploadToCloudinary(buffer, folder))
  const results = await Promise.all(uploadPromises)
  return results.map(r => r.secure_url)
}

module.exports = { uploadToCloudinary, uploadMultipleToCloudinary  }