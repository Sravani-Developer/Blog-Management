const request = require("supertest");
const bcrypt = require("bcryptjs");

const app = require("../server");
const User = require("../models/User");
const Post = require("../models/Post");
const {
  startTestDatabase,
  clearCollections,
  stopTestDatabase
} = require("./mongo-memory");

const createUser = async ({
  name = "User",
  email = "user@example.com",
  role = "user",
  password = "password123"
} = {}) => {
  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({ name, email, passwordHash, role });
};

const loginAgent = async (email = "user@example.com", password = "password123") => {
  const agent = request.agent(app);
  const res = await agent.post("/auth/login").send({
    email,
    password
  });
  if (res.status !== 200) {
    throw new Error("Login failed in test setup");
  }
  return agent;
};

beforeAll(async () => {
  await startTestDatabase();
});

afterEach(async () => {
  await clearCollections([Post, User]);
});

afterAll(async () => {
  await stopTestDatabase();
});

describe("Posts authorization and admin management", () => {
  test("user can create post", async () => {
    await createUser();
    const agent = await loginAgent();
    const res = await agent.post("/me/posts").send({
      title: "First Post",
      content: "This is content long enough for validation checks."
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.post.title).toBe("First Post");
  });

  test("protected user posts route requires session", async () => {
    const res = await request(app)
      .get("/me/posts")
      .set("Accept", "application/json");
    expect(res.status).toBe(401);
  });

  test("user cannot edit another user's post", async () => {
    const owner = await createUser({
      name: "Owner",
      email: "owner@example.com"
    });
    await createUser({
      name: "Other",
      email: "other@example.com"
    });

    const post = await Post.create({
      title: "Owned Post",
      content: "This is content owned by the first user only.",
      author: owner._id
    });

    const otherAgent = await loginAgent("other@example.com", "password123");
    const res = await otherAgent.put(`/me/posts/${post._id}`).send({
      title: "Hacked",
      content: "This content should never be accepted for this post record."
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("user cannot delete another user's post", async () => {
    const owner = await createUser({
      name: "Owner",
      email: "owner2@example.com"
    });
    await createUser({
      name: "Other",
      email: "other2@example.com"
    });

    const post = await Post.create({
      title: "Owned Post",
      content: "This is content owned by the first user only.",
      author: owner._id
    });

    const otherAgent = await loginAgent("other2@example.com", "password123");
    const res = await otherAgent.delete(`/me/posts/${post._id}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("admin can edit/delete any post", async () => {
    const owner = await createUser({
      name: "Owner",
      email: "owner3@example.com"
    });
    await createUser({
      name: "Admin",
      email: "admin@example.com",
      role: "admin"
    });

    const post = await Post.create({
      title: "Target Post",
      content: "This content is for admin authorization testing only.",
      author: owner._id
    });

    const adminAgent = await loginAgent("admin@example.com", "password123");
    const updated = await adminAgent.put(`/admin/posts/${post._id}`).send({
      title: "Updated By Admin",
      content: "Admin updated this post with valid content for test coverage."
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.post.title).toBe("Updated By Admin");

    const deleted = await adminAgent.delete(`/admin/posts/${post._id}`);
    expect(deleted.status).toBe(200);
  });

  test("admin can list users", async () => {
    await createUser({ name: "Admin", email: "admin2@example.com", role: "admin" });
    await createUser({ name: "Normal", email: "normal@example.com" });

    const adminAgent = await loginAgent("admin2@example.com", "password123");
    const res = await adminAgent.get("/admin/users").set("Accept", "application/json");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.users)).toBe(true);
    expect(res.body.data.users.length).toBe(2);
  });

  test("admin users/posts endpoints support pagination", async () => {
    await createUser({ name: "Admin", email: "adminpage@example.com", role: "admin" });
    const owner = await createUser({ name: "OwnerPg", email: "ownerpg@example.com" });
    for (let i = 0; i < 12; i += 1) {
      await createUser({ name: `User${i}`, email: `user${i}@example.com` });
    }
    for (let i = 0; i < 12; i += 1) {
      await Post.create({
        title: `Post ${i}`,
        content: `This is pagination test content for post ${i} and it is long enough.`,
        author: owner._id
      });
    }

    const adminAgent = await loginAgent("adminpage@example.com", "password123");
    const usersRes = await adminAgent
      .get("/admin/users?page=2&limit=5")
      .set("Accept", "application/json");
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.data.pagination.page).toBe(2);
    expect(usersRes.body.data.pagination.limit).toBe(5);
    expect(usersRes.body.data.users.length).toBe(5);

    const postsRes = await adminAgent
      .get("/admin/posts?page=2&limit=5")
      .set("Accept", "application/json");
    expect(postsRes.status).toBe(200);
    expect(postsRes.body.data.pagination.page).toBe(2);
    expect(postsRes.body.data.pagination.limit).toBe(5);
    expect(postsRes.body.data.posts.length).toBe(5);
  });

  test("my posts supports sorting by most viewed and featured first", async () => {
    const user = await createUser({ name: "Sort User", email: "sort@example.com" });
    const agent = await loginAgent("sort@example.com", "password123");

    await Post.create({
      title: "Low Views",
      content: "This content exists for sorting tests and is long enough.",
      author: user._id,
      viewCount: 3,
      isFeatured: false
    });
    await Post.create({
      title: "Most Views",
      content: "This content exists for sorting tests and is long enough.",
      author: user._id,
      viewCount: 120,
      isFeatured: false
    });
    await Post.create({
      title: "Featured Post",
      content: "This content exists for sorting tests and is long enough.",
      author: user._id,
      viewCount: 20,
      isFeatured: true
    });

    const viewedRes = await agent
      .get("/me/posts?sort=most-viewed&limit=10")
      .set("Accept", "application/json");
    expect(viewedRes.status).toBe(200);
    expect(viewedRes.body.data.pagination.sort).toBe("most-viewed");
    expect(viewedRes.body.data.posts[0].title).toBe("Most Views");

    const featuredRes = await agent
      .get("/me/posts?sort=featured&limit=10")
      .set("Accept", "application/json");
    expect(featuredRes.status).toBe(200);
    expect(featuredRes.body.data.pagination.sort).toBe("featured");
    expect(featuredRes.body.data.posts[0].title).toBe("Featured Post");
  });

  test("admin can create, update, and delete user", async () => {
    await createUser({ name: "Admin", email: "admincrud@example.com", role: "admin" });
    const adminAgent = await loginAgent("admincrud@example.com", "password123");

    const createRes = await adminAgent.post("/admin/users").send({
      name: "Managed User",
      email: "managed@example.com",
      role: "user",
      password: "managed123"
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const createdId = createRes.body.data.user.id;

    const updateRes = await adminAgent.put(`/admin/users/${createdId}`).send({
      name: "Managed User Updated",
      email: "managed-updated@example.com",
      role: "user",
      password: ""
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.user.name).toBe("Managed User Updated");

    const deleteRes = await adminAgent.delete(`/admin/users/${createdId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  test("feature toggle changes isFeatured", async () => {
    const owner = await createUser({ name: "Owner", email: "owner4@example.com" });
    await createUser({ name: "Admin", email: "admin3@example.com", role: "admin" });
    const post = await Post.create({
      title: "Feature Toggle Post",
      content: "This post is for feature toggle test coverage content.",
      author: owner._id,
      isFeatured: false
    });

    const adminAgent = await loginAgent("admin3@example.com", "password123");
    const res = await adminAgent.patch(`/admin/posts/${post._id}/feature`);

    expect(res.status).toBe(200);
    expect(res.body.data.post.isFeatured).toBe(true);
  });

  test("public home returns featured and recent ordered sections", async () => {
    const owner = await createUser({ name: "Owner", email: "owner5@example.com" });

    const oldPost = await Post.create({
      title: "Older Recent Post",
      content: "This is old content but still valid and long enough.",
      author: owner._id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    });
    const newPost = await Post.create({
      title: "Newer Recent Post",
      content: "This is newer content and long enough for validation too.",
      author: owner._id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      isFeatured: true
    });

    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Featured Posts");
    expect(res.text).toContain("Recent Posts");
    expect(res.text).toContain("Newer Recent Post");
    expect(res.text).toContain("Older Recent Post");

    const dbFeatured = await Post.find({ isFeatured: true }).sort({ updatedAt: -1 }).limit(5);
    const dbRecent = await Post.find({}).sort({ createdAt: -1 }).limit(10);
    expect(dbFeatured[0]._id.toString()).toBe(newPost._id.toString());
    expect(dbRecent[0]._id.toString()).toBe(newPost._id.toString());
    expect(dbRecent[1]._id.toString()).toBe(oldPost._id.toString());
  });
});
