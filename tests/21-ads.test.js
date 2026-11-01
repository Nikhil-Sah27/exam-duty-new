const {
  api, setToken, test,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");
const { computeAdLevel } = require("../backend/modules/ads/adLevel.utils");
const { shortfallByTeacher, isBehind, openRolesForGroup } = require("../backend/modules/duty-calculation/selectionShortfall.utils");

/**
 * Ads and no-shows (ADS_PLAN.md):
 *
 *   - the pure rules: ad levels by days behind / recent no-show, and who counts as behind
 *   - the master switch is superadmin-only; teachers can't read or flip it
 *   - ads show only when the master switch AND the college's switch are on; CS never sees them
 *   - only CS marks a no-show, only after the duty ended; the teacher is told; undo works
 *   - a recorded no-show lifts the teacher to the top level while ads are on
 *
 * Leaves both switches as it found them.
 */
async function run(token) {
  console.log("\n📣 ADS + NO-SHOW TESTS\n");
  resetCounters();

  if (!token) {
    const res = await api.post("/auth/login", { email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD });
    token = res.data.data.token;
  }
  const adminToken = token;
  setToken(adminToken);

  const stamp = Date.now();
  const password = "teacher123";
  const teacher = { email: `ads_t_${stamp}@test.com`, name: "Ads Teacher", phone: "9990000071" };
  let superToken = null;
  let collegeId = null;
  let original = null; // { master, college } to restore
  let pastDutyId = null;
  let futureDutyId = null;

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

  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const status = (authToken) => as(authToken, async () => (await api.get("/ads/status")).data.data);
  const setMaster = (adsEnabled) => as(superToken, () => api.patch("/platform/ads", { adsEnabled }));
  const setCollegeAds = (ads) => as(superToken, () => api.patch(`/platform/colleges/${collegeId}`, { features: { ads } }));

  // ── Pure rules ────────────────────────────────────────────────────────────

  await test("Ad level: off, base, then by days behind", async () => {
    const now = new Date("2026-11-10T10:00:00Z");
    const hoursAgo = (h) => new Date(now.getTime() - h * 3600e3);
    const level = (args) => computeAdLevel({ now, ...args }).level;
    assert(level({ enabled: false }) === 0, "switched off → 0");
    assert(level({ enabled: true }) === 1, "on, not behind → 1");
    assert(level({ enabled: true, behind: { since: hoursAgo(2), remaining: 1 } }) === 2, "behind today → 2");
    assert(level({ enabled: true, behind: { since: hoursAgo(30), remaining: 1 } }) === 3, "behind day 2 → 3");
    assert(level({ enabled: true, behind: { since: hoursAgo(80), remaining: 1 } }) === 4, "behind day 4 → 4");
  });

  await test("Ad level: a no-show lifts to the top for 14 days", async () => {
    const now = new Date("2026-11-10T10:00:00Z");
    const daysAgo = (d) => new Date(now.getTime() - d * 86400e3);
    const recent = computeAdLevel({ enabled: true, noShow: { date: daysAgo(4), markedAt: daysAgo(3) }, now });
    assert(recent.level === 4, `recent no-show → 4, got ${recent.level}`);
    assert(recent.reasons.some((r) => r.code === "no_show"), "no_show reason listed");
    const old = computeAdLevel({ enabled: true, noShow: { date: daysAgo(16), markedAt: daysAgo(15) }, now });
    assert(old.level === 1, `no-show 15 days ago → 1, got ${old.level}`);
  });

  await test("Behind = short in a role an exam still has open slots for", async () => {
    const short = shortfallByTeacher([
      { teacherId: "a", role: "invigilator", eligible: true, target: 4, assigned: 3 },
      { teacherId: "b", role: "invigilator", eligible: true, target: 4, assigned: 4 },
      { teacherId: "c", role: "rs", eligible: true, target: 2, assigned: 0 },
      { teacherId: "d", role: "invigilator", eligible: false, target: 0, assigned: 0 },
    ]);
    const open = new Map([
      ["g", { roles: openRolesForGroup({ roomIds: ["r1"], filled: { invigilator: new Set(), rs: new Set(["r1"]) }, dcsOpen: false }) }],
    ]);
    assert(isBehind(short.get("a"), open), "a: short, invigilator slots open");
    assert(!short.has("b"), "b: at target");
    assert(!isBehind(short.get("c"), open), "c: short on RS, but every RS slot is taken");
    assert(!short.has("d"), "d: not eligible");
  });

  // ── Setup ────────────────────────────────────────────────────────────────

  await test("Setup: superadmin, college, teacher, a past and a future duty", async () => {
    const sa = await api.post("/auth/login", { email: CONFIG.SUPERADMIN_EMAIL, password: CONFIG.SUPERADMIN_PASSWORD });
    superToken = sa.data.data.token;
    const me = await api.get("/auth/me");
    collegeId = me.data.data.college.id;
    assertExists(collegeId, "CS college id");

    const settings = await as(superToken, () => api.get("/platform/ads"));
    original = { master: settings.data.data.adsEnabled, college: me.data.data.college.features.ads };

    const exam = await api.post("/exams", { name: "Ads Test Exam", date: futureDate(30), department: "CSE", semester: 4, type: "internal" });
    const examId = exam.data.data._id || exam.data.data.id;
    const u = await api.post("/users", {
      name: teacher.name, email: teacher.email, password, phone: teacher.phone, designation: "Other", role: "invigilator",
    });
    teacher.id = u.data.data._id || u.data.data.id;
    teacher.token = (await api.post("/auth/login", { email: teacher.email, password })).data.data.token;

    // Rooms unique per run, so the suite can run again on the same database.
    const room = `ADS-${stamp % 100000}`;
    const past = await api.post("/duties/admin-assign", {
      exam: examId, teacher: teacher.id, role: "invigilator", room: `${room}-A`, date: yesterday(), startTime: "09:00", endTime: "10:00",
    });
    assertStatus(past, 201);
    pastDutyId = past.data.data._id || past.data.data.id;
    const future = await api.post("/duties/admin-assign", {
      exam: examId, teacher: teacher.id, role: "invigilator", room: `${room}-B`, date: futureDate(30), startTime: "09:00", endTime: "12:00",
    });
    futureDutyId = future.data.data._id || future.data.data.id;
    assertExists(teacher.token, "teacher token");
  });

  // ── Switches ─────────────────────────────────────────────────────────────

  await test("Only the superadmin reads or flips the master switch (403)", async () => {
    await expectStatus(403, () => as(teacher.token, () => api.get("/platform/ads")));
    await expectStatus(403, () => api.patch("/platform/ads", { adsEnabled: true }));
    await expectStatus(400, () => setMaster("yes"));
  });

  await test("The superadmin console has no ad level of its own (403)", async () => {
    await expectStatus(403, () => as(superToken, () => api.get("/ads/status")));
  });

  await test("Either switch off → level 0", async () => {
    await setMaster(false);
    await setCollegeAds(true);
    assert((await status(teacher.token)).level === 0, "master off → 0");
    await setMaster(true);
    await setCollegeAds(false);
    assert((await status(teacher.token)).level === 0, "college off → 0");
  });

  await test("Both on → the teacher sees ads; CS never does", async () => {
    await setMaster(true);
    await setCollegeAds(true);
    const s = await status(teacher.token);
    assert(s.level >= 1, `teacher level ≥ 1, got ${s.level}`);
    assert(Array.isArray(s.reasons), "reasons listed");
    assert((await status(adminToken)).level === 0, "CS → 0");
  });

  // ── No-shows ─────────────────────────────────────────────────────────────

  await test("A teacher can't mark absences (403)", async () => {
    await expectStatus(403, () => as(teacher.token, () => api.patch("/duties/admin-mark-absent", { dutyId: pastDutyId, absent: true })));
  });

  await test("A duty that hasn't ended can't be marked absent (400)", async () => {
    await expectStatus(400, () => api.patch("/duties/admin-mark-absent", { dutyId: futureDutyId, absent: true }));
  });

  await test("CS marks a past duty absent; the teacher is told", async () => {
    const res = await api.patch("/duties/admin-mark-absent", { dutyId: pastDutyId, absent: true });
    assertStatus(res, 200);
    assert(res.data.data.changed === 1, `expected 1 changed, got ${res.data.data.changed}`);
    const duty = await api.get(`/duties/${pastDutyId}`);
    assert(Boolean(duty.data.data.absentAt), "absentAt should be set");
    const feed = await as(teacher.token, async () => (await api.get("/notifications")).data.data);
    assert(feed.some((n) => n.type === "duty_marked_absent"), "teacher should get duty_marked_absent");
    const again = await api.patch("/duties/admin-mark-absent", { dutyId: pastDutyId, absent: true });
    assert(again.data.data.changed === 0, "marking twice changes nothing");
  });

  await test("A recorded no-show lifts the teacher to level 4", async () => {
    const s = await status(teacher.token);
    assert(s.level === 4, `expected level 4, got ${s.level}`);
    assert(s.reasons.some((r) => r.code === "no_show"), "no_show reason listed");
  });

  await test("Undo clears the absence and the extra ads", async () => {
    const res = await api.patch("/duties/admin-mark-absent", { dutyId: pastDutyId, absent: false });
    assert(res.data.data.changed === 1, `expected 1 changed, got ${res.data.data.changed}`);
    const duty = await api.get(`/duties/${pastDutyId}`);
    assert(duty.data.data.absentAt === null, "absentAt should be cleared");
    const s = await status(teacher.token);
    assert(!s.reasons.some((r) => r.code === "no_show"), "no_show reason gone");
  });

  await test("Cleanup: switches back as they were", async () => {
    await setMaster(Boolean(original && original.master));
    await setCollegeAds(Boolean(original && original.college));
    const settings = await as(superToken, () => api.get("/platform/ads"));
    assert(settings.data.data.adsEnabled === Boolean(original && original.master), "master restored");
  });

  return summary("ADS + NO-SHOWS");
}

module.exports = run;
if (require.main === module) run();
