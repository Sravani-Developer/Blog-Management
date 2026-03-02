let cloudinary = null;

try {
  ({ v2: cloudinary } = require("cloudinary"));
} catch (err) {
  cloudinary = null;
}

const getImageStorageDriver = () =>
  (process.env.IMAGE_STORAGE_DRIVER || "local").trim().toLowerCase();

const isCloudinaryConfigured = () =>
  Boolean(
    getImageStorageDriver() === "cloudinary" &&
      cloudinary &&
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

const getCloudinary = () => {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  return cloudinary;
};

module.exports = {
  getCloudinary,
  isCloudinaryConfigured,
  getImageStorageDriver
};
