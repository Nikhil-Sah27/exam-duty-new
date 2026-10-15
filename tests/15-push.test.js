const {
  api, setToken, test,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

/**
 * Mobile app backend (MOBILE_PLAN.md Phase 1):
 *
 *   - phones register / unregister Expo push tokens (validated, caller-scoped)
 *   - every teacher-facing notification also queues a push (outbox), which the
 *     dispatcher delivers to the registered device (console transport in CI)
 *   - CS awareness alerts are NOT pushed (CS has no app)
 *   - GET /duties/my-units lists the caller's live upcoming duty units with
 *     exact UTC start/end — the source of the phone's alarms
 */
async function run(token) {
  console.log("\n📱 PUSH + MY-UNITS TESTS\n");
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
  const dutyDate = futureDate(36);
  const password = "teacher123";
  const teacher = { email: `push_t_${stamp}@test.com`, name: "Push Teacher", phone: "9990000061" };
  const deviceToken = `ExponentPushToken[test-${stamp}]`;
  // Unique legacy room labels so re-running against the same DB never collides.
  const roomA = `P${String(stamp).slice(-6)}`;
  const roomB = `Q${String(stamp).slice(-6)}`;
  let examId = null;
  let dutyId = null;

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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Poll the teacher's push deliveries until `pred` matches (dispatcher is async). */
  const waitForDelivery = async (pred, timeoutMs = 8000) => {
    const until = Date.now() + timeoutMs;
    let rows = [];
    while (Date.now() < until) {
      const res = await as(teacher.token, () => api.get("/push/deliveries"));
      rows = res.data.data;
      const hit = rows.find(pred);
      if (hit) return hit;
      await sleep(500);
    }
    throw new Error(`no matching push delivery; saw: ${rows.map((r) => `${r.type}/${r.status}`).join(", ") || "none"}`);
  };

  await test("Setup: exam + one invigilator", async () => {
    const res = await api.post("/exams", {
      name: "Push Test Exam",
      date: dutyDate,
      department: "CSE",
      semester: 4,
      type: "internal",
    });
    examId = res.data.data._id || res.data.data.id;
    const u = await api.post("/users", {
      name: teacher.name,
      email: teacher.email,
      password,
      phone: teacher.phone,
      designation: "Other",
      role: "invigilator",
    });
    teacher.id = u.data.data._id || u.data.data.id;
    const login = await api.post("/auth/login", { email: teacher.email, password });
    teacher.token = login.data.data.token;
    assertExists(teacher.token, "teacher token");
  });

  await test("Device registration requires auth (401)", async () => {
    setToken(null);
    try {
      await expectStatus(401, () => api.post("/push/devices", { token: deviceToken, platform: "android" }));
    } finally {
      setToken(adminToken);
    }
  });

  await test("Rejects a non-Expo token and a bad platform (400)", async () => {
    await expectStatus(400, () =>
      as(teacher.token, () => api.post("/push/devices", { token: "not-a-token", platform: "android" }))
    );
    await expectStatus(400, () =>
      as(teacher.token, () => api.post("/push/devices", { token: deviceToken, platform: "windows" }))
    );
  });

  await test("A teacher registers their phone (idempotent)", async () => {
    const body = { token: deviceToken, platform: "android", appVersion: "1.0.0" };
    const res = await as(teacher.token, () => api.post("/push/devices", body));
    assertStatus(res, 200);
    assert(res.data.data.token === deviceToken, "echoes the token");
    const again = await as(teacher.token, () => api.post("/push/devices", body));
    assertStatus(again, 200);
  });

  await test("my-units is empty before any duty", async () => {
    const res = await as(teacher.token, () => api.get("/duties/my-units"));
    assertStatus(res, 200);
    assert(Array.isArray(res.data.data) && res.data.data.length === 0, `expected [], got ${res.data.data.length}`);
  });

  await test("A CS assignment pushes to the teacher's phone", async () => {
    const res = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teacher.id,
      role: "invigilator",
      room: roomA,
      date: dutyDate,
      startTime: "09:00",
      endTime: "12:00",
    });
    assertStatus(res, 201);
    dutyId = res.data.data._id || res.data.data.id;
    const row = await waitForDelivery((r) => r.type === "duty_assigned" && r.status === "sent");
    assert(row.deliveredTo === 1, `delivered to 1 device, got ${row.deliveredTo}`);
    assert(row.data && row.data.dutyId === String(dutyId), "payload carries the duty id");
    assert(row.data.sync === true && row.data.notificationId, "payload asks the app to re-sync and names the notification");
  });

  await test("my-units returns the duty as one unit with exact UTC times", async () => {
    const res = await as(teacher.token, () => api.get("/duties/my-units"));
    assertStatus(res, 200);
    const units = res.data.data;
    assert(units.length === 1, `expected 1 unit, got ${units.length}`);
    const u = units[0];
    assert(u.role === "invigilator", `role invigilator, got ${u.role}`);
    assert(u.primaryDutyId === String(dutyId), "primaryDutyId is the duty");
    assert(u.dutyIds.length === 1, "one duty in the unit");
    assert(u.date === dutyDate, `date ${dutyDate}, got ${u.date}`);
    assert(u.startTime === "09:00" && u.endTime === "12:00", "wall-clock times echoed");
    const start = new Date(u.startsAt);
    const end = new Date(u.endsAt);
    assert(!Number.isNaN(start.getTime()) && u.startsAt.endsWith("Z"), `startsAt is an ISO UTC instant: ${u.startsAt}`);
    assert(end - start === 3 * 3600 * 1000, `3h duty, got ${(end - start) / 60000} min`);
    assert(u.rooms.includes(roomA) && u.location.includes(roomA), `room ${roomA} in ${u.location}`);
    assert(u.confirmed === false && u.confirmedAt === null, "CS-assigned starts unconfirmed");
  });

  await test("Confirming in the app shows up in my-units", async () => {
    await as(teacher.token, () => api.post(`/duties/${dutyId}/confirm`));
    const res = await as(teacher.token, () => api.get("/duties/my-units"));
    assert(res.data.data[0].confirmed === true && res.data.data[0].confirmedAt, "unit confirmed");
  });

  await test("A cancelled duty leaves my-units and pushes the cancellation", async () => {
    await api.patch(`/duties/${dutyId}/cancel`, { reason: "push test" });
    const res = await as(teacher.token, () => api.get("/duties/my-units"));
    assert(res.data.data.length === 0, `expected no units, got ${res.data.data.length}`);
    await waitForDelivery((r) => r.type === "duty_cancelled" && r.status === "sent");
  });

  await test("CS awareness alerts are not pushed (CS has no app)", async () => {
    // A teacher self-claim notifies CS with duty_claimed_by_teacher.
    const res = await as(teacher.token, () =>
      api.post("/duties/self-assign", {
        exam: examId,
        room: roomB,
        date: dutyDate,
        startTime: "14:00",
        endTime: "17:00",
      })
    );
    assertStatus(res, 201);
    await waitForDelivery((r) => r.type === "duty_self_claimed");
    const cs = await api.get("/push/deliveries");
    assert(
      !cs.data.data.some((r) => r.type === "duty_claimed_by_teacher"),
      "duty_claimed_by_teacher must not be queued as a push"
    );
  });

  await test("Logout unregisters the phone (scoped to the caller)", async () => {
    // CS can't remove the teacher's device.
    const other = await api.delete("/push/devices", { data: { token: deviceToken } });
    assert(other.data.data.removed === 0, "another user's device is untouched");
    const res = await as(teacher.token, () => api.delete("/push/devices", { data: { token: deviceToken } }));
    assertStatus(res, 200);
    assert(res.data.data.removed === 1, `removed 1, got ${res.data.data.removed}`);
  });

  return summary("PUSH");
}

module.exports = run;
if (require.main === module) run();
