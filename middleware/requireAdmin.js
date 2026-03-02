const { sendError } = require("../utils/responses");

module.exports = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    const accepts = req.get("accept") || "";
    if (!accepts.includes("application/json")) {
      return res.redirect(302, "/");
    }
    return sendError(res, 401, "Unauthorized");
  }
  if (req.session.role !== "admin") {
    return sendError(res, 403, "Forbidden");
  }
  return next();
};
