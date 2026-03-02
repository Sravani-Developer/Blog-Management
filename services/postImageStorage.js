const fs = require("fs");
const path = require("path");
const { getCloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

const LOCAL_UPLOAD_PREFIX = "/uploads/posts/";

const uploadPostImage = async (file) => {
  if (!file) return null;

  if (!isCloudinaryConfigured()) {
    return `${LOCAL_UPLOAD_PREFIX}${file.filename}`;
  }

  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw new Error("Cloudinary is not configured");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "blog_management/posts",
        resource_type: "image"
      },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });
};

const deleteLocalImage = (imagePath) => {
  if (!imagePath || !imagePath.startsWith(LOCAL_UPLOAD_PREFIX)) return;
  const absolutePath = path.join(__dirname, "..", imagePath.replace(/^\//, ""));
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

const extractCloudinaryPublicId = (imageUrl) => {
  try {
    const parsed = new URL(imageUrl);
    if (!parsed.hostname.includes("cloudinary.com")) return null;

    const uploadIndex = parsed.pathname.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let tail = parsed.pathname.slice(uploadIndex + "/upload/".length);
    const segments = tail.split("/").filter(Boolean);

    // Skip optional transformation and version segments until we hit the asset path.
    while (segments.length && (/^v\d+$/.test(segments[0]) || segments[0].includes(","))) {
      segments.shift();
    }

    if (!segments.length) return null;

    const last = segments.pop();
    const withoutExt = last.replace(/\.[^.]+$/, "");
    return [...segments, withoutExt].join("/");
  } catch (err) {
    return null;
  }
};

const deletePostImage = async (imageRef) => {
  if (!imageRef) return;

  if (imageRef.startsWith(LOCAL_UPLOAD_PREFIX)) {
    deleteLocalImage(imageRef);
    return;
  }

  if (!isCloudinaryConfigured()) {
    return;
  }

  const cloudinary = getCloudinary();
  const publicId = extractCloudinaryPublicId(imageRef);
  if (!cloudinary || !publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    // Ignore delete failures so post updates/deletes can proceed.
  }
};

module.exports = {
  uploadPostImage,
  deletePostImage
};
