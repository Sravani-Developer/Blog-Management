const Post = require("../models/Post");
const { sendError } = require("../utils/responses");
const { isValidObjectId } = require("../utils/validators");

module.exports = async (req, res, next) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendError(res, 400, "Invalid post id");
  }

  try {
    const post = await Post.findById(id);
    if (!post) {
      return sendError(res, 404, "Post not found");
    }

    const isOwner = post.author.toString() === req.session.userId;
    const isAdmin = req.session.role === "admin";
    if (!isOwner && !isAdmin) {
      return sendError(res, 403, "Forbidden");
    }

    req.post = post;
    return next();
  } catch (err) {
    return next(err);
  }
};
