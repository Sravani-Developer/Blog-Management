const express = require("express");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const User = require("../models/User");
const Post = require("../models/Post");
const requireAdmin = require("../middleware/requireAdmin");
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

const normalizeUserPayload = (body) => ({
  name: typeof body.name === "string" ? body.name.trim() : "",
  email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
  role: typeof body.role === "string" ? body.role.trim() : "",
  password: typeof body.password === "string" ? body.password : ""
});

const validateCreateUserInput = ({ name, email, role, password }) => {
  const details = {};

  if (!name) {
    details.name = "Name is required";
  }
  if (!email || !validator.isEmail(email)) {
    details.email = "Valid email is required";
  }
  if (!["admin", "user"].includes(role)) {
    details.role = "Role must be admin or user";
  }
  if (!password || password.length < 8) {
    details.password = "Password must be at least 8 characters";
  }

  return Object.keys(details).length ? details : null;
};

const validateUpdateUserInput = ({ name, email, role, password }) => {
  const details = {};

  if (!name) {
    details.name = "Name is required";
  }
  if (!email || !validator.isEmail(email)) {
    details.email = "Valid email is required";
  }
  if (!["admin", "user"].includes(role)) {
    details.role = "Role must be admin or user";
  }
  if (password && password.length < 8) {
    details.password = "Password must be at least 8 characters";
  }

  return Object.keys(details).length ? details : null;
};

router.use(requireAdmin);

router.get("/", (req, res) => {
  return res.redirect("/admin/dashboard");
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const [totalUsers, totalPosts, featuredPosts] = await Promise.all([
      User.countDocuments({}),
      Post.countDocuments({}),
      Post.countDocuments({ isFeatured: true })
    ]);

    const latestPosts = await Post.find({})
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("author", "name");
    const latestUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(4)
      .select("name createdAt");

    const logs = [];
    latestPosts.forEach((post) => {
      logs.push({
        message: `${post.author ? post.author.name : "User"} published "${post.title}"`,
        category: "CONTENT",
        time: post.createdAt
      });
    });
    latestUsers.forEach((user) => {
      logs.push({
        message: `New user registered: ${user.name}`,
        category: "USER MANAGEMENT",
        time: user.createdAt
      });
    });
    logs.sort((a, b) => new Date(b.time) - new Date(a.time));

    if (wantsJson(req)) {
      return sendSuccess(res, 200, {
        stats: { totalUsers, totalPosts, featuredPosts },
        logs
      });
    }

    return res.status(200).render("admin-dashboard", {
      stats: { totalUsers, totalPosts, featuredPosts },
      logs
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 10, maxLimit: 100 });
    const [users, total] = await Promise.all([
      User.find({})
        .select("name email role createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments({})
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pagination = { page, limit, total, totalPages };

    if (wantsJson(req)) {
      return sendSuccess(res, 200, { users, pagination });
    }

    return res.status(200).render("admin-users", { users, pagination });
  } catch (err) {
    return next(err);
  }
});

router.get("/users/new", (req, res) => {
  return res.status(200).render("admin-user-form", {
    mode: "create",
    user: null,
    error: null,
    submitUrl: "/admin/users",
    successRedirect: "/admin/users"
  });
});

router.post("/users", async (req, res, next) => {
  try {
    const payload = normalizeUserPayload(req.body);
    const details = validateCreateUserInput(payload);
    if (details) {
      if (wantsJson(req)) {
        return sendError(res, 400, "Validation failed", details);
      }
      return res.status(400).render("admin-user-form", {
        mode: "create",
        user: payload,
        error: "Validation failed",
        submitUrl: "/admin/users",
        successRedirect: "/admin/users"
      });
    }

    const exists = await User.findOne({ email: payload.email });
    if (exists) {
      return sendError(res, 400, "Validation failed", { email: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await User.create({
      name: payload.name,
      email: payload.email,
      role: payload.role,
      passwordHash
    });

    if (wantsJson(req)) {
      return sendSuccess(res, 201, {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    }

    return res.redirect("/admin/users");
  } catch (err) {
    return next(err);
  }
});

router.get("/users/:id/edit", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).render("admin-user-form", {
        mode: "edit",
        user: null,
        error: "Invalid user id",
        submitUrl: null,
        successRedirect: "/admin/users"
      });
    }

    const user = await User.findById(id).select("name email role createdAt");
    if (!user) {
      return res.status(404).render("admin-user-form", {
        mode: "edit",
        user: null,
        error: "User not found",
        submitUrl: null,
        successRedirect: "/admin/users"
      });
    }

    return res.status(200).render("admin-user-form", {
      mode: "edit",
      user,
      error: null,
      submitUrl: `/admin/users/${user._id}`,
      successRedirect: "/admin/users"
    });
  } catch (err) {
    return next(err);
  }
});

router.put("/users/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid user id");
    }

    const payload = normalizeUserPayload(req.body);
    const details = validateUpdateUserInput(payload);
    if (details) {
      return sendError(res, 400, "Validation failed", details);
    }

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const emailOwner = await User.findOne({ email: payload.email });
    if (emailOwner && emailOwner._id.toString() !== id) {
      return sendError(res, 400, "Validation failed", { email: "Email already in use" });
    }

    if (id === req.session.userId && payload.role !== "admin") {
      return sendError(res, 400, "Validation failed", {
        role: "Admin cannot remove own admin role"
      });
    }

    user.name = payload.name;
    user.email = payload.email;
    user.role = payload.role;
    if (payload.password) {
      user.passwordHash = await bcrypt.hash(payload.password, 10);
    }
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

const deleteUserHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid user id");
    }

    if (id === req.session.userId) {
      return sendError(res, 400, "Admin cannot delete current session user");
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    await Post.deleteMany({ author: id });

    if (!wantsJson(req) && req.method === "POST") {
      return res.redirect("/admin/users");
    }
    return sendSuccess(res, 200, { message: "User deleted" });
  } catch (err) {
    return next(err);
  }
};

router.delete("/users/:id", deleteUserHandler);
router.post("/users/:id/delete", deleteUserHandler);

router.get("/posts", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 10, maxLimit: 100 });
    const [posts, total, aggregateStats] = await Promise.all([
      Post.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name email"),
      Post.countDocuments({}),
      Post.aggregate([
        {
          $group: {
            _id: null,
            totalViews: { $sum: { $ifNull: ["$viewCount", 0] } },
            featuredStories: {
              $sum: { $cond: [{ $eq: ["$isFeatured", true] }, 1, 0] }
            }
          }
        }
      ])
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pagination = { page, limit, total, totalPages };
    const stats = {
      totalPosts: total,
      totalViews: aggregateStats[0] ? aggregateStats[0].totalViews : 0,
      featuredStories: aggregateStats[0] ? aggregateStats[0].featuredStories : 0
    };

    if (wantsJson(req)) {
      return sendSuccess(res, 200, { posts, pagination, stats });
    }

    return res.status(200).render("admin-posts", { posts, pagination, stats });
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
        successRedirect: "/admin/posts",
        cancelHref: "/admin/posts",
        isAdminMode: true
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).render("post-form", {
        mode: "edit",
        post: null,
        error: "Post not found",
        submitUrl: null,
        successRedirect: "/admin/posts",
        cancelHref: "/admin/posts",
        isAdminMode: true
      });
    }

    return res.status(200).render("post-form", {
      mode: "edit",
      post,
      error: null,
      submitUrl: `/admin/posts/${post._id}`,
      successRedirect: "/admin/posts",
      cancelHref: "/admin/posts",
      isAdminMode: true
    });
  } catch (err) {
    return next(err);
  }
});

router.put("/posts/:id", postImageUpload.single("featuredImage"), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid post id");
    }

    const details = validatePostInput(req.body);
    if (details) {
      return sendError(res, 400, "Validation failed", details);
    }

    const post = await Post.findById(id).populate("author", "name email");
    if (!post) {
      return sendError(res, 404, "Post not found");
    }

    post.title = req.body.title.trim();
    post.content = req.body.content.trim();
    const categoryMeta = resolvePostCategoryInput({
      title: req.body.title,
      content: req.body.content,
      category: req.body.category
    });
    post.category = categoryMeta.category;
    post.autoCategory = categoryMeta.autoCategory;
    post.categorySource = categoryMeta.categorySource;
    if (req.file) {
      await deletePostImage(post.featuredImage);
      post.featuredImage = await uploadPostImage(req.file);
    }
    await post.save();

    return sendSuccess(res, 200, { post });
  } catch (err) {
    return next(err);
  }
});

const deletePostHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid post id");
    }

    const post = await Post.findByIdAndDelete(id);
    if (!post) {
      return sendError(res, 404, "Post not found");
    }
    await deletePostImage(post.featuredImage);

    if (!wantsJson(req) && req.method === "POST") {
      return res.redirect("/admin/posts");
    }
    return sendSuccess(res, 200, { message: "Post deleted" });
  } catch (err) {
    return next(err);
  }
};

router.delete("/posts/:id", deletePostHandler);
router.post("/posts/:id/delete", deletePostHandler);

router.patch("/posts/:id/feature", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid post id");
    }

    const post = await Post.findById(id).populate("author", "name email");
    if (!post) {
      return sendError(res, 404, "Post not found");
    }

    post.isFeatured = !post.isFeatured;
    await post.save();

    return sendSuccess(res, 200, { post });
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
