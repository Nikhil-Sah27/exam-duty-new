const {
  api, setToken, test,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

/**
 * CS unassign (UNASSIGN_PLAN.md):
 *
 *   - CS can take a teacher off an invigilator duty; the teacher is told (with
 *     the reason) and CS gets no "teacher released" alert about its own action
 *   - the vacated slot can be assigned again
 *   - RS / DCS leave as a whole group via /duties/admin-unassign-group — a
 *     single-duty cancel of a group role is refused
 *   - the permission holes this closed stay closed: a teacher can't cancel
 *     someone else's duty, and can't reach the admin assign/unassign endpoints
 */
async function run(token) {
  console.log("\n🧹 UNASSIGN TESTS\n");
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
  const dutyDate = futureDate(30);
  const password = "teacher123";
  let examId = null;
  const teachers = {
    a: { email: `unassign_a_${stamp}@test.com`, name: "Unassign Teacher A", role: "invigilator", phone: "9990000041" },
    b: { email: `unassign_b_${stamp}@test.com`, name: "Unassign Teacher B", role: "invigilator", phone: "9990000042" },
    rs: { email: `unassign_rs_${stamp}@test.com`, name: "Unassign RS", role: "rs", phone: "9990000043" },
  };
  let invDutyId = null;
  let rsDutyId = null;

  /** Call as someone else, always restoring the admin token. */
  const as = async (authToken, fn) => {
    setToken(authToken);
    try {
      return await fn();
    } finally {
      setToken(adminToken);
    }
  };

  /** Assert a request fails with exactly this status. */
  const expectStatus = async (status, fn) => {
    try {
      await fn();
    } catch (err) {
      assert(
        err.response && err.response.status === status,
        `expected ${status}, got ${err.response ? err.response.status : err.message}`
      );
      return;
    }
    throw new Error(`expected ${status}, request succeeded`);
  };

  const feed = (authToken) =>
    as(authToken, async () => {
      const res = await api.get("/notifications");
      assertStatus(res, 200);
      return res.data.data;
    });

  await test("Setup: create exam", async () => {
    const res = await api.post("/exams", {
      name: "Unassign Test Exam",
      date: dutyDate,
      department: "CSE",
      semester: 4,
      type: "internal",
    });
    examId = res.data.data._id || res.data.data.id;
    assertExists(examId, "exam id");
  });

  // Designation "Other" pins exactly one role, so login skips role selection.
  await test("Setup: create teachers and log them in", async () => {
    for (const t of Object.values(teachers)) {
      const res = await api.post("/users", {
        name: t.name,
        email: t.email,
        password,
        phone: t.phone,
        designation: "Other",
        role: t.role,
      });
      t.id = res.data.data._id || res.data.data.id;
      const login = await api.post("/auth/login", { email: t.email, password });
      t.token = login.data.data.token;
      assertExists(t.token, `${t.name} token`);
    }
  });

  await test("Setup: CS assigns teacher A an invigilator duty", async () => {
    const res = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teachers.a.id,
      role: "invigilator",
      room: "801",
      date: dutyDate,
      startTime: "09:00",
      endTime: "12:00",
    });
    assertStatus(res, 201);
    invDutyId = res.data.data._id || res.data.data.id;
  });

  await test("A teacher cannot cancel someone else's duty (403)", async () => {
    await expectStatus(403, () =>
      as(teachers.b.token, () => api.patch(`/duties/${invDutyId}/cancel`, { reason: "not mine" }))
    );
  });

  await test("A teacher cannot use the CS assign endpoints (403)", async () => {
    await expectStatus(403, () =>
      as(teachers.b.token, () =>
        api.post("/duties/admin-assign", {
          exam: examId,
          teacher: teachers.b.id,
          role: "invigilator",
          room: "802",
          date: dutyDate,
          startTime: "09:00",
          endTime: "12:00",
        })
      )
    );
    await expectStatus(403, () =>
      as(teachers.b.token, () => api.post("/duties/admin-unassign-group", { dutyId: invDutyId }))
    );
  });

  await test("CS unassigns teacher A; A is told why, CS gets no release alert", async () => {
    const releasesBefore = (await feed(adminToken)).filter(
      (n) => n.type === "duty_released_by_teacher"
    ).length;

    const res = await api.patch(`/duties/${invDutyId}/cancel`, { reason: "Covering another exam" });
    assertStatus(res, 200);
    assert(res.data.data.status === "cancelled", `status should be cancelled, got ${res.data.data.status}`);

    const aFeed = await feed(teachers.a.token);
    const cancelled = aFeed.find((n) => n.type === "duty_cancelled");
    assert(Boolean(cancelled), `teacher A should get duty_cancelled, got [${aFeed.map((n) => n.type).join(", ")}]`);
    assert(
      cancelled.message.includes("Covering another exam"),
      `the reason should reach the teacher, got "${cancelled.message}"`
    );

    const releasesAfter = (await feed(adminToken)).filter(
      (n) => n.type === "duty_released_by_teacher"
    ).length;
    assert(releasesAfter === releasesBefore, "CS unassign must not alert CS about itself");
  });

  await test("The vacated slot can be assigned again", async () => {
    const res = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teachers.b.id,
      role: "invigilator",
      room: "801",
      date: dutyDate,
      startTime: "09:00",
      endTime: "12:00",
    });
    assertStatus(res, 201);
  });

  await test("Setup: CS assigns an RS duty", async () => {
    const res = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teachers.rs.id,
      role: "rs",
      room: "811",
      date: dutyDate,
      startTime: "14:00",
      endTime: "17:00",
    });
    assertStatus(res, 201);
    rsDutyId = res.data.data._id || res.data.data.id;
  });

  await test("CS cannot cancel a single room of an RS group (400)", async () => {
    await expectStatus(400, () => api.patch(`/duties/${rsDutyId}/cancel`, {}));
  });

  await test("CS unassigns the RS group; one duty_group_cancelled", async () => {
    const res = await api.post("/duties/admin-unassign-group", {
      dutyId: rsDutyId,
      reason: "Rebalancing RS load",
    });
    assertStatus(res, 200);
    assert(res.data.count === 1, `expected 1 duty cancelled, got ${res.data.count}`);

    const rsFeed = (await feed(teachers.rs.token)).filter((n) => n.type === "duty_group_cancelled");
    assert(rsFeed.length === 1, `expected exactly one duty_group_cancelled, got ${rsFeed.length}`);
    assert(rsFeed[0].message.includes("Rebalancing RS load"), `reason missing: "${rsFeed[0].message}"`);
  });

  await test("Unassigning an already-cancelled group is refused (400)", async () => {
    await expectStatus(400, () => api.post("/duties/admin-unassign-group", { dutyId: rsDutyId }));
  });

  return summary("UNASSIGN");
}

module.exports = run;
if (require.main === module) run();
