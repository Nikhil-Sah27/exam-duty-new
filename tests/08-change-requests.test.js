const {
  api, setToken, test, skip,
  assert, assertExists, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

async function run(token) {
  console.log("\n🔄 CHANGE REQUEST TESTS\n");
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
  let dutyId = null;
  let requestId = null;
  let teacherAId = null;
  let teacherBId = null;
  let dutyBId = null;

  const teacherPassword = "teacher123";
  const teacherAEmail = `cr_teacherA_${Date.now()}@test.com`;
  const teacherBEmail = `cr_teacherB_${Date.now() + 1}@test.com`;
  const dutyDate = futureDate(25); // must be future — past-duty requests are rejected

  const loginAs = async (email) => {
    const res = await api.post("/auth/login", { email, password: teacherPassword });
    return res.data.data.token;
  };

  // Setup: Create exam, two single-role teachers, and a duty for teacher A.
  await test("Setup: create exam + teachers + duties", async () => {
    const examRes = await api.post("/exams", {
      name: "Change Req Test Exam",
      date: dutyDate,
      department: "CSE",
      semester: 5,
      type: "internal",
    });
    examId = examRes.data.data._id || examRes.data.data.id;

    const tARes = await api.post("/users", {
      name: "Teacher A CR",
      email: teacherAEmail,
      password: teacherPassword,
      phone: "9990000020",
      designation: "Other",
      role: "invigilator",
    });
    teacherAId = tARes.data.data._id || tARes.data.data.id;

    const tBRes = await api.post("/users", {
      name: "Teacher B CR",
      email: teacherBEmail,
      password: teacherPassword,
      phone: "9990000021",
      designation: "Other",
      role: "invigilator",
    });
    teacherBId = tBRes.data.data._id || tBRes.data.data.id;

    const dutyRes = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teacherAId,
      role: "invigilator",
      room: "CR-101",
      date: dutyDate,
      startTime: "09:00",
      endTime: "12:00",
    });
    dutyId = dutyRes.data.data._id || dutyRes.data.data.id;
  });

  // --- Create Drop Request (must be submitted by the duty owner) ---
  await test("POST /change-requests - create drop request", async () => {
    if (!dutyId) throw new Error("No duty");
    const teacherToken = await loginAs(teacherAEmail);
    setToken(teacherToken);
    try {
      const res = await api.post("/change-requests", {
        duty: dutyId,
        type: "drop",
        reason: "Personal emergency - test",
      });
      assertStatus(res, 201);
      requestId = res.data.data._id || res.data.data.id;
      assertExists(requestId, "request id");
    } finally {
      setToken(adminToken); // reviewer actions below run as admin
    }
  });

  // --- List All Requests ---
  await test("GET /change-requests - list all requests", async () => {
    const res = await api.get("/change-requests");
    assertStatus(res, 200);
    assert(Array.isArray(res.data.data), "data should be array");
  });

  // --- My Requests ---
  await test("GET /change-requests/mine - my requests", async () => {
    const res = await api.get("/change-requests/mine");
    assertStatus(res, 200);
    assert(Array.isArray(res.data.data), "data should be array");
  });

  // --- Get Request ---
  await test("GET /change-requests/:id - get request", async () => {
    if (!requestId) throw new Error("No request");
    const res = await api.get(`/change-requests/${requestId}`);
    assertStatus(res, 200);
  });

  // --- Reject Request ---
  await test("PATCH /change-requests/:id/reject - reject request", async () => {
    if (!requestId) throw new Error("No request");
    const res = await api.patch(`/change-requests/${requestId}/reject`, {
      note: "Rejected for testing purposes",
    });
    assertStatus(res, 200);
  });

  // Create another request to test approve
  let approveRequestId = null;

  await test("Setup: create another duty + drop request for approval test", async () => {
    if (!examId || !teacherBId) throw new Error("Missing data");
    const dutyRes = await api.post("/duties/admin-assign", {
      exam: examId,
      teacher: teacherBId,
      role: "invigilator",
      room: "CR-201",
      date: dutyDate,
      startTime: "14:00",
      endTime: "17:00",
    });
    dutyBId = dutyRes.data.data._id || dutyRes.data.data.id;

    const teacherToken = await loginAs(teacherBEmail);
    setToken(teacherToken);
    try {
      const reqRes = await api.post("/change-requests", {
        duty: dutyBId,
        type: "drop",
        reason: "Schedule conflict - test",
      });
      approveRequestId = reqRes.data.data._id || reqRes.data.data.id;
    } finally {
      setToken(adminToken);
    }
  });

  await test("PATCH /change-requests/:id/approve - approve request", async () => {
    if (!approveRequestId) throw new Error("No request to approve");
    const res = await api.patch(`/change-requests/${approveRequestId}/approve`, {
      note: "Approved for testing",
    });
    assertStatus(res, 200);
  });

  const result = summary("CHANGE REQUESTS");
  return result;
}

module.exports = run;
if (require.main === module) run();
