const multer = require("multer");
const cloudinary = require("../dbConfig/cloudinary");
const { Readable } = require("stream");

const storage = multer.memoryStorage();
const upload = multer({ storage });

function bufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

async function cloudinaryMiddleware(req, res, next) {
  try {
    if (req.file && req.file.buffer) {
      const result = await bufferToCloudinary(req.file.buffer, "LuxeLook/profile");
      req.file.path = result.secure_url;
      req.file.public_id = result.public_id || result.public_id; 
      return next();
    }

    if (req.files && Object.keys(req.files).length) {
      const fieldNames = Object.keys(req.files);
      for (const fieldName of fieldNames) {
        for (let i = 0; i < req.files[fieldName].length; i++) {
          const fileObj = req.files[fieldName][i];
          if (!fileObj || !fileObj.buffer) continue;
          const result = await bufferToCloudinary(fileObj.buffer, "LuxeLook/products");
          req.files[fieldName][i].path = result.secure_url;
          req.files[fieldName][i].public_id = result.public_id;
        }
      }
      return next();
    }

    return next();
  } catch (err) {
    console.error("Cloudinary middleware error:", err);
    return res.status(500).json({ success: false, message: "Image upload failed" });
  }
}

module.exports = { upload, cloudinaryMiddleware };
