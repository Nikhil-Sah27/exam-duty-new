const {
  api, setToken, test, skip,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

async function run(token) {
  console.log("\n📌 DUTY TESTS\n");
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

  // We need an exam to assign duties to. Create one.
  let examId = null;
  let teacherId = null;
  let dutyId = null;
  const dutyDate = futureDate(20);
  const teacherEmail = `duty_teacher_${Date.now()}@test.com`;
  const teacherPassword = "teacher123";

  await test("Setup: create exam for duty tests", async () => {
    const res = await api.post("/exams", {
      name: "Duty Test Exam",
      date: dutyDate,
      department: "CSE",
      semester: 4,
      type: "internal",
    });
    examId = res.data.data._id || res.data.data.id;
  });

  // Create a single-role invigilator (designation "Other" fixes exactly one
  // role) so they can log in without the multi-role selection step.
  await test("Setup: create teacher user", async () => {
    const res = await api.post("/users", {
      name: "Duty Test Teacher",
      email: teacherEmail,
      password: teacherPassword,
      phone: "9990000010",
      designation: "Other",
      role: "invigilator",
    });
    teacherId = res.data.data._id || res.data.data.id;
  });

  // --- Admin Assign ---
  await test("POST /duties/admin-assign - assign duty", async () => {
    if (!examId || !teacherId) throw new Error("Missing exam or teacher");
    const res = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teacherId,
      role: "invigilator",
      room: "101",
      date: dutyDate,
      startTime: "09:00",
      endTime: "12:00",
    });
    assertStatus(res, 201);
    dutyId = res.data.data._id || res.data.data.id;
    assertExists(dutyId, "duty id");
  });

  await test("POST /duties/admin-assign - duplicate should fail (conflict)", async () => {
    if (!examId || !teacherId) throw new Error("Missing data");
    try {
      await api.post("/duties/admin-assign", {
        exam: examId,
        teacher: teacherId,
        role: "invigilator",
        room: "102",
        date: dutyDate,
        startTime: "09:00",
        endTime: "12:00",
      });
      throw new Error("Should fail - teacher conflict");
    } catch (err) {
      assert(err.response && err.response.status >= 400, "Should return 4xx");
    }
  });

  // --- Self Assign (as the teacher, at a non-conflicting time) ---
  await test("POST /duties/self-assign - self assign duty", async () => {
    if (!examId) throw new Error("No exam");
    const login = await api.post("/auth/login", {
      email: teacherEmail,
      password: teacherPassword,
    });
    const teacherToken = login.data.data.token;
    assertExists(teacherToken, "teacher token");
    setToken(teacherToken);
    try {
      const res = await api.post("/duties/self-assign", {
        exam: examId,
        room: "201",
        date: dutyDate,
        startTime: "14:00",
        endTime: "17:00",
      });
      assertStatus(res, 201);
    } finally {
      setToken(adminToken); // restore admin for the remaining tests
    }
  });

  // --- List Duties ---
  await test("GET /duties - list all duties", async () => {
    const res = await api.get("/duties");
    assertStatus(res, 200);
    assert(Array.isArray(res.data.data), "data should be array");
  });

  await test("GET /duties?status=assigned - filter by status", async () => {
    const res = await api.get("/duties?status=assigned");
    assertStatus(res, 200);
    assert(Array.isArray(res.data.data), "data should be array");
  });

  // --- Get Duty ---
  await test("GET /duties/:id - get duty", async () => {
    if (!dutyId) throw new Error("No duty");
    const res = await api.get(`/duties/${dutyId}`);
    assertStatus(res, 200);
    assertExists(res.data.data.room, "room");
  });

  // --- Cancel Duty ---
  await test("PATCH /duties/:id/cancel - cancel duty", async () => {
    if (!dutyId) throw new Error("No duty");
    const res = await api.patch(`/duties/${dutyId}/cancel`, {
      reason: "Test cancellation",
    });
    assertStatus(res, 200);
  });

  const result = summary("DUTIES");
  module.exports.examId = examId;
  module.exports.dutyId = dutyId;
  module.exports.teacherId = teacherId;
  return result;
}

module.exports = run;
module.exports.examId = null;
module.exports.dutyId = null;
module.exports.teacherId = null;
if (require.main === module) run();
