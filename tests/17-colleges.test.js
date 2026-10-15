const {
  api, eventually, setToken, test,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

/**
 * Multi-college (MULTI_COLLEGE_PLAN.md): a second college, created by the
 * superadmin, is fenced off from the main one in both directions.
 *
 *   - superadmin creates a college with its first CS; the CS signs in there
 *   - same department / building names in two colleges don't collide
 *   - college B's CS sees none of the main college's teachers, departments,
 *     exams, duties or audit trail, and can't read, edit or delete them by id
 *   - a B teacher can't claim a main-college exam; "tell CS" alerts stay in B
 *   - emails are unique platform-wide
 *   - feature switches: a disabled exam type can't be created and its existing
 *     exams disappear from listings (still resolvable by id), back when re-enabled
 *   - suspending a college signs its users out and blocks sign-in
 *   - the superadmin manages colleges and CS accounts but can't open college data;
 *     nobody else can open the superadmin console
 *
 * Needs a superadmin: `node scripts/create-superadmin.js` with the credentials in
 * config.js (CI does this before the suite).
 */
async function run(token) {
  console.log("\n🏫 MULTI-COLLEGE ISOLATION TESTS\n");
  resetCounters();

  if (!token) {
    const res = await api.post("/auth/login", { email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD });
    token = res.data.data.token;
  }
  const mainToken = token;
  setToken(mainToken);

  const stamp = Date.now();
  const code = `ISO${stamp % 1000000}`;
  const email = (tag) => `col_${tag}_${stamp}@test.com`;
  const sharedDept = { name: `Shared Dept ${stamp}`, code: `SD${stamp % 100000}` };
  const sharedBuilding = `Shared Block ${stamp}`;
  const csBPassword = "csb12345";
  let superToken = null;
  let collegeId = null;
  let csBToken = null;
  let csBId = null;
  let mainDeptId = null;
  let mainExamGroupId = null;
  let mainExamId = null;
  let mainAdminId = null;
  let bTeacherToken = null;
  let bSeeGroupId = null;

  const as = async (authToken, fn) => {
    setToken(authToken);
    try {
      return await fn();
    } finally {
      setToken(mainToken);
    }
  };
  const expectStatus = async (status, fn) => {
    try {
      await fn();
    } catch (err) {
      const got = err.response ? err.response.status : err.message;
      assert(err.response && [].concat(status).includes(err.response.status), `expected ${status}, got ${got}`);
      return err.response;
    }
    throw new Error(`expected ${status}, request succeeded`);
  };
  const login = (e, password) => api.post("/auth/login", { email: e, password });

  // ── Setup ────────────────────────────────────────────────────────────────
  await test("Superadmin signs in", async () => {
    const res = await login(CONFIG.SUPERADMIN_EMAIL, CONFIG.SUPERADMIN_PASSWORD);
    assertStatus(res, 200);
    superToken = res.data.data.token;
    assert(res.data.data.user.activeRole === "superadmin", "superadmin role");
    assert(res.data.data.user.college === null, "superadmin belongs to no college");
  });

  await test("Superadmin creates a college with its first CS", async () => {
    const res = await as(superToken, () =>
      api.post("/platform/colleges", {
        name: `Isolation College ${stamp}`,
        code,
        cs: { name: "B Admin", email: email("csb"), phone: "9100000001", password: csBPassword },
      })
    );
    assertStatus(res, 201);
    collegeId = res.data.data.id;
    assert(res.data.data.features.cie && res.data.data.features.see, "both exam types on by default");
    assert(res.data.data.csAccounts.length === 1, "one CS account");
    csBId = res.data.data.csAccounts[0]._id;
  });

  await test("The new CS signs in to their own college", async () => {
    const res = await login(email("csb"), csBPassword);
    assertStatus(res, 200);
    csBToken = res.data.data.token;
    const me = await as(csBToken, () => api.get("/auth/me"));
    assert(me.data.data.college && me.data.data.college.code === code, `college on /me: ${JSON.stringify(me.data.data.college)}`);
  });

  await test("Main college: a department, exam group, legacy exam to probe with", async () => {
    const dept = await api.post("/departments", sharedDept);
    mainDeptId = dept.data.data._id;
    // Dates unique to this run, so a rerun on the same database doesn't hit the overlap check.
    const offset = 200 + (stamp % 3000);
    const group = await api.post("/exam-groups", { examType: "IA1", semester: 2, startDate: futureDate(offset), endDate: futureDate(offset + 2) });
    mainExamGroupId = group.data.data._id;
    const exam = await api.post("/exams", { name: "Main Exam", date: futureDate(30), department: "CSE", semester: 2, type: "internal" });
    mainExamId = exam.data.data._id;
    const me = await api.get("/auth/me");
    mainAdminId = me.data.data.id;
    await api.post("/infrastructure/buildings", { name: sharedBuilding });
    assertExists(mainDeptId && mainExamGroupId && mainExamId && mainAdminId, "main fixtures");
  });

  // ── Isolation ────────────────────────────────────────────────────────────
  await test("Same department and building names are fine in another college", async () => {
    const dept = await as(csBToken, () => api.post("/departments", sharedDept));
    assertStatus(dept, 201);
    const b = await as(csBToken, () => api.post("/infrastructure/buildings", { name: sharedBuilding }));
    assertStatus(b, 201);
  });

  await test("College B lists only its own teachers, departments, exams, buildings", async () => {
    const users = (await as(csBToken, () => api.get("/users?includeInactive=true"))).data.data;
    assert(users.length === 1 && users[0].email === email("csb"), `B users: ${users.map((u) => u.email)}`);
    const depts = (await as(csBToken, () => api.get("/departments"))).data.data;
    assert(depts.every((d) => d._id !== mainDeptId) && depts.length === 1, `B departments: ${depts.length}`);
    const groups = (await as(csBToken, () => api.get("/exam-groups"))).data.data;
    assert(groups.length === 0, `B exam groups: ${groups.length}`);
    const exams = (await as(csBToken, () => api.get("/exams"))).data.data;
    assert(exams.length === 0, `B exams: ${exams.length}`);
    const buildings = (await as(csBToken, () => api.get("/infrastructure/buildings"))).data.data;
    assert(buildings.length === 1, `B buildings: ${buildings.length}`);
  });

  await test("College B can't read, edit or delete main-college records by id", async () => {
    await expectStatus(404, () => as(csBToken, () => api.get(`/users/${mainAdminId}`)));
    await expectStatus(404, () => as(csBToken, () => api.put(`/users/${mainAdminId}`, { name: "Hijacked" })));
    await expectStatus(404, () => as(csBToken, () => api.delete(`/users/${mainAdminId}`)));
    await expectStatus([400, 404], () => as(csBToken, () => api.patch(`/departments/${mainDeptId}`, { name: "Hijacked" })));
    await expectStatus([400, 404], () => as(csBToken, () => api.get(`/exam-groups/${mainExamGroupId}`)));
    await expectStatus([400, 404], () => as(csBToken, () => api.get(`/exams/${mainExamId}`)));
    const me = await api.get("/auth/me");
    assert(me.data.data.name !== "Hijacked", "main admin untouched");
  });

  await test("College B's audit trail has none of the main college's entries", async () => {
    // An audited action in each college first, so neither list is empty by accident.
    await api.post("/users", { name: "Main Audited", email: email("mainaud"), password: "secret1", phone: "9100000006", designation: "Professor" });
    const main = (await api.get("/audit")).data.data;
    assert(Array.isArray(main) && main.some((r) => JSON.stringify(r).includes(email("mainaud"))), "main audit has its entry");
    await as(csBToken, () =>
      api.post("/users", { name: "B Audited", email: email("baud"), password: "secret1", phone: "9100000007", designation: "Professor" })
    );
    const b = (await as(csBToken, () => api.get("/audit"))).data.data;
    assert(Array.isArray(b) && b.length > 0, "B audit has its own entries");
    assert(!JSON.stringify(b).includes(email("mainaud")), "B audit must not show the main college's entry");
    assert(!JSON.stringify(main).includes(email("baud")), "main audit must not show B's entries");
  });

  await test("Emails are unique across colleges (409)", async () => {
    await expectStatus(409, () =>
      as(csBToken, () =>
        api.post("/users", { name: "Dup", email: CONFIG.ADMIN_EMAIL, password: "secret1", phone: "9100000002", designation: "Professor" })
      )
    );
  });

  await test("A B teacher can't claim a main-college exam", async () => {
    await as(csBToken, () =>
      api.post("/users", { name: "B Teacher", email: email("bt"), password: "teach123", phone: "9100000003", designation: "Other", role: "invigilator" })
    );
    bTeacherToken = (await login(email("bt"), "teach123")).data.data.token;
    await expectStatus([400, 404], () =>
      as(bTeacherToken, () =>
        api.post("/duties/self-assign", { exam: mainExamId, room: "B1", date: futureDate(30), startTime: "09:00", endTime: "12:00" })
      )
    );
  });

  await test("A B teacher's release alerts B's CS, not the main college's", async () => {
    const examB = await as(csBToken, () =>
      api.post("/exams", { name: "B Exam", date: futureDate(31), department: "CSE", semester: 2, type: "internal" })
    );
    const duty = await as(bTeacherToken, () =>
      api.post("/duties/self-assign", { exam: examB.data.data._id, room: "B2", date: futureDate(31), startTime: "09:00", endTime: "12:00" })
    );
    assertStatus(duty, 201);
    await as(bTeacherToken, () => api.patch(`/duties/${duty.data.data._id}/cancel`, { reason: "isolation test" }));
    // The CS alert is fire-and-forget (written just after the response).
    const bFeed = await eventually(
      async () => (await as(csBToken, () => api.get("/notifications"))).data.data,
      (list) => list.some((n) => n.type === "duty_released_by_teacher")
    );
    assert(bFeed.some((n) => n.type === "duty_released_by_teacher"), `B CS feed: ${bFeed.map((n) => n.type)}`);
    const mainFeed = (await api.get("/notifications")).data.data;
    assert(!mainFeed.some((n) => (n.message || "").includes("B Teacher")), "main CS must not hear about B's teacher");
    const mainDuties = (await api.get("/duties")).data.data;
    assert(!mainDuties.some((d) => String(d._id) === String(duty.data.data._id)), "B duty not in main listing");
  });

  // ── Feature switches ─────────────────────────────────────────────────────
  await test("Turning SEE off: no new SEE exams, existing ones hidden (still open by id)", async () => {
    const see = await as(csBToken, () =>
      api.post("/exam-groups", { examType: "SEE", semester: 3, startDate: futureDate(50), endDate: futureDate(55) })
    );
    bSeeGroupId = see.data.data._id;
    const off = await as(superToken, () => api.patch(`/platform/colleges/${collegeId}`, { features: { see: false } }));
    assert(off.data.data.features.see === false && off.data.data.features.cie === true, "switch saved");

    const me = await as(csBToken, () => api.get("/auth/me"));
    assert(me.data.data.college.features.see === false, "/me reports the switch");
    await expectStatus(403, () =>
      as(csBToken, () => api.post("/exam-groups", { examType: "SEE", semester: 4, startDate: futureDate(60), endDate: futureDate(65) }))
    );
    const cie = await as(csBToken, () =>
      api.post("/exam-groups", { examType: "IA2", semester: 4, startDate: futureDate(60), endDate: futureDate(65) })
    );
    assertStatus(cie, 201);
    const listed = (await as(csBToken, () => api.get("/exam-groups"))).data.data;
    assert(!listed.some((g) => g._id === bSeeGroupId), "SEE exam hidden from the list");
    assert(listed.some((g) => g.examType === "IA2"), "CIE exam listed");
    const byId = await as(csBToken, () => api.get(`/exam-groups/${bSeeGroupId}`));
    assertStatus(byId, 200);
  });

  await test("Turning SEE back on restores its exams", async () => {
    await as(superToken, () => api.patch(`/platform/colleges/${collegeId}`, { features: { see: true } }));
    const listed = (await as(csBToken, () => api.get("/exam-groups"))).data.data;
    assert(listed.some((g) => g._id === bSeeGroupId), "SEE exam back");
  });

  await test("Switches are per college — the main college still has SEE", async () => {
    await as(superToken, () => api.patch(`/platform/colleges/${collegeId}`, { features: { see: false } }));
    const me = await api.get("/auth/me");
    assert(me.data.data.college.features.see === true, "main college unaffected");
    await as(superToken, () => api.patch(`/platform/colleges/${collegeId}`, { features: { see: true } }));
  });

  // ── Suspension ───────────────────────────────────────────────────────────
  await test("Suspending a college signs its users out and blocks sign-in", async () => {
    await as(superToken, () => api.patch(`/platform/colleges/${collegeId}`, { status: "suspended" }));
    await expectStatus(401, () => as(csBToken, () => api.get("/auth/me")));
    await expectStatus(403, () => login(email("csb"), csBPassword));
    const main = await api.get("/auth/me");
    assertStatus(main, 200);
    await as(superToken, () => api.patch(`/platform/colleges/${collegeId}`, { status: "active" }));
    const back = await login(email("csb"), csBPassword);
    assertStatus(back, 200);
    csBToken = back.data.data.token;
  });

  // ── Superadmin boundaries ────────────────────────────────────────────────
  await test("Superadmin lists colleges with counts", async () => {
    const res = await as(superToken, () => api.get("/platform/colleges"));
    const b = res.data.data.find((c) => c.id === collegeId);
    assert(b && b.counts.teachers === 3, `B counts: ${JSON.stringify(b && b.counts)}`); // CS + B Audited + B Teacher
    assert(res.data.data.length >= 2, "main + B");
  });

  await test("Superadmin manages a college's CS accounts", async () => {
    const added = await as(superToken, () =>
      api.post(`/platform/colleges/${collegeId}/cs`, { name: "B Second CS", email: email("csb2"), phone: "9100000004", password: "second12" })
    );
    const second = added.data.data.csAccounts.find((u) => u.email === email("csb2"));
    assertExists(second, "second CS");
    await as(superToken, () => api.post(`/platform/colleges/${collegeId}/cs/${second._id}/reset-password`, { password: "rotated12" }));
    assertStatus(await login(email("csb2"), "rotated12"), 200);
    await as(superToken, () => api.patch(`/platform/colleges/${collegeId}/cs/${second._id}`, { active: false }));
    await expectStatus(401, () => login(email("csb2"), "rotated12"));
    await expectStatus(404, () => as(superToken, () => api.post(`/platform/colleges/${collegeId}/cs/${mainAdminId}/reset-password`, { password: "nope1234" })));
  });

  await test("Superadmin can't open a college's data", async () => {
    await expectStatus(403, () => as(superToken, () => api.get("/users")));
    await expectStatus(403, () => as(superToken, () => api.get("/exam-groups")));
    await expectStatus(403, () => as(superToken, () => api.get("/duties")));
  });

  await test("Nobody else can open the superadmin console (403)", async () => {
    await expectStatus(403, () => api.get("/platform/colleges"));
    await expectStatus(403, () => as(csBToken, () => api.patch(`/platform/colleges/${collegeId}`, { features: { see: false } })));
  });

  await test("Superadmin rejects unknown switches and a taken CS email", async () => {
    await expectStatus(400, () => as(superToken, () => api.patch(`/platform/colleges/${collegeId}`, { features: { billing: true } })));
    await expectStatus(409, () =>
      as(superToken, () =>
        api.post("/platform/colleges", { name: `Dup ${stamp}`, code: `D${code}`, cs: { name: "X", email: CONFIG.ADMIN_EMAIL, phone: "9100000005", password: "secret12" } })
      )
    );
  });

  void csBId;
  return summary("MULTI-COLLEGE");
}

module.exports = run;
if (require.main === module) run();
