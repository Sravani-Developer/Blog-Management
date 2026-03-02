const sendSuccess = (res, status, data) => {
  return res.status(status).json({ success: true, data });
};

const sendError = (res, status, error, details) => {
  const payload = { success: false, error };
  if (typeof details !== "undefined") {
    payload.details = details;
  }
  return res.status(status).json(payload);
};

const wantsJson = (req) => {
  const accept = req.get("accept") || "";
  const contentType = req.get("content-type") || "";
  return (
    accept.includes("application/json") ||
    contentType.includes("application/json") ||
    req.xhr === true
  );
};

module.exports = { sendSuccess, sendError, wantsJson };
