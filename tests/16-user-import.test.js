const {
  api, setToken, test,
  assert, assertStatus, summary, resetCounters, CONFIG,
} = require("./helpers");

/**
 * CS bulk-imports teachers from a CSV (POST /users/import), plus the account
 * guards around user management:
 *
 *   - dry run validates every row and creates nothing
 *   - import creates valid rows, reports each bad row with a reason, and skips
 *     emails that already have an account (re-uploading is safe)
 *   - roles follow designation; departments match by name or code
 *   - imported teachers can sign in with the default password
 *   - only CS may import; only CS may create or change a CS account;
 *     invigilators can't write users; protected fields can't be mass-assigned
 */
async function run(token) {
  console.log("\n📥 USER IMPORT + ACCOUNT GUARD TESTS\n");
  resetCounters();

  if (!token) {
    const res = await api.post("/auth/login", { email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD });
    token = res.data.data.token;
  }
  const adminToken = token;
  setToken(adminToken);

  const stamp = Date.now();
  const deptCode = `IM${stamp % 100000}`;
  const deptName = `Import Dept ${deptCode}`;
  const email = (tag) => `imp_${tag}_${stamp}@test.com`;
  const defaultPassword = "Welcome@123";
  let csId = null;
  let rsToken = null;
  let invToken = null;

  const as = async (authToken, fn) => {
    setToken(authToken);
    try {
      return await fn();
    } finally {
      setToken(adminToken);
    }
  };
  const expectStatus = async (status, fn) => {
    try {
      await fn();
    } catch (err) {
      assert(err.response && err.response.status === status, `expected ${status}, got ${err.response ? err.response.status : err.message}`);
      return err.response;
    }
    throw new Error(`expected ${status}, request succeeded`);
  };

  const rows = () => [
    { line: 2, name: "Asha Rao", email: email("asha"), phone: "9876543210", department: deptCode, designation: "Asst. Professor" },
    { line: 3, name: "Bala Iyer", email: email("bala"), phone: "+91 98765 43211", department: deptName, designation: "Professor" },
    { line: 4, name: "Chitra N", email: email("chitra"), phone: "9876543212", department: "", designation: "Other", role: "Invigilator" },
    { line: 5, name: "Bad Desig", email: email("bad"), phone: "9876543213", designation: "Lecturer" },
    { line: 6, name: "No Phone", email: email("nophone"), phone: "", designation: "Professor" },
    { line: 7, name: "Dup Email", email: email("asha"), phone: "9876543214", designation: "Professor" },
    { line: 8, name: "Ghost Dept", email: email("ghost"), phone: "9876543215", department: "Astrology", designation: "Professor" },
    { line: 9, name: "Other No Role", email: email("norole"), phone: "9876543216", designation: "Other" },
  ];

  await test("Setup: a department to match against", async () => {
    const res = await api.post("/departments", { name: deptName, code: deptCode });
    assertStatus(res, 201);
  });

  await test("Dry run validates every row and creates nothing", async () => {
    const res = await api.post("/users/import", { rows: rows(), defaultPassword, dryRun: true });
    assertStatus(res, 200);
    const { summary: s, results } = res.data.data;
    assert(s.ready === 3 && s.errors === 5 && s.created === 0, `summary ${JSON.stringify(s)}`);
    const byLine = Object.fromEntries(results.map((r) => [r.line, r]));
    assert(byLine[5].message.includes("Unknown designation"), "line 5: designation");
    assert(byLine[6].message.includes("Phone"), "line 6: phone");
    assert(byLine[7].message.includes("row 2"), "line 7: duplicate in file");
    assert(byLine[8].message.includes("Unknown department"), "line 8: department");
    assert(byLine[9].message.includes("needs a role"), "line 9: Other without role");
    const list = await api.get("/users");
    assert(!list.data.data.some((u) => u.email === email("asha")), "dry run must not create anyone");
  });

  await test("Import creates the valid rows with derived roles and canonical departments", async () => {
    const res = await api.post("/users/import", { rows: rows(), defaultPassword });
    assertStatus(res, 200);
    const s = res.data.data.summary;
    assert(s.created === 3 && s.errors === 5, `summary ${JSON.stringify(s)}`);
    const users = (await api.get("/users")).data.data;
    const asha = users.find((u) => u.email === email("asha"));
    const bala = users.find((u) => u.email === email("bala"));
    const chitra = users.find((u) => u.email === email("chitra"));
    assert(asha && asha.designation === "Assistant Professor" && asha.roles.join() === "invigilator", `asha ${JSON.stringify(asha)}`);
    assert(asha.department === deptName, `department by code → name, got ${asha.department}`);
    assert(bala && bala.roles.join() === "rs" && bala.department === deptName, `bala ${JSON.stringify(bala)}`);
    assert(chitra && chitra.roles.join() === "invigilator" && chitra.department == null, `chitra ${JSON.stringify(chitra)}`);
  });

  await test("Imported teachers sign in with the default password", async () => {
    const res = await api.post("/auth/login", { email: email("asha"), password: defaultPassword });
    assertStatus(res, 200);
    invToken = res.data.data.token;
    const rs = await api.post("/auth/login", { email: email("bala"), password: defaultPassword });
    rsToken = rs.data.data.token;
    assert(invToken && rsToken, "tokens");
  });

  await test("Re-uploading the same file skips existing accounts", async () => {
    const res = await api.post("/users/import", { rows: rows().slice(0, 3), defaultPassword });
    const s = res.data.data.summary;
    assert(s.created === 0 && s.skipped === 3, `summary ${JSON.stringify(s)}`);
  });

  await test("Import is CS-only (403 for RS)", async () => {
    await expectStatus(403, () => as(rsToken, () => api.post("/users/import", { rows: rows(), defaultPassword, dryRun: true })));
  });

  await test("An invigilator can't create users (403)", async () => {
    await expectStatus(403, () =>
      as(invToken, () =>
        api.post("/users", { name: "X", email: email("x"), password: "secret1", phone: "9000000000", designation: "Professor" })
      )
    );
  });

  await test("RS can't create a CS account (403)", async () => {
    await expectStatus(403, () =>
      as(rsToken, () =>
        api.post("/users", {
          name: "Sneaky",
          email: email("sneaky"),
          password: "secret1",
          phone: "9000000001",
          designation: "Other",
          roles: ["cs"],
        })
      )
    );
  });

  await test("RS can't edit a CS account (403)", async () => {
    const created = await api.post("/users", {
      name: "Second CS",
      email: email("cs2"),
      password: "secret12",
      phone: "9000000002",
      designation: "Other",
      roles: ["cs"],
    });
    csId = created.data.data._id || created.data.data.id;
    await expectStatus(403, () => as(rsToken, () => api.put(`/users/${csId}`, { email: email("hijack") })));
  });

  await test("Edits ignore protected fields (no mass assignment)", async () => {
    const asha = (await api.get("/users")).data.data.find((u) => u.email === email("asha"));
    const res = await api.put(`/users/${asha._id}`, { name: "Asha R", isActive: false, resetOtpAttempts: 0, password: "hacked1" });
    assertStatus(res, 200);
    assert(res.data.data.name === "Asha R" && res.data.data.isActive === true, `isActive must not change: ${JSON.stringify(res.data.data)}`);
    const login = await api.post("/auth/login", { email: email("asha"), password: defaultPassword });
    assertStatus(login, 200);
  });

  return summary("USER IMPORT");
}

module.exports = run;
if (require.main === module) run();
