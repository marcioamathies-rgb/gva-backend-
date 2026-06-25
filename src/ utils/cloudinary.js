const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

async function uploadImage(fileBuffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'gva/gallery', resource_type: 'image', ...options },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(fileBuffer);
  });
}

async function uploadDocument(fileBuffer, originalName, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'gva/documents', resource_type: 'raw', public_id: originalName, ...options },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(fileBuffer);
  });
}

async function uploadAvatar(fileBuffer, userId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'gva/avatars', public_id: `member_${userId}`, overwrite: true,
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }] },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(fileBuffer);
  });
}

function isConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

module.exports = { uploadImage, uploadDocument, uploadAvatar, isConfigured };
