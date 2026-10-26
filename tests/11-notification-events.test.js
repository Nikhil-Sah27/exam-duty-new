const {
  api, eventually, setToken, test,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

/**
 * Covers the notification events added alongside email delivery — the ones that
 * previously fired for nobody:
 *
 *   - a teacher self-claiming a duty now gets a `duty_self_claimed` confirmation
 *     (the self-assign path used to notify no one at all)
 *   - CS is NOT alerted on every self-claim (removed in d0be45b; CS sees holders in Manage Duties)
 *   - CS now learns when the teacher gives the duty back
 *     (`duty_released_by_teacher`)
 *
 * Email itself is asserted out-of-band: the transport defaults to `console`, so
 * a test run never sends. Use `node backend/scripts/mail-outbox-report.js` to
 * inspect the queued mail these events produce.
 */
async function run(token) {
  console.log("\n📨 NOTIFICATION EVENT TESTS\n");
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

  let examId = null;
  let teacherId = null;
  let teacherToken = null;
  let selfDutyId = null;
  const dutyDate = futureDate(25);
  const teacherEmail = `notif_teacher_${Date.now()}@test.com`;
  const teacherPassword = "teacher123";

  /** The caller's own feed, newest first. */
  const myNotifications = async (authToken) => {
    setToken(authToken);
    const res = await api.get("/notifications");
    assertStatus(res, 200);
    return res.data.data;
  };

  const hasType = (list, type) => list.some((n) => n.type === type);

  await test("Setup: create exam", async () => {
    const res = await api.post("/exams", {
      name: "Notification Event Exam",
      date: dutyDate,
      department: "CSE",
      semester: 4,
      type: "internal",
    });
    examId = res.data.data._id || res.data.data.id;
    assertExists(examId, "exam id");
  });

  // Designation "Other" pins exactly one role, so login skips role selection.
  await test("Setup: create single-role invigilator", async () => {
    const res = await api.post("/users", {
      name: "Notif Test Teacher",
      email: teacherEmail,
      password: teacherPassword,
      phone: "9990000031",
      designation: "Other",
      role: "invigilator",
    });
    teacherId = res.data.data._id || res.data.data.id;
    assertExists(teacherId, "teacher id");
  });

  await test("Setup: teacher logs in", async () => {
    const res = await api.post("/auth/login", {
      email: teacherEmail,
      password: teacherPassword,
    });
    teacherToken = res.data.data.token;
    assertExists(teacherToken, "teacher token");
  });

  await test("POST /duties/self-assign - teacher claims a duty", async () => {
    if (!examId || !teacherToken) throw new Error("Missing exam or teacher token");
    setToken(teacherToken);
    try {
      const res = await api.post("/duties/self-assign", {
        exam: examId,
        room: "701",
        date: dutyDate,
        startTime: "09:00",
        endTime: "12:00",
      });
      assertStatus(res, 201);
      selfDutyId = res.data.data._id || res.data.data.id;
      assertExists(selfDutyId, "duty id");
    } finally {
      setToken(adminToken);
    }
  });

  await test("Self-claim notifies the teacher (duty_self_claimed)", async () => {
    if (!teacherToken) throw new Error("No teacher token");
    const feed = await myNotifications(teacherToken);
    setToken(adminToken);
    assert(
      hasType(feed, "duty_self_claimed"),
      `expected a duty_self_claimed notification, got: [${feed.map((n) => n.type).join(", ")}]`
    );
  });

  await test("Self-claim does not alert CS", async () => {
    const feed = await myNotifications(adminToken);
    assert(
      !feed.some((n) => n.type === "duty_claimed_by_teacher"),
      `CS should not be alerted on a self-claim, got: [${feed.map((n) => n.type).join(", ")}]`
    );
  });

  await test("Teacher releasing their duty notifies CS (duty_released_by_teacher)", async () => {
    if (!selfDutyId || !teacherToken) throw new Error("No duty to release");
    setToken(teacherToken);
    try {
      const res = await api.patch(`/duties/${selfDutyId}/cancel`, {
        reason: "Testing self-release",
      });
      assertStatus(res, 200);
    } finally {
      setToken(adminToken);
    }

    // The CS alert is fire-and-forget (written just after the response).
    const feed = await eventually(
      () => myNotifications(adminToken),
      (list) => hasType(list, "duty_released_by_teacher")
    );
    const match = feed.find((n) => n.type === "duty_released_by_teacher");
    assert(
      Boolean(match),
      `expected a duty_released_by_teacher notification, got: [${feed.map((n) => n.type).join(", ")}]`
    );
    assert(
      match.message.includes("vacant"),
      `release alert should flag the room as vacant, got: "${match.message}"`
    );
  });

  await test("CS cancelling a duty does NOT raise a self-release alert", async () => {
    if (!examId || !teacherId) throw new Error("Missing exam or teacher");
    // Baseline, then assign + cancel as CS and confirm the count is unchanged.
    const before = (await myNotifications(adminToken)).filter(
      (n) => n.type === "duty_released_by_teacher"
    ).length;

    setToken(adminToken);
    const assigned = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teacherId,
      role: "invigilator",
      room: "702",
      date: dutyDate,
      startTime: "14:00",
      endTime: "17:00",
    });
    const dutyId = assigned.data.data._id || assigned.data.data.id;
    await api.patch(`/duties/${dutyId}/cancel`, { reason: "CS cancelled" });

    const after = (await myNotifications(adminToken)).filter(
      (n) => n.type === "duty_released_by_teacher"
    ).length;
    setToken(adminToken);
    assert(
      after === before,
      `CS cancellation should not emit duty_released_by_teacher (before ${before}, after ${after})`
    );
  });

  await test("Teacher still receives duty_cancelled on their own release", async () => {
    if (!teacherToken) throw new Error("No teacher token");
    const feed = await myNotifications(teacherToken);
    setToken(adminToken);
    assert(
      hasType(feed, "duty_cancelled"),
      `expected a duty_cancelled notification, got: [${feed.map((n) => n.type).join(", ")}]`
    );
  });

  // ── CS message → teacher alert (and phone push) that the chat clears ──────
  await test("A CS message notifies the teacher; opening the chat marks it read", async () => {
    const users = (await api.get("/users", { params: { limit: 500 } })).data.data;
    const teacher = users.find((u) => u.email === "rs@examduty.com");
    assert(teacher, "seeded RS teacher");
    const login = await api.post("/auth/login", { email: "rs@examduty.com", password: "Rs123456" });
    const teacherToken = login.data.data.token;

    setToken(token);
    const conv = (await api.post("/messages/conversations/start", { teacherId: teacher._id })).data.data;
    const body = `Please report 15 minutes early to Block A (${Date.now()}).`;
    assertStatus(await api.post(`/messages/conversations/${conv._id}`, { body }), 201);

    setToken(teacherToken);
    try {
      const find = async () =>
        (await api.get("/notifications", { params: { limit: 50 } })).data.data.find(
          (n) => n.type === "cs_message" && n.message.includes(body),
        );
      const note = await eventually(find, (n) => !!n);
      assert(note, "teacher got a cs_message notification");
      assert(note.title === "New message from the exam cell", `title: ${note.title}`);
      assert(!note.isRead, "starts unread");

      await api.get("/messages/thread");
      const after = await find();
      assert(after && after.isRead, "opening the chat marks it read");
    } finally {
      setToken(token);
    }
  });

  // ── Teacher message → CS alert (and phone push) that opening the chat clears ─
  await test("A teacher's message notifies CS with the conversation; opening it marks it read", async () => {
    const login = await api.post("/auth/login", { email: "rs@examduty.com", password: "Rs123456" });
    const teacherToken = login.data.data.token;
    const body = `Can I swap my Friday duty? (${Date.now()})`;

    setToken(teacherToken);
    try {
      assertStatus(await api.post("/messages/thread", { body }), 201);
    } finally {
      setToken(token);
    }

    const find = async () =>
      (await api.get("/notifications", { params: { limit: 50 } })).data.data.find(
        (n) => n.type === "teacher_message" && n.message.includes(body),
      );
    const note = await eventually(find, (n) => !!n);
    assert(note, "CS got a teacher_message notification");
    assert(/^Message from /.test(note.title), `title names the teacher: ${note.title}`);
    assert(note.refModel === "Conversation" && note.refId, "points at the conversation");
    assert(!note.isRead, "starts unread");

    await api.get(`/messages/conversations/${note.refId}`);
    const after = await find();
    assert(after && after.isRead, "opening the conversation marks it read");
  });

  const result = summary("NOTIFICATION EVENTS");
  return result;
}

module.exports = run;
if (require.main === module) run();
