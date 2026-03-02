const mongoose = require("mongoose");
const { POST_CATEGORIES } = require("../utils/postCategories");

const PostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 5000
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    category: {
      type: String,
      enum: POST_CATEGORIES,
      default: "Code Quality"
    },
    autoCategory: {
      type: String,
      enum: POST_CATEGORIES,
      default: "Code Quality"
    },
    categorySource: {
      type: String,
      enum: ["manual", "auto"],
      default: "auto"
    },
    featuredImage: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);
