const crypto = require("crypto");
const { sendError, wantsJson } = require("../utils/responses");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const getRequestOrigin = (req) => {
  const origin = req.get("origin");
  if (origin) return origin;

  const referer = req.get("referer");
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch (err) {
    return null;
  }
};

module.exports = (req, res, next) => {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
    res.cookie("csrfToken", req.session.csrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  }

  if (process.env.NODE_ENV === "test") {
    return next();
  }

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const host = `${req.protocol}://${req.get("host")}`;
  const reqOrigin = getRequestOrigin(req);
  const headerToken = req.get("x-csrf-token");
  const bodyToken = req.body && req.body._csrf;
  const sessionToken = req.session && req.session.csrfToken;

  const sameOrigin = reqOrigin && reqOrigin === host;
  const validToken =
    sessionToken &&
    ((typeof headerToken === "string" && headerToken === sessionToken) ||
      (typeof bodyToken === "string" && bodyToken === sessionToken));

  if (sameOrigin || validToken) {
    return next();
  }

  if (wantsJson(req)) {
    return sendError(res, 403, "CSRF validation failed");
  }

  return res.status(403).render("error", { message: "CSRF validation failed" });
};
