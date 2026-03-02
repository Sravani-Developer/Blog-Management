const express = require("express");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const Post = require("../models/Post");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");
const requireOwnershipOrAdmin = require("../middleware/requireOwnershipOrAdmin");
const { sendSuccess, sendError, wantsJson } = require("../utils/responses");
const { isValidObjectId, validatePostInput } = require("../utils/validators");
const { multer, postImageUpload } = require("../utils/postImageUpload");
const { uploadPostImage, deletePostImage } = require("../services/postImageStorage");
const { resolvePostCategoryInput } = require("../utils/postCategories");

const router = express.Router();

const parsePagination = (req, options = {}) => {
  const defaultLimit = options.defaultLimit || 10;
  const maxLimit = options.maxLimit || 50;
  const pageRaw = Number.parseInt(req.query.page, 10);
  const limitRaw = Number.parseInt(req.query.limit, 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, maxLimit)
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
};

const POST_SORTS = {
  newest: {
    key: "newest",
    label: "Newest first",
    sort: { createdAt: -1 }
  },
  "most-viewed": {
    key: "most-viewed",
    label: "Most viewed",
    sort: { viewCount: -1, createdAt: -1 }
  },
  featured: {
    key: "featured",
    label: "Featured first",
    sort: { isFeatured: -1, createdAt: -1 }
  }
};

const parsePostSort = (req) => {
  const rawSort = typeof req.query.sort === "string" ? req.query.sort.trim() : "";
  return POST_SORTS[rawSort] || POST_SORTS.newest;
};

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId).select("name email role createdAt");
    if (!user) {
      return res.redirect("/");
    }
    return res.status(200).render("me-settings", {
      activeTab: "personal",
      user,
      error: null
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/security", async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId).select("name email role createdAt");
    if (!user) {
      return res.redirect("/");
    }
    return res.status(200).render("me-security", {
      activeTab: "security",
      user,
      error: null
    });
  } catch (err) {
    return next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";

    const details = {};
    if (!name) details.name = "Name is required";
    if (!email || !validator.isEmail(email)) details.email = "Valid email is required";
    if (Object.keys(details).length) {
      return sendError(res, 400, "Validation failed", details);
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const existing = await User.findOne({ email });
    if (existing && existing._id.toString() !== user._id.toString()) {
      return sendError(res, 400, "Validation failed", { email: "Email already in use" });
    }

    user.name = name;
    user.email = email;
    await user.save();

    return sendSuccess(res, 200, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.put("/security/password", async (req, res, next) => {
  try {
    const currentPassword = typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";
    const confirmPassword = typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";

    const details = {};
    if (!currentPassword) details.currentPassword = "Current password is required";
    if (!newPassword || newPassword.length < 8) details.newPassword = "New password must be at least 8 characters";
    if (newPassword !== confirmPassword) details.confirmPassword = "Passwords do not match";
    if (Object.keys(details).length) {
      return sendError(res, 400, "Validation failed", details);
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const isValid = await user.validatePassword(currentPassword);
    if (!isValid) {
      return sendError(res, 400, "Validation failed", {
        currentPassword: "Current password is incorrect"
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return sendSuccess(res, 200, { message: "Password updated successfully" });
  } catch (err) {
    return next(err);
  }
});

router.get("/posts", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 10, maxLimit: 100 });
    const sortMeta = parsePostSort(req);
    const [posts, totalPosts, statsPosts] = await Promise.all([
      Post.find({ author: req.session.userId })
        .sort(sortMeta.sort)
        .skip(skip)
        .limit(limit)
        .populate("author", "name email"),
      Post.countDocuments({ author: req.session.userId }),
      Post.find({ author: req.session.userId }).select("viewCount")
    ]);
    const totalPages = Math.max(1, Math.ceil(totalPosts / limit));
    const pagination = { page, limit, total: totalPosts, totalPages, sort: sortMeta.key };
    const stats = {
      totalPosts,
      totalViews: statsPosts.reduce((sum, post) => sum + (post.viewCount || 0), 0),
      totalComments: 0
    };

    if (wantsJson(req)) {
      return sendSuccess(res, 200, {
        posts,
        stats,
        pagination,
        sort: sortMeta,
        sortOptions: Object.values(POST_SORTS).map(({ key, label }) => ({ key, label }))
      });
    }

    return res.status(200).render("me-posts", {
      posts,
      stats,
      pagination,
      currentSort: sortMeta.key,
      sortOptions: Object.values(POST_SORTS).map(({ key, label }) => ({ key, label }))
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/posts/new", (req, res) => {
  return res.status(200).render("post-form", {
    mode: "create",
    post: null,
    error: null,
    submitUrl: "/me/posts",
    successRedirect: "/me/posts",
    cancelHref: "/me/posts",
    isAdminMode: false
  });
});

router.post("/posts", postImageUpload.single("featuredImage"), async (req, res, next) => {
  try {
    const details = validatePostInput(req.body);
    if (details) {
      return sendError(res, 400, "Validation failed", details);
    }
    const categoryMeta = resolvePostCategoryInput({
      title: req.body.title,
      content: req.body.content,
      category: req.body.category
    });

    const post = await Post.create({
      title: req.body.title.trim(),
      content: req.body.content.trim(),
      author: req.session.userId,
      category: categoryMeta.category,
      autoCategory: categoryMeta.autoCategory,
      categorySource: categoryMeta.categorySource,
      featuredImage: await uploadPostImage(req.file)
    });

    return sendSuccess(res, 201, { post });
  } catch (err) {
    return next(err);
  }
});

router.get("/posts/:id/edit", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).render("post-form", {
        mode: "edit",
        post: null,
        error: "Invalid post id",
        submitUrl: null,
        successRedirect: "/me/posts",
        cancelHref: "/me/posts",
        isAdminMode: false
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).render("post-form", {
        mode: "edit",
        post: null,
        error: "Post not found",
        submitUrl: null,
        successRedirect: "/me/posts",
        cancelHref: "/me/posts",
        isAdminMode: false
      });
    }

    if (post.author.toString() !== req.session.userId) {
      return res.status(403).render("post-form", {
        mode: "edit",
        post: null,
        error: "Forbidden",
        submitUrl: null,
        successRedirect: "/me/posts",
        cancelHref: "/me/posts",
        isAdminMode: false
      });
    }

    return res.status(200).render("post-form", {
      mode: "edit",
      post,
      error: null,
      submitUrl: `/me/posts/${post._id}`,
      successRedirect: "/me/posts",
      cancelHref: "/me/posts",
      isAdminMode: false
    });
  } catch (err) {
    return next(err);
  }
});

router.put(
  "/posts/:id",
  postImageUpload.single("featuredImage"),
  requireOwnershipOrAdmin,
  async (req, res, next) => {
  try {
    const details = validatePostInput(req.body);
    if (details) {
      return sendError(res, 400, "Validation failed", details);
    }

    req.post.title = req.body.title.trim();
    req.post.content = req.body.content.trim();
    const categoryMeta = resolvePostCategoryInput({
      title: req.body.title,
      content: req.body.content,
      category: req.body.category
    });
    req.post.category = categoryMeta.category;
    req.post.autoCategory = categoryMeta.autoCategory;
    req.post.categorySource = categoryMeta.categorySource;
    if (req.file) {
      await deletePostImage(req.post.featuredImage);
      req.post.featuredImage = await uploadPostImage(req.file);
    }
    await req.post.save();

    return sendSuccess(res, 200, { post: req.post });
  } catch (err) {
    return next(err);
  }
}
);

router.delete("/posts/:id", requireOwnershipOrAdmin, async (req, res, next) => {
  try {
    await deletePostImage(req.post.featuredImage);
    await req.post.deleteOne();
    return sendSuccess(res, 200, { message: "Post deleted" });
  } catch (err) {
    return next(err);
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return sendError(res, 400, "Image must be <= 5MB");
    }
    return sendError(res, 400, err.message);
  }
  if (err.message && err.message.includes("Only PNG")) {
    return sendError(res, 400, err.message);
  }
  return next(err);
});

module.exports = router;
