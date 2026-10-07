const {
  api, setToken, test,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

/**
 * Concurrent claims (REALTIME_PLAN.md §2): when several teachers pick the same
 * duty at the same moment, exactly one gets it.
 *
 *   - 5 invigilators claim one room at once → one 201, four 409s, one live duty
 *   - 3 RS claim one room group at once → one RS holds every room, the others
 *     hold none (no partial groups)
 *   - a slot released by its winner can be claimed again
 *
 * Requests are fired together with Promise.allSettled so their check-then-insert
 * steps interleave on the server — the race the Duty one_live_duty_per_slot
 * index exists to settle.
 */
async function run(token) {
  console.log("\n🏁 CONCURRENCY TESTS\n");
  resetCounters();

  if (!token) {
    const res = await api.post("/auth/login", {
      email: CONFIG.ADMIN_EMAIL,
      password: CONFIG.ADMIN_PASSWORD,
    });
    token = res.data.data.token;
  }
  setToken(token);

  const stamp = Date.now();
  const dutyDate = futureDate(21);
  const password = "teacher123";
  const invigilators = [];
  const rsTeachers = [];
  const examRoomIds = [];
  let groupId = null;
  let scheduleId = null;
  let winnerInvigilator = null;
  let losingInvigilators = [];
  let invDutyId = null;

  // Each request carries its own teacher's token so they can run concurrently.
  const asTeacher = (teacher) => ({ headers: { Authorization: `Bearer ${teacher.token}` } });

  const outcomes = (settled) => ({
    won: settled.filter((r) => r.status === "fulfilled" && r.value.status === 201),
    lost: settled.filter((r) => r.status === "rejected" && r.reason.response?.status === 409),
    other: settled.filter(
      (r) =>
        !(r.status === "fulfilled" && r.value.status === 201) &&
        !(r.status === "rejected" && r.reason.response?.status === 409)
    ),
  });

  const describe = (settled) =>
    settled
      .map((r) =>
        r.status === "fulfilled"
          ? r.value.status
          : `${r.reason.response?.status ?? "ERR"} ${r.reason.response?.data?.message ?? r.reason.message}`
      )
      .join(" | ");

  /** Live duties of `role` on the test schedule, keyed by examRoom id. */
  const liveDuties = async (role) => {
    const res = await api.get(`/duties?status=assigned&role=${role}&date=${dutyDate}`);
    assertStatus(res, 200);
    return res.data.data.filter((d) => examRoomIds.includes(String(d.examRoom?._id || d.examRoom)));
  };

  await test("Setup: building, 3 rooms, exam group, schedule, exam rooms", async () => {
    const bRes = await api.post("/infrastructure/buildings", { name: `Race-Bldg-${stamp % 100000}` });
    const buildingId = bRes.data.data._id || bRes.data.data.id;

    const groupRes = await api.post("/exam-groups", {
      examType: "IA2",
      semester: 5,
      startDate: dutyDate,
      endDate: futureDate(25),
    });
    assertStatus(groupRes, 201);
    groupId = groupRes.data.data._id || groupRes.data.data.id;

    const sRes = await api.post("/exam-groups/schedules", {
      examGroup: groupId,
      date: dutyDate,
      startTime: "09:00",
      endTime: "12:00",
    });
    assertStatus(sRes, 201);
    scheduleId = sRes.data.data._id || sRes.data.data.id;

    for (let i = 1; i <= 3; i++) {
      const rRes = await api.post("/infrastructure/rooms", {
        roomNumber: `RC-${stamp % 100000}-${i}`,
        building: buildingId,
        floor: 1,
        capacity: 40,
      });
      const roomId = rRes.data.data._id || rRes.data.data.id;
      const erRes = await api.post("/exam-groups/rooms", {
        schedule: scheduleId,
        room: roomId,
        departments: ["CSE"],
      });
      assertStatus(erRes, 201);
      examRoomIds.push(String(erRes.data.data._id || erRes.data.data.id));
    }
    assert(examRoomIds.length === 3, "three exam rooms");
  });

  // Designation "Other" pins exactly one role, so login skips role selection.
  await test("Setup: 5 invigilators and 3 RS teachers, logged in", async () => {
    const make = async (role, i, list) => {
      const email = `race_${role}_${i}_${stamp}@test.com`;
      await api.post("/users", {
        name: `Race ${role.toUpperCase()} ${i}`,
        email,
        password,
        phone: `9${String(stamp + list.length + (role === "rs" ? 50 : 0)).slice(-9)}`,
        designation: "Other",
        role,
      });
      const login = await api.post("/auth/login", { email, password });
      const t = { email, token: login.data.data.token };
      assertExists(t.token, `${email} token`);
      list.push(t);
    };
    for (let i = 1; i <= 5; i++) await make("invigilator", i, invigilators);
    for (let i = 1; i <= 3; i++) await make("rs", i, rsTeachers);
  });

  await test("5 invigilators claim the same room at once → exactly one gets it", async () => {
    const settled = await Promise.allSettled(
      invigilators.map((t) =>
        api.post("/duties/self-assign", { examSchedule: scheduleId, examRoom: examRoomIds[0] }, asTeacher(t))
      )
    );
    const { won, lost, other } = outcomes(settled);
    assert(won.length === 1, `expected 1 winner, got ${won.length}: ${describe(settled)}`);
    assert(lost.length === 4, `expected 4 × 409, got ${lost.length}: ${describe(settled)}`);
    assert(other.length === 0, `unexpected responses: ${describe(settled)}`);

    winnerInvigilator = invigilators[settled.findIndex((r) => r.status === "fulfilled")];
    losingInvigilators = invigilators.filter((_, i) => settled[i].status === "rejected");
    invDutyId = won[0].value.data.data._id || won[0].value.data.data.id;

    const live = (await liveDuties("invigilator")).filter(
      (d) => String(d.examRoom?._id || d.examRoom) === examRoomIds[0]
    );
    assert(live.length === 1, `room should hold 1 live invigilator duty, holds ${live.length}`);
  });

  await test("The losers get a 'taken' message, not a server error", async () => {
    const t = losingInvigilators[0];
    if (!t) throw new Error("no losing invigilator to retry with");
    try {
      await api.post("/duties/self-assign", { examSchedule: scheduleId, examRoom: examRoomIds[0] }, asTeacher(t));
      throw new Error("claim on a taken room succeeded");
    } catch (err) {
      assert(err.response?.status === 409, `expected 409, got ${err.response?.status ?? err.message}`);
      assert(/taken|already assigned/i.test(err.response.data.message), `message: ${err.response.data.message}`);
    }
  });

  await test("3 RS claim the same group at once → one RS holds every room", async () => {
    const settled = await Promise.allSettled(
      rsTeachers.map((t) =>
        api.post("/duties/self-assign-group", { examSchedule: scheduleId, examRooms: examRoomIds }, asTeacher(t))
      )
    );
    const { won, lost, other } = outcomes(settled);
    assert(won.length === 1, `expected 1 winner, got ${won.length}: ${describe(settled)}`);
    assert(lost.length === 2, `expected 2 × 409, got ${lost.length}: ${describe(settled)}`);
    assert(other.length === 0, `unexpected responses: ${describe(settled)}`);

    const live = await liveDuties("rs");
    assert(live.length === 3, `group should hold exactly 3 live RS duties, holds ${live.length}`);
    const holders = new Set(live.map((d) => String(d.teacher?._id || d.teacher)));
    assert(holders.size === 1, `all rooms should belong to one RS, found ${holders.size} holders`);
  });

  await test("A released slot can be claimed again", async () => {
    if (!winnerInvigilator) throw new Error("no winning invigilator to release");
    const cancel = await api.patch(`/duties/${invDutyId}/cancel`, { reason: "freeing the slot" }, asTeacher(winnerInvigilator));
    assertStatus(cancel, 200);

    const next = losingInvigilators[0];
    const res = await api.post("/duties/self-assign", { examSchedule: scheduleId, examRoom: examRoomIds[0] }, asTeacher(next));
    assertStatus(res, 201);
  });

  // Exam groups refuse overlapping dates for the same type + semester, so leave
  // none behind — the suite must be re-runnable against the same database.
  await test("Cleanup: delete the test exam group", async () => {
    if (!groupId) throw new Error("No group");
    const res = await api.delete(`/exam-groups/${groupId}`);
    assertStatus(res, 200);
  });

  return summary("Concurrency");
}

module.exports = run;
if (require.main === module) run();
