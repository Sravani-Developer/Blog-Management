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

beforeAll(async () => {
  await startTestDatabase();
});

afterEach(async () => {
  await clearCollections([Post, User]);
});

afterAll(async () => {
  await stopTestDatabase();
});

describe("Session auth", () => {
  test("register + login success", async () => {
    const register = await request(app).post("/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "password123"
    });
    expect(register.status).toBe(201);
    expect(register.body.success).toBe(true);
    expect(register.body.data.user.role).toBe("user");

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "password123"
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe("alice@example.com");
  });

  test("login failure: wrong password", async () => {
    await createUser();
    const res = await request(app).post("/auth/login").send({
      email: "user@example.com",
      password: "wrong-password"
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("login failure: validation", async () => {
    const res = await request(app).post("/auth/login").send({
      email: ""
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Validation failed");
  });

  test("protected route blocked without login", async () => {
    const res = await request(app)
      .get("/me/posts")
      .set("Accept", "application/json");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("protected route allowed after login + logout clears session", async () => {
    await createUser();
    const agent = request.agent(app);
    const login = await agent.post("/auth/login").send({
      email: "user@example.com",
      password: "password123"
    });
    expect(login.status).toBe(200);

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.success).toBe(true);
    expect(me.body.data.user.email).toBe("user@example.com");

    const logout = await agent.post("/auth/logout");
    expect(logout.status).toBe(200);

    const blocked = await agent
      .get("/me/posts")
      .set("Accept", "application/json");
    expect(blocked.status).toBe(401);
  });

  test("bootstrap admin only once", async () => {
    const first = await request(app).post("/admin/bootstrap").send({
      name: "Root",
      email: "root@example.com",
      password: "password123"
    });
    expect(first.status).toBe(201);
    expect(first.body.data.user.role).toBe("admin");

    const second = await request(app).post("/auth/bootstrap-admin").send({
      name: "Root2",
      email: "root2@example.com",
      password: "password123"
    });
    expect(second.status).toBe(403);
  });

  test("forgot password success updates credentials", async () => {
    await createUser({
      name: "Reset User",
      email: "reset@example.com",
      password: "oldpass123"
    });

    const reset = await request(app).post("/auth/forgot-password").send({
      email: "reset@example.com",
      newPassword: "newpass123"
    });
    expect(reset.status).toBe(200);
    expect(reset.body.success).toBe(true);

    const oldLogin = await request(app).post("/auth/login").send({
      email: "reset@example.com",
      password: "oldpass123"
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/auth/login").send({
      email: "reset@example.com",
      password: "newpass123"
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.success).toBe(true);
  });

  test("forgot password fails for unknown email", async () => {
    const reset = await request(app).post("/auth/forgot-password").send({
      email: "missing@example.com",
      newPassword: "newpass123"
    });
    expect(reset.status).toBe(404);
    expect(reset.body.success).toBe(false);
  });
});
