const {
  api, setToken, clearToken, test, skip,
  assert, assertEqual, assertExists, assertStatus, summary, CONFIG,
} = require("./helpers");

async function run() {
  console.log("\n🔐 AUTH TESTS\n");

  let token = null;
  let userId = null;

  // --- Bootstrap ---
  await test("POST /users/bootstrap - create initial admin", async () => {
    try {
      const res = await api.post("/users/bootstrap");
      assertExists(res.data.data, "response data");
    } catch (err) {
      // 409 means already bootstrapped - that's fine
      if (err.response && err.response.status === 409) {
        console.log("     (admin already exists, continuing)");
      } else {
        throw err;
      }
    }
  });

  // --- Register ---
  const testEmail = `testuser_${Date.now()}@test.com`;

  // Self-registration is closed: accounts come from the exam cell (Teachers page
  // or CSV import). It used to let anyone mint a CS account ("Other" + "cs").
  await test("POST /auth/register - sign-up is closed (403)", async () => {
    try {
      await api.post("/auth/register", {
        name: "Test User",
        email: testEmail,
        password: "test123456",
        phone: "9990000001",
        designation: "Other",
        roles: ["invigilator"],
      });
      throw new Error("Should have thrown 403");
    } catch (err) {
      assert(err.response && err.response.status === 403, `Expected 403, got ${err.response?.status}`);
    }
  });

  await test("POST /auth/register - cannot mint a CS account (403)", async () => {
    try {
      await api.post("/auth/register", {
        name: "Would-be Admin",
        email: `cs_${testEmail}`,
        password: "test123456",
        phone: "9990000002",
        designation: "Other",
        roles: ["cs"],
      });
      throw new Error("Should have thrown 403");
    } catch (err) {
      assert(err.response && err.response.status === 403, `Expected 403, got ${err.response?.status}`);
    }
  });

  // --- Login ---
  await test("POST /auth/login - valid credentials", async () => {
    const res = await api.post("/auth/login", {
      email: CONFIG.ADMIN_EMAIL,
      password: CONFIG.ADMIN_PASSWORD,
    });
    assertStatus(res, 200);
    assertExists(res.data.data.token, "token");
    token = res.data.data.token;
    userId = res.data.data.user.id || res.data.data.user._id;
    setToken(token);
  });

  await test("POST /auth/login - wrong password should fail", async () => {
    try {
      await api.post("/auth/login", {
        email: CONFIG.ADMIN_EMAIL,
        password: "wrongpassword",
      });
      throw new Error("Should have failed");
    } catch (err) {
      assert(err.response && err.response.status === 401, "Should return 401");
    }
  });

  await test("POST /auth/login - non-existent email should fail", async () => {
    try {
      await api.post("/auth/login", {
        email: "nonexistent@test.com",
        password: "test123",
      });
      throw new Error("Should have failed");
    } catch (err) {
      assert(err.response && err.response.status >= 400, "Should return 4xx");
    }
  });

  // --- Get Me ---
  await test("GET /auth/me - authenticated", async () => {
    const res = await api.get("/auth/me");
    assertStatus(res, 200);
    assertExists(res.data.data.email, "email");
  });

  await test("GET /auth/me - no token should fail", async () => {
    clearToken();
    try {
      await api.get("/auth/me");
      throw new Error("Should have failed");
    } catch (err) {
      assert(err.response && err.response.status === 401, "Should return 401");
    }
    setToken(token);
  });

  await test("GET /auth/me - invalid token should fail", async () => {
    const originalToken = api.defaults.headers.common["Authorization"];
    api.defaults.headers.common["Authorization"] = "Bearer invalidtoken123";
    try {
      await api.get("/auth/me");
      throw new Error("Should have failed");
    } catch (err) {
      assert(err.response && err.response.status === 401, "Should return 401");
    }
    api.defaults.headers.common["Authorization"] = originalToken;
  });

  const result = summary("AUTH");

  // Export for runner
  module.exports.token = token;
  module.exports.userId = userId;

  return result;
}

module.exports = run;
module.exports.token = null;
module.exports.userId = null;

if (require.main === module) run();
