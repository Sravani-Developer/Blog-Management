const mongoose = require("mongoose");
const validator = require("validator");
const { normalizeCategory } = require("./postCategories");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateRegisterInput = ({ name, email, password }) => {
  const details = {};

  if (typeof name !== "string" || name.trim() === "") {
    details.name = "Name is required";
  }
  if (typeof email !== "string" || !validator.isEmail(email)) {
    details.email = "Valid email is required";
  }
  if (typeof password !== "string" || password.length < 8) {
    details.password = "Password must be at least 8 characters";
  }

  return Object.keys(details).length ? details : null;
};

const validateLoginInput = ({ email, password }) => {
  const details = {};

  if (typeof email !== "string" || !validator.isEmail(email)) {
    details.email = "Valid email is required";
  }
  if (typeof password !== "string" || password.length === 0) {
    details.password = "Password is required";
  }

  return Object.keys(details).length ? details : null;
};

const validateForgotPasswordInput = ({ email, newPassword }) => {
  const details = {};

  if (typeof email !== "string" || !validator.isEmail(email)) {
    details.email = "Valid email is required";
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    details.newPassword = "New password must be at least 8 characters";
  }

  return Object.keys(details).length ? details : null;
};

const validatePostInput = ({ title, content, category }) => {
  const details = {};
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedContent = typeof content === "string" ? content.trim() : "";

  if (!normalizedTitle) {
    details.title = "Title is required";
  } else if (normalizedTitle.length < 3 || normalizedTitle.length > 120) {
    details.title = "Title must be 3-120 characters";
  }

  if (!normalizedContent) {
    details.content = "Content is required";
  } else if (normalizedContent.length < 20 || normalizedContent.length > 5000) {
    details.content = "Content must be 20-5000 characters";
  }

  if (
    typeof category === "string" &&
    category.trim() !== "" &&
    !normalizeCategory(category)
  ) {
    details.category = "Invalid category";
  }

  return Object.keys(details).length ? details : null;
};

module.exports = {
  isValidObjectId,
  validateRegisterInput,
  validateLoginInput,
  validateForgotPasswordInput,
  validatePostInput
};
