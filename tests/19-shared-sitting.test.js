// SEE departments of one semester writing at the same date + time share ONE
// schedule, so RS and DCS cover them together — 6 departments × 60 students in
// 12 rooms of one building need 3 RS (chunks of 5) and 2 DCS (ceil(360/300)),
// whether the exams are created in one batch or one department at a time.
// Each department keeps its own exam card with only its own rooms.

const {
  api, setToken, test, assert, assertEqual, assertStatus, summary, resetCounters,
  futureDate, CONFIG,
} = require("./helpers");

const DEPT_COUNT = 6;
const ROOMS_PER_DEPT = 2;
// An odd window keeps this suite's sittings apart from anything else in the DB.
const START = "07:10";
const END = "09:40";

async function run(token) {
  console.log("\n🪑 SHARED SEE SITTING TESTS\n");
  resetCounters();

  if (!token) {
    const res = await api.post("/auth/login", {
      email: CONFIG.ADMIN_EMAIL,
      password: CONFIG.ADMIN_PASSWORD,
    });
    token = res.data.data.token;
  }
  setToken(token);

  const tag = Date.now() % 100000;
  // Same-semester SEE at the same date + time share a slot by design, so each
  // run picks its own days rather than joining an earlier run's leftovers.
  const day = (n) => futureDate(100 + (tag % 150) * 7 + n);
  const depts = []; // { id, code, courseId, rooms: [roomId, roomId] }
  const createdGroups = [];

  await test("Setup: 6 departments (Sem 3, 60 students) + 12 rooms in one building", async () => {
    const b = await api.post("/infrastructure/buildings", { name: `Shared Block ${tag}` });
    assertStatus(b, 201);
    const buildingId = b.data.data._id;
    const r = await api.post("/infrastructure/rooms/bulk", {
      building: buildingId,
      rooms: Array.from({ length: DEPT_COUNT * ROOMS_PER_DEPT }, (_, i) => ({
        roomNumber: String(101 + i),
        floor: 1,
        capacity: 30,
      })),
    });
    assertStatus(r, 201);
    const roomIds = (r.data.data.created || r.data.data).map((x) => x._id);
    assertEqual(roomIds.length, 12, "rooms created");

    for (let i = 0; i < DEPT_COUNT; i++) {
      const code = `SH${tag}${i}`;
      const d = await api.post("/departments", { name: `Shared Dept ${code}`, code });
      const deptId = d.data.data._id;
      const s = await api.post("/departments/semesters", {
        name: "3",
        department: deptId,
        studentCount: 60,
      });
      const c = await api.post("/departments/courses", {
        name: `Shared Course ${code}`,
        code: `SC${tag}${i}`,
        credits: 3,
        semester: s.data.data._id,
        exams: { ia1: false, ia2: false, ia3: false, see: true },
      });
      depts.push({
        id: deptId,
        code,
        courseId: c.data.data._id,
        rooms: roomIds.slice(i * ROOMS_PER_DEPT, (i + 1) * ROOMS_PER_DEPT),
      });
    }
  });

  const planFor = (dept, date, prefix) => {
    const localId = `${prefix}-${dept.code}`;
    return {
      departmentId: dept.id,
      schedules: [{ courseId: dept.courseId, date, startTime: START, endTime: END, localId }],
      roomAssignments: dept.rooms.map((roomId) => ({
        scheduleId: localId,
        roomId,
        departmentCode: dept.code,
      })),
    };
  };

  const finalize = async (plans) => {
    const res = await api.post("/create-exams/see/finalize", { semester: 3, departments: plans });
    assertStatus(res, 201);
    for (const g of res.data.data) createdGroups.push(g._id);
    return res.data.data.map((g) => g._id);
  };

  // The shared axios client throws on non-2xx; read the status either way.
  const statusOf = (request) =>
    request.then((res) => res.status, (err) => (err.response ? err.response.status : 0));

  const detailsOf = async (groupId) => (await api.get(`/exam-groups/${groupId}/details`)).data.data;
  const dcsOf = async (params) => (await api.get("/dcs/groups", { params })).data.data;

  // Mirrors the client's RS grouping: chunks of ≤5 per schedule + building.
  const rsGroupCount = (detailsList) => {
    const perPartition = new Map();
    for (const d of detailsList) {
      for (const s of d.schedules) {
        for (const r of s.rooms) {
          const key = `${s._id}|${r.room.building._id}`;
          perPartition.set(key, (perPartition.get(key) || 0) + 1);
        }
      }
    }
    let n = 0;
    for (const count of perPartition.values()) n += Math.ceil(count / 5);
    return n;
  };

  const expectSharedSitting = async (groupIds, { rooms, dcs }) => {
    const details = await Promise.all(groupIds.map(detailsOf));
    const scheduleIds = new Set(details.flatMap((d) => d.schedules.map((s) => String(s._id))));
    assertEqual(scheduleIds.size, 1, "departments at one time share one schedule");
    for (const d of details) {
      assertEqual(d.schedules[0].rooms.length, ROOMS_PER_DEPT, "a card lists only its own rooms");
    }
    assertEqual(rsGroupCount(details), Math.ceil(rooms / 5), "RS groups across the slot");

    const [scheduleId] = scheduleIds;
    const groups = await dcsOf({ schedule: scheduleId });
    assertEqual(groups.length, dcs, "DCS groups for the slot");
    const covered = groups.flatMap((g) => g.assignedRooms.map((r) => String(r._id || r)));
    assertEqual(covered.length, rooms, "every room in exactly one DCS group");
    assertEqual(new Set(covered).size, rooms, "no room in two DCS groups");
    assert(groups.every((g) => g.dcsRequired === dcs), "dcsRequired matches the group count");
    return { scheduleId, groups };
  };

  let batchGroups = [];
  await test("One batch of 6 departments → one slot, 3 RS, 2 DCS", async () => {
    const date = day(0);
    // DCS targets: unscheduled semesters are estimated per department
    // (6 × ceil(60/300) = 6); once the SEE exists the real groups count (2).
    const users = (await api.get("/users", { params: { limit: 500 } })).data.data;
    const dcsId = users.find((u) => u.email === "dcs@examduty.com")._id;
    const dcsTotal = async () =>
      (await api.get(`/duty-calculation/teacher/${dcsId}/dcs-progress`)).data.data.breakdown.totalDuties;
    const before = await dcsTotal();

    batchGroups = await finalize(depts.map((d) => planFor(d, date, "A")));
    assertEqual(await dcsTotal(), before - 6 + 2, "institution DCS duties: 6 estimated → 2 real");
    assertEqual(batchGroups.length, DEPT_COUNT, "one exam card per department");
    await expectSharedSitting(batchGroups, { rooms: 12, dcs: 2 });
  });

  await test("Exam cards keep their own stats; a joiner's card lists the slot's DCS groups", async () => {
    const all = (await api.get("/exam-groups")).data.data;
    for (const [i, id] of batchGroups.entries()) {
      const card = all.find((g) => String(g._id) === String(id));
      assert(card, "card listed");
      assertEqual(card.totalSchedules, 1, "schedules on card");
      assertEqual(card.totalRooms, ROOMS_PER_DEPT, "rooms on card");
      assertEqual(card.departments.join(","), depts[i].code, "department chips");
    }
    const viaJoiner = await dcsOf({ examGroup: batchGroups[DEPT_COUNT - 1] });
    assertEqual(viaJoiner.length, 2, "DCS groups listed for a joining department's card");
  });

  let oneByOne = [];
  await test("Same 6 departments created one at a time → still 3 RS, 2 DCS", async () => {
    const date = day(2);
    for (const d of depts) {
      const [id] = await finalize([planFor(d, date, "B")]);
      oneByOne.push(id);
    }
    await expectSharedSitting(oneByOne, { rooms: 12, dcs: 2 });
  });

  await test("Deleting the slot's owner keeps the slot for the rest and re-sizes DCS", async () => {
    assertStatus(await api.delete(`/exam-groups/${oneByOne[0]}`), 200);
    const rest = oneByOne.slice(1);
    const details = await Promise.all(rest.map(detailsOf));
    const scheduleIds = new Set(details.flatMap((d) => d.schedules.map((s) => String(s._id))));
    assertEqual(scheduleIds.size, 1, "remaining departments still share the slot");
    assert(details.every((d) => d.schedules[0].rooms.length === ROOMS_PER_DEPT), "their rooms survive");
    const [scheduleId] = scheduleIds;
    const groups = await dcsOf({ schedule: scheduleId });
    assertEqual(groups.length, 1, "300 students left → 1 DCS");
    assertEqual(groups[0].assignedRooms.length, 10, "the DCS covers the 10 remaining rooms");
    assertEqual(
      String(groups[0].examGroup?._id || groups[0].examGroup),
      String(rest[0]),
      "DCS groups move to the new owner",
    );
  });

  await test("A single-schedule delete on a shared slot is refused", async () => {
    const d = await detailsOf(oneByOne[1]);
    const status = await statusOf(api.delete(`/exam-groups/schedules/${d.schedules[0]._id}`));
    assertEqual(status, 409, "status");
  });

  // ---- Groups teachers already hold: rooms are added / removed, holders told ----
  const SEEDED = { dcs: ["dcs@examduty.com", "Dcs12345"], rs: ["rs@examduty.com", "Rs123456"] };
  const people = {}; // role → { id, token }
  const liveDuties = async (teacherId, role, scheduleId) =>
    (await api.get("/duties", { params: { teacher: teacherId } })).data.data.filter(
      (d) =>
        d.role === role &&
        d.status === "assigned" &&
        String(d.examSchedule?._id || d.examSchedule) === String(scheduleId),
    );
  const roomsOf = (duties) => duties.map((d) => d.room).sort();
  const notificationsOf = async (role, type, since) => {
    setToken(people[role].token);
    try {
      const list = (await api.get("/notifications", { params: { limit: 50 } })).data.data;
      return list.filter((n) => n.type === type && new Date(n.createdAt) >= since);
    } finally {
      setToken(token);
    }
  };

  let heldSchedule = null;
  let heldDcsGroup = null;
  let heldGroups = [];
  await test("Setup: 1st department alone; DCS + RS take its groups", async () => {
    const users = (await api.get("/users", { params: { limit: 500 } })).data.data;
    for (const [role, [email, password]] of Object.entries(SEEDED)) {
      const u = users.find((x) => x.email === email);
      assert(u, `seeded ${role} user`);
      const login = await api.post("/auth/login", { email, password });
      people[role] = { id: u._id, token: login.data.data.token };
    }
    setToken(token);

    const [first] = await finalize([planFor(depts[0], day(4), "C")]);
    heldGroups = [first];
    const d = await detailsOf(first);
    heldSchedule = d.schedules[0]._id;

    [heldDcsGroup] = await dcsOf({ examGroup: first });
    const claim = await api.post(`/dcs/groups/${heldDcsGroup._id}/admin-claim`, { teacher: people.dcs.id });
    assert(claim.status === 200 || claim.status === 201, `admin-claim → ${claim.status}`);

    const rs = await api.post("/duties/admin-assign-group", {
      teacher: people.rs.id,
      examSchedule: heldSchedule,
      examRooms: d.schedules[0].rooms.map((r) => r._id),
      role: "rs",
    });
    assertStatus(rs, 201);
    assertEqual(roomsOf(await liveDuties(people.dcs.id, "dcs", heldSchedule)).join(","), "101,102", "DCS rooms");
    assertEqual(roomsOf(await liveDuties(people.rs.id, "rs", heldSchedule)).join(","), "101,102", "RS rooms");
  });

  await test("5 departments join later → held groups grow, still 3 RS / 2 DCS, holders notified", async () => {
    const since = new Date();
    const joined = await finalize(depts.slice(1).map((d) => planFor(d, day(4), "C")));
    heldGroups.push(...joined);
    const { groups } = await expectSharedSitting(heldGroups, { rooms: 12, dcs: 2 });

    const kept = groups.find((g) => String(g._id) === String(heldDcsGroup._id));
    assertEqual(kept.status, "claimed", "DCS group stays claimed");
    assertEqual(kept.assignedRooms.length, 6, "DCS group topped up to half the slot");
    assertEqual(
      roomsOf(await liveDuties(people.dcs.id, "dcs", heldSchedule)).join(","),
      "101,102,103,104,105,106",
      "DCS now holds a duty in every room of its group",
    );
    assertEqual(
      roomsOf(await liveDuties(people.rs.id, "rs", heldSchedule)).join(","),
      "101,102,103,104,105",
      "RS group grew to its full 5 rooms",
    );

    const [dcsNote] = await notificationsOf("dcs", "duty_group_updated", since);
    assert(dcsNote, "DCS got a duty_group_updated notification");
    assert(/rooms 103, 104, 105, 106 added/.test(dcsNote.message), `DCS message: ${dcsNote.message}`);
    const [rsNote] = await notificationsOf("rs", "duty_group_updated", since);
    assert(rsNote, "RS got a duty_group_updated notification");
    assert(/rooms 103, 104, 105 added/.test(rsNote.message), `RS message: ${rsNote.message}`);
  });

  await test("Deleting one department's exam removes its rooms from every group, holders notified", async () => {
    const since = new Date();
    // depts[1] sat in rooms 103 + 104.
    assertStatus(await api.delete(`/exam-groups/${heldGroups[1]}`), 200);

    // 300 students left → 1 DCS: the held group absorbs the open one's rooms.
    const groups = await dcsOf({ schedule: heldSchedule });
    assertEqual(groups.length, 1, "DCS groups for 300 students");
    assertEqual(String(groups[0]._id), String(heldDcsGroup._id), "the held group is the one kept");
    assertEqual(
      roomsOf(await liveDuties(people.dcs.id, "dcs", heldSchedule)).join(","),
      "101,102,105,106,107,108,109,110,111,112",
      "DCS covers the 10 remaining rooms",
    );
    // RS groups re-form: 101,102,105,106,107 is the RS's group now.
    assertEqual(
      roomsOf(await liveDuties(people.rs.id, "rs", heldSchedule)).join(","),
      "101,102,105,106,107",
      "RS keeps the re-formed first group",
    );

    for (const role of ["dcs", "rs"]) {
      const [note] = await notificationsOf(role, "duty_group_updated", since);
      assert(note, `${role} got a duty_group_updated notification`);
      assert(/rooms 103, 104 removed/.test(note.message), `${role} message: ${note.message}`);
      const generic = await notificationsOf(role, "exam_deleted_duty_release", since);
      assertEqual(generic.length, 0, `${role} gets no per-room "duty cancelled" notices`);
    }
  });

  await test("Cleanup: delete this suite's exams", async () => {
    // 404 = already deleted above.
    for (const id of createdGroups) {
      const status = await statusOf(api.delete(`/exam-groups/${id}`));
      assert(status === 200 || status === 404, `delete ${id} → ${status}`);
    }
  });

  return summary("SHARED SEE SITTING");
}

module.exports = run;
if (require.main === module) run();
