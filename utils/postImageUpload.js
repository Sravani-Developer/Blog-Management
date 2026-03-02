const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { isCloudinaryConfigured } = require("../config/cloudinary");

const uploadDir = path.join(__dirname, "..", "uploads", "posts");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const localDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only PNG, JPG, JPEG, GIF, WEBP files are allowed"));
  }
  return cb(null, true);
};

const buildMulter = () =>
  multer({
    storage: isCloudinaryConfigured() ? multer.memoryStorage() : localDiskStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
  });

module.exports = {
  multer,
  postImageUpload: buildMulter()
};
