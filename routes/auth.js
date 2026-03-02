const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sendSuccess, sendError } = require("../utils/responses");
const {
  validateRegisterInput,
  validateLoginInput,
  validateForgotPasswordInput
} = require("../utils/validators");

const router = express.Router();

const setSessionUser = (req, user) => {
  req.session.userId = user._id.toString();
  req.session.role = user.role;
};

router.post("/register", async (req, res, next) => {
  try {
    const details = validateRegisterInput(req.body);
    if (details) {
      return sendError(res, 400, "Validation failed", details);
    }

    const email = req.body.email.toLowerCase();
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 400, "Validation failed", { email: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({
      name: req.body.name.trim(),
      email,
      passwordHash,
      role: "user"
    });

    setSessionUser(req, user);
    return sendSuccess(res, 201, {
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

router.post("/login", async (req, res, next) => {
  try {
    const details = validateLoginInput(req.body);
    if (details) {
      return sendError(res, 400, "Validation failed", details);
    }

    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 401, "Invalid credentials");
    }

    const validPassword = await user.validatePassword(req.body.password);
    if (!validPassword) {
      return sendError(res, 401, "Invalid credentials");
    }

    setSessionUser(req, user);
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

router.post("/logout", (req, res) => {
  if (!req.session) {
    return sendSuccess(res, 200, { message: "Logged out" });
  }

  return req.session.destroy(() => {
    res.clearCookie("blog.sid");
    return sendSuccess(res, 200, { message: "Logged out" });
  });
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const details = validateForgotPasswordInput(req.body);
    if (details) {
      return sendError(res, 400, "Validation failed", details);
    }

    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 404, "Email not found");
    }

    user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    await user.save();

    return sendSuccess(res, 200, { message: "Password reset successful" });
  } catch (err) {
    return next(err);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const user = await User.findById(req.session.userId).select(
      "name email role createdAt"
    );
    if (!user) {
      return sendError(res, 401, "Unauthorized");
    }

    return sendSuccess(res, 200, { user });
  } catch (err) {
    return next(err);
  }
});

const bootstrapAdminHandler = async (req, res, next) => {
  try {
    const details = validateRegisterInput(req.body);
    if (details) {
      return sendError(res, 400, "Validation failed", details);
    }

    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount > 0) {
      return sendError(res, 403, "Bootstrap is disabled");
    }

    const email = req.body.email.toLowerCase();
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 400, "Validation failed", { email: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const admin = await User.create({
      name: req.body.name.trim(),
      email,
      passwordHash,
      role: "admin"
    });

    setSessionUser(req, admin);
    return sendSuccess(res, 201, {
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    return next(err);
  }
};

router.post("/bootstrap-admin", bootstrapAdminHandler);
router.bootstrapAdminHandler = bootstrapAdminHandler;

module.exports = router;
