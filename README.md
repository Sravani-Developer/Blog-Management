# Blog Management Platform (Backend-First, Role-Based)

Backend-first Blog Management Platform built with Node.js, Express, MongoDB/Mongoose, EJS, and session cookies.

This project now supports:
- public blog pages
- user registration/login and owner-only post CRUD
- admin dashboard, user management, and all-post management
- session-based auth (no JWT)
- CSRF protection and pagination
- Jest + Supertest integration tests

## Current Scope

### Public
- Home page with Featured + Recent posts
- Single post detail page
- About page
- Contact page
- Login and Register pages

### Auth (Session/Cookie)
- Register / login / logout
- Current session user endpoint
- Bootstrap first admin (once per DB)
- Forgot password (direct reset by email + new password, simplified flow)

### User Area (`/me`)
- Personal profile page
- Security page (password change)
- My Posts (owner-only CRUD)

### Admin Area (`/admin`)
- Dashboard
- User Management (CRUD)
- Posts Management (list/edit/delete/toggle featured)

## Tech Stack

- JavaScript (CommonJS)
- Node.js + Express
- MongoDB + Mongoose
- `express-session`
- `bcryptjs`, `validator`
- `helmet`, `morgan`
- `multer` (post image uploads)
- EJS (minimal server-rendered UI)
- Jest + Supertest
- `mongodb-memory-server` (automatic in-memory DB for tests)

## Architecture Summary

- Unified `User` model with role-based access:
  - `role: "admin" | "user"`
- `Post` model references `User` via `author`
- Session auth only (no JWT/OAuth)
- Consistent JSON API responses:
  - Success: `{ success: true, data: ... }`
  - Error: `{ success: false, error: "message", details?: ... }`
- HTML pages rendered for minimal UI flows

## Project Structure (Current)

```txt
blog_management/
  config/
    db.js
  middleware/
    attachCurrentUser.js
    csrfProtection.js
    requireAdmin.js
    requireAuth.js
    requireOwnershipOrAdmin.js
  models/
    User.js
    Post.js
  public/
    js/
      auth-header.js
    manifest.json
    service-worker.js
    sw-register.js
  routes/
    public.js
    auth.js
    me.js
    admin.js
  tests/
    auth.test.js
    posts.test.js
  uploads/
    posts/
  utils/
    responses.js
    validators.js
  views/
    partials/
      public-header.ejs
      auth-header.ejs
      admin-header.ejs
    home.ejs
    post-detail.ejs
    login.ejs
    register.ejs
    about.ejs
    contact.ejs
    me-posts.ejs
    me-settings.ejs
    me-security.ejs
    post-form.ejs
    admin-dashboard.ejs
    admin-posts.ejs
    admin-users.ejs
    admin-user-form.ejs
    error.ejs
  server.js
```

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas or local MongoDB

## Environment Variables

Create `.env` in project root:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/blog_management
SESSION_SECRET=replace-with-strong-secret
NODE_ENV=development
PORT=4000
```

Notes:
- Tests use `mongodb-memory-server` and do not require test DB env setup
- In production, set a strong `SESSION_SECRET`
- Rotate secrets immediately if they were exposed

## Install & Run

```bash
npm install
npm run dev
```

Server URL:
- `http://localhost:4000`

Health check:
- `GET /health`

Example response:
```json
{ "success": true, "data": { "status": "ok" } }
```

## Authentication & Session Behavior

- Session cookie name: `blog.sid`
- Session values on login:
  - `req.session.userId`
  - `req.session.role`
- Cookie settings:
  - `httpOnly: true`
  - `sameSite: "lax"`
  - `secure: true` in production (`NODE_ENV=production`)

## Admin Bootstrap (First Admin)

The first admin can be created only when no admin exists in the database.

### API bootstrap endpoint
- `POST /admin/bootstrap`

Alternative alias:
- `POST /auth/bootstrap-admin`

Example request:
```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "adminpass123"
}
```

Behavior:
- Creates a `User` with `role: "admin"`
- Starts a session automatically
- Further bootstrap requests are blocked (`403`)

## Current Routes (Final/Current Implementation)

## Public Routes

- `GET /` -> public home (featured + recent)
- `GET /posts/:id` -> public post detail
- `GET /login` -> login page
- `GET /register` -> register page
- `GET /about` -> about page
- `GET /contact` -> contact page

## Auth API (`/auth`)

- `POST /auth/register` -> register normal user (`role=user`)
- `POST /auth/login` -> login user/admin
- `POST /auth/logout` -> logout current session
- `POST /auth/forgot-password` -> reset password by email + new password (simplified)
- `GET /auth/me` -> current user info (session-based)
- `POST /auth/bootstrap-admin` -> bootstrap first admin (once per DB)

## User Routes (`/me`) - Protected

- `GET /me` -> account settings (personal info page)
- `PUT /me` -> update current user profile (name/email)
- `GET /me/security` -> security settings page
- `PUT /me/security/password` -> change password

### User Post CRUD (Owner-only)
- `GET /me/posts`
- `GET /me/posts/new`
- `POST /me/posts`
- `GET /me/posts/:id/edit`
- `PUT /me/posts/:id`
- `DELETE /me/posts/:id`

## Admin Routes (`/admin`) - Admin Only

- `GET /admin` -> redirects to `/admin/dashboard`
- `GET /admin/dashboard` -> admin dashboard

### Admin Users (CRUD)
- `GET /admin/users`
- `GET /admin/users/new`
- `POST /admin/users`
- `GET /admin/users/:id/edit`
- `PUT /admin/users/:id`
- `DELETE /admin/users/:id`

### Admin Posts
- `GET /admin/posts`
- `GET /admin/posts/:id/edit`
- `PUT /admin/posts/:id`
- `DELETE /admin/posts/:id`
- `PATCH /admin/posts/:id/feature`

## Validation Rules (Current)

## Register
- `name` required
- `email` must be valid
- `password` min length `8`
- email must be unique

## Login
- valid `email` required
- `password` required

## Forgot Password (simplified)
- valid `email` required
- `newPassword` min length `8`
- email must exist

## Post
- `title` required (3-120)
- `content` required (20-5000)
- invalid Mongo `ObjectId` -> `400`
- missing record -> `404`

## User Update (Admin/User)
- `name` required
- valid unique `email`
- role must be `admin` or `user` (admin user management)
- password min `8` if provided

## Authorization Rules

- `requireAuth`: any logged-in user
- `requireAdmin`: admin only
- `requireOwnershipOrAdmin`: owner can modify own post; admin can modify any post

Status behavior:
- `401` Unauthorized (no valid session)
- `403` Forbidden (ownership/role restriction)
- `404` Not Found

## CSRF Protection (Implemented)

This app uses server-side sessions and cookies, so CSRF protection is enabled.

### Current CSRF middleware behavior
- Middleware: `middleware/csrfProtection.js`
- Applied globally after session + current-user middleware
- Protects unsafe methods:
  - `POST`, `PUT`, `PATCH`, `DELETE`
- Validates same-origin via `Origin` / `Referer` (primary)
- Supports token-based fallback (`x-csrf-token` / `_csrf`)
- Bypassed in test environment (`NODE_ENV=test`) to keep Supertest flows deterministic

## Pagination (Implemented)

Real backend pagination is implemented for admin lists:

- `GET /admin/users?page=1&limit=10`
- `GET /admin/posts?page=1&limit=10`

JSON responses include:
```json
{
  "success": true,
  "data": {
    "users": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 42,
      "totalPages": 5
    }
  }
}
```

UI pages also use the pagination metadata for page controls and counts.

## File Uploads (Post Images)

- Uploads handled with `multer`
- Destination: `uploads/posts/`
- Allowed types:
  - PNG, JPG, JPEG, GIF, WEBP
- Max file size: `5MB`
- Files are served from:
  - `/uploads/...`

Home page behavior:
- Uses uploaded `post.featuredImage` when present
- Uses fallback image when absent
- Featured hero rotates through featured posts automatically

## UI Notes (Current)

- Minimal UI, backend-first focus
- Reusable headers across pages:
  - logged-out (`public-header`)
  - logged-in user (`auth-header`)
  - admin (`admin-header`)
- Settings dropdown actions shared via `public/js/auth-header.js`
- Admin Panel link appears in settings dropdown for admin users

## Testing

Run tests:

```bash
npm test
```

Current automated coverage includes (high level):
- Register + login success/failure
- Session-protected route behavior
- User post CRUD permissions (including forbidden cases)
- Admin edit/delete any post
- Admin users list and user CRUD
- Feature toggle for posts
- Public home endpoint
- Pagination responses for admin lists
- Forgot password success/failure

Current test status (latest):
- `18/18` passing

## PWA (Retained)

PWA basics remain in place:
- `public/manifest.json`
- `public/service-worker.js`
- `public/sw-register.js`

## Security Notes

- `helmet` enabled
- Session cookies are `httpOnly`
- `sameSite: "lax"`
- `secure` cookie in production
- Passwords stored as `bcrypt` hashes
- CSRF protection enabled (same-origin + token fallback)

### Important production hardening still recommended
- Replace current forgot-password flow with token/email-based reset
- Add rate limiting for login and password reset endpoints
- Add persistent audit logs
- Add server-side search/filtering for admin lists (beyond pagination)

## Scripts

- `npm run dev` - start server with nodemon
- `npm start` - start server normally
- `npm test` - run Jest + Supertest

## Manual Verification Checklist

1. Open `http://localhost:4000/`
2. Register a normal user at `/register`
3. Login at `/login`
4. Go to `/me/posts` and create a post
5. Edit/Delete only your own post
6. Bootstrap admin (once) via `POST /admin/bootstrap`
7. Login as admin via `/login`
8. Open `/admin/dashboard`
9. Open `/admin/users` and test create/edit/delete user
10. Open `/admin/posts` and feature a post
11. Confirm home page featured/recent sections update

## Troubleshooting

### `Invalid credentials` for admin login
- Ensure an admin user exists in the current DB
- Bootstrap first admin using `POST /admin/bootstrap`
- Login at `/login` (not old `/admin/login`)

### Tests fail on first run with Mongo binary download issues
- Re-run `npm test` (initial binary download can be transient)
- Ensure internet access is available for the first download by `mongodb-memory-server`

### Session not persisting
- Confirm server is accessed consistently via the same host/port
- Check browser cookie settings
- In production, ensure HTTPS for `secure` cookies

### Unauthorized after session expiry
- Protected UI fetch requests redirect to `/` in current pages (`/me`, `/me/security`, etc.)
