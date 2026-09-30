const {
  api, setToken, test,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

/**
 * Duty confirmation + the CS responsiveness report (REMINDERS_PLAN.md):
 *
 *   - CS-assigned duties start unconfirmed; self-claimed ones are confirmed
 *   - a teacher confirms their own duty (and nobody else's)
 *   - a bad email link is refused with a readable page, not JSON
 *   - a cancelled duty can't be confirmed
 *   - /reports/responsiveness is CS-only and reflects the confirmation state
 */
async function run(token) {
  console.log("\n✅ CONFIRMATION TESTS\n");
  resetCounters();

  if (!token) {
    const res = await api.post("/auth/login", {
      email: CONFIG.ADMIN_EMAIL,
      password: CONFIG.ADMIN_PASSWORD,
    });
    token = res.data.data.token;
  }
  const adminToken = token;
  setToken(adminToken);

  const stamp = Date.now();
  const dutyDate = futureDate(35);
  const password = "teacher123";
  let examId = null;
  const teachers = {
    a: { email: `confirm_a_${stamp}@test.com`, name: "Confirm Teacher A", phone: "9990000051" },
    b: { email: `confirm_b_${stamp}@test.com`, name: "Confirm Teacher B", phone: "9990000052" },
  };
  let assignedId = null;
  let selfId = null;

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
      assert(
        err.response && err.response.status === status,
        `expected ${status}, got ${err.response ? err.response.status : err.message}`
      );
      return err.response;
    }
    throw new Error(`expected ${status}, request succeeded`);
  };

  await test("Setup: exam + two invigilators", async () => {
    const res = await api.post("/exams", {
      name: "Confirmation Test Exam",
      date: dutyDate,
      department: "CSE",
      semester: 4,
      type: "internal",
    });
    examId = res.data.data._id || res.data.data.id;
    for (const t of Object.values(teachers)) {
      const u = await api.post("/users", {
        name: t.name,
        email: t.email,
        password,
        phone: t.phone,
        designation: "Other",
        role: "invigilator",
      });
      t.id = u.data.data._id || u.data.data.id;
      const login = await api.post("/auth/login", { email: t.email, password });
      t.token = login.data.data.token;
    }
    assertExists(teachers.b.token, "teacher B token");
  });

  await test("A CS-assigned duty starts unconfirmed", async () => {
    const res = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teachers.a.id,
      role: "invigilator",
      room: "901",
      date: dutyDate,
      startTime: "09:00",
      endTime: "12:00",
    });
    assertStatus(res, 201);
    assignedId = res.data.data._id || res.data.data.id;
    assert(res.data.data.confirmedAt === null, `confirmedAt should be null, got ${res.data.data.confirmedAt}`);
  });

  await test("A self-claimed duty is confirmed automatically", async () => {
    const res = await as(teachers.b.token, () =>
      api.post("/duties/self-assign", {
        exam: examId,
        room: "902",
        date: dutyDate,
        startTime: "14:00",
        endTime: "17:00",
      })
    );
    assertStatus(res, 201);
    selfId = res.data.data._id || res.data.data.id;
    assert(Boolean(res.data.data.confirmedAt), "self-claim should be confirmed");
    assert(res.data.data.confirmedVia === "self", `confirmedVia should be self, got ${res.data.data.confirmedVia}`);
  });

  await test("A teacher cannot confirm someone else's duty (403)", async () => {
    await expectStatus(403, () => as(teachers.b.token, () => api.post(`/duties/${assignedId}/confirm`)));
  });

  await test("The teacher confirms their own duty in the app", async () => {
    const res = await as(teachers.a.token, () => api.post(`/duties/${assignedId}/confirm`));
    assertStatus(res, 200);
    assert(res.data.data.confirmed === 1, `expected 1 confirmed, got ${res.data.data.confirmed}`);
    const duty = await api.get(`/duties/${assignedId}`);
    assert(Boolean(duty.data.data.confirmedAt), "confirmedAt should be set");
    assert(duty.data.data.confirmedVia === "app", `confirmedVia should be app, got ${duty.data.data.confirmedVia}`);
    const again = await as(teachers.a.token, () => api.post(`/duties/${assignedId}/confirm`));
    assert(again.data.data.alreadyConfirmed === true, "second confirm should report alreadyConfirmed");
  });

  await test("A bad email link gets a readable error page (400 HTML)", async () => {
    const res = await expectStatus(400, () => api.get("/duties/confirm/not-a-real-token"));
    assert(String(res.headers["content-type"]).includes("text/html"), "should render HTML");
    assert(String(res.data).includes("invalid or has expired"), "should explain the link is bad");
  });

  await test("A cancelled duty can't be confirmed (400)", async () => {
    const res = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teachers.a.id,
      role: "invigilator",
      room: "903",
      date: dutyDate,
      startTime: "18:00",
      endTime: "19:00",
    });
    const id = res.data.data._id || res.data.data.id;
    await api.patch(`/duties/${id}/cancel`, { reason: "test" });
    await expectStatus(400, () => as(teachers.a.token, () => api.post(`/duties/${id}/confirm`)));
  });

  await test("Responsiveness report is CS-only (403 for teachers)", async () => {
    await expectStatus(403, () => as(teachers.a.token, () => api.get("/reports/responsiveness")));
  });

  await test("Responsiveness report returns a summary and teacher rows", async () => {
    const res = await api.get("/reports/responsiveness");
    assertStatus(res, 200);
    const { summary: s, teachers: rows } = res.data.data;
    assert(typeof s.notResponding === "number" && typeof s.awaitingConfirmation === "number", "summary counts");
    assert(Array.isArray(rows), "teacher rows");
    // Designation "Other" teachers sit outside the workload cohort, so the test
    // teachers themselves aren't expected in the rows.
    for (const r of rows) {
      assert(r.upcoming === r.confirmed + r.awaiting, `${r.name}: upcoming should equal confirmed + awaiting`);
    }
  });

  return summary("CONFIRMATION");
}

module.exports = run;
if (require.main === module) run();
