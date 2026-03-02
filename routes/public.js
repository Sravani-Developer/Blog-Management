const express = require("express");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const { isValidObjectId } = require("../utils/validators");
const { normalizeCategory } = require("../utils/postCategories");
const { sendError, sendSuccess, wantsJson } = require("../utils/responses");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const activeCategory = normalizeCategory(req.query.category);
    const categoryFilter = activeCategory
      ? {
          $or: [{ category: activeCategory }, { autoCategory: activeCategory }]
        }
      : {};

    const [featured, recent, categoryCounts] = await Promise.all([
      Post.find({ isFeatured: true, ...categoryFilter })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate("author", "name"),
      Post.find(categoryFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("author", "name"),
      Post.aggregate([
        {
          $project: {
            effectiveCategory: {
              $ifNull: ["$category", { $ifNull: ["$autoCategory", "Code Quality"] }]
            }
          }
        },
        {
          $group: {
            _id: "$effectiveCategory",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1, _id: 1 } }
      ])
    ]);

    return res.status(200).render("home", {
      featured,
      recent,
      activeCategory,
      categoryCounts
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/posts/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).render("post-detail", {
        post: null,
        error: "Invalid post id"
      });
    }

    const post = await Post.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate("author", "name");
    if (!post) {
      return res.status(404).render("post-detail", {
        post: null,
        comments: [],
        error: "Post not found"
      });
    }

    const comments = await Comment.find({ post: post._id })
      .sort({ createdAt: -1 })
      .select("authorName content createdAt");

    return res.status(200).render("post-detail", { post, comments, error: null });
  } catch (err) {
    return next(err);
  }
});

router.post("/posts/:id/comments", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      if (wantsJson(req)) {
        return sendError(res, 400, "Invalid post id");
      }
      return res.redirect("/");
    }

    const post = await Post.findById(id).select("_id");
    if (!post) {
      return sendError(res, 404, "Post not found");
    }

    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    const authorNameInput = typeof req.body.authorName === "string" ? req.body.authorName.trim() : "";
    const authorEmailInput = typeof req.body.authorEmail === "string" ? req.body.authorEmail.trim().toLowerCase() : "";
    const authorName =
      (req.session && req.session.userId && res.locals.currentUser && res.locals.currentUser.name) ||
      authorNameInput;

    const details = {};
    if (!authorName) details.authorName = "Name is required";
    if (authorName && authorName.length > 80) details.authorName = "Name is too long";
    if (!content) details.content = "Comment is required";
    if (content && (content.length < 2 || content.length > 1000)) {
      details.content = "Comment must be 2-1000 characters";
    }
    if (authorEmailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmailInput)) {
      details.authorEmail = "Valid email is required";
    }
    if (Object.keys(details).length) {
      return sendError(res, 400, "Validation failed", details);
    }

    const comment = await Comment.create({
      post: post._id,
      user: req.session && req.session.userId ? req.session.userId : null,
      authorName,
      authorEmail: authorEmailInput || (res.locals.currentUser ? res.locals.currentUser.email : null),
      content
    });

    return sendSuccess(res, 201, {
      comment: {
        id: comment._id,
        authorName: comment.authorName,
        content: comment.content,
        createdAt: comment.createdAt
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/login", (req, res) => {
  return res.status(200).render("login", { error: null });
});

router.get("/register", (req, res) => {
  return res.status(200).render("register", { error: null });
});

router.get("/forgot-password", (req, res) => {
  return res.status(200).render("forgot-password", { error: null });
});

router.get("/about", (req, res) => {
  return res.status(200).render("about");
});

router.get("/contact", (req, res) => {
  return res.status(200).render("contact");
});

module.exports = router;
