require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { connectDB } = require("./config/db");

const attachCurrentUser = require("./middleware/attachCurrentUser");
const csrfProtection = require("./middleware/csrfProtection");
const authRoutes = require("./routes/auth");
const publicRoutes = require("./routes/public");
const meRoutes = require("./routes/me");
const adminRoutes = require("./routes/admin");
const { sendError, wantsJson } = require("./utils/responses");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://code.jquery.com",
          "https://cdn.tailwindcss.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"]
      }
    }
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  session({
    name: "blog.sid",
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(attachCurrentUser);
app.use(csrfProtection);

app.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/", publicRoutes);
app.use("/auth", authRoutes);
app.use("/me", meRoutes);
app.post("/admin/bootstrap", authRoutes.bootstrapAdminHandler);
app.use("/admin", adminRoutes);

app.use((req, res) => {
  if (wantsJson(req)) {
    return sendError(res, 404, "Not found");
  }
  return res.status(404).render("error", { message: "Not found" });
});

app.use((err, req, res, next) => {
  void next;
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  if (wantsJson(req)) {
    return sendError(res, status, message);
  }

  return res.status(status).render("error", { message });
});

if (require.main === module) {
  connectDB();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
