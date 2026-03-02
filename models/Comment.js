const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    authorEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 1000
    }
  },
  { timestamps: true }
);

CommentSchema.index({ post: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", CommentSchema);
