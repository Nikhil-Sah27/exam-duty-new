const {
  api, setToken, test,
  assert, assertStatus, summary, resetCounters, futureDate, CONFIG,
} = require("./helpers");

/**
 * Role guards across the API: what a teacher can and can't reach.
 *
 *   - every catalogue / exam / room / seat write is CS-only
 *   - the staff directory and other teachers' workloads are CS-only
 *   - teachers keep the reads their pages need (exams, departments, buildings,
 *     their own progress)
 *   - a teacher only ever gets their own duties, whatever they ask for
 *   - CS keeps full access
 */
async function run(token) {
  console.log("\n🔐 AUTHORIZATION TESTS\n");
  resetCounters();

  if (!token) {
    const res = await api.post("/auth/login", { email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD });
    token = res.data.data.token;
  }
  const adminToken = token;
  setToken(adminToken);

  const stamp = Date.now();
  const password = "teacher123";
  const emailA = `authz_a_${stamp}@test.com`;
  const emailB = `authz_b_${stamp}@test.com`;
  const someId = "000000000000000000000000";
  let teacherA = null;
  let teacherB = null;
  let tokenA = null;
  let tokenB = null;
  let dutyA = null;

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
      return;
    }
    throw new Error(`expected ${status}, request succeeded`);
  };
  const loginAs = async (email) => (await api.post("/auth/login", { email, password })).data.data.token;

  await test("Setup: two invigilators and a duty for the first", async () => {
    const mk = async (name, email, phone) =>
      (await api.post("/users", { name, email, password, phone, designation: "Other", role: "invigilator" })).data.data;
    teacherA = await mk("Authz A", emailA, "9990000180");
    teacherB = await mk("Authz B", emailB, "9990000181");
    const date = futureDate(30);
    const exam = (await api.post("/exams", { name: "Authz Exam", date, department: "CSE", semester: 5, type: "internal" })).data.data;
    const duty = await api.post("/duties/admin-assign", {
      exam: exam._id || exam.id,
      teacher: teacherA._id || teacherA.id,
      role: "invigilator",
      room: `AZ-${stamp % 1000}`,
      date,
      startTime: "09:00",
      endTime: "12:00",
    });
    dutyA = duty.data.data._id || duty.data.data.id;
    tokenA = await loginAs(emailA);
    tokenB = await loginAs(emailB);
    assert(dutyA && tokenA && tokenB, "setup incomplete");
  });

  const csOnlyWrites = [
    ["post", "/exam-groups", {}],
    ["patch", `/exam-groups/${someId}`, {}],
    ["delete", `/exam-groups/${someId}`],
    ["post", "/exam-groups/schedules", {}],
    ["delete", `/exam-groups/schedules/${someId}`],
    ["post", "/exam-groups/rooms", {}],
    ["delete", `/exam-groups/rooms/${someId}`],
    ["post", "/create-exams/cie/plan", {}],
    ["post", "/create-exams/cie/assign-rooms", {}],
    ["post", "/create-exams/cie/finalize", {}],
    ["post", "/create-exams/see/plan", {}],
    ["post", "/create-exams/see/finalize", {}],
    ["post", "/exams", {}],
    ["put", `/exams/${someId}`, {}],
    ["patch", `/exams/${someId}/cancel`, {}],
    ["patch", `/exams/${someId}/restore`, {}],
    ["post", "/departments", {}],
    ["patch", `/departments/${someId}`, {}],
    ["delete", `/departments/${someId}`],
    ["post", "/departments/semesters", {}],
    ["post", "/departments/elective-groups", {}],
    ["post", "/departments/courses", {}],
    ["delete", `/departments/courses/${someId}`],
    ["post", "/infrastructure/buildings", {}],
    ["delete", `/infrastructure/buildings/${someId}`],
    ["post", "/infrastructure/rooms", {}],
    ["post", "/infrastructure/rooms/bulk", {}],
    ["patch", `/infrastructure/rooms/${someId}`, {}],
    ["delete", `/infrastructure/rooms/${someId}`],
    ["post", "/seat-sharing/mark-shareable", {}],
    ["post", "/seat-sharing/unmark-shareable", {}],
    ["delete", `/seat-sharing/allocations/${someId}`],
  ];

  await test(`Teacher is refused all ${csOnlyWrites.length} CS-only writes`, async () => {
    await as(tokenA, async () => {
      for (const [method, path, body] of csOnlyWrites) {
        try {
          await (body === undefined ? api[method](path) : api[method](path, body));
        } catch (err) {
          assert(err.response && err.response.status === 403, `${method.toUpperCase()} ${path}: expected 403, got ${err.response ? err.response.status : err.message}`);
          continue;
        }
        throw new Error(`${method.toUpperCase()} ${path}: expected 403, request succeeded`);
      }
    });
  });

  await test("Teacher can't read the staff directory or another teacher's workload", async () => {
    const idB = teacherB._id || teacherB.id;
    await as(tokenA, async () => {
      await expectStatus(403, () => api.get("/users"));
      await expectStatus(403, () => api.get(`/users/${idB}`));
      await expectStatus(403, () => api.get("/duty-calculation/all-teachers"));
      await expectStatus(403, () => api.get(`/duty-calculation/teacher/${idB}/progress`));
      await expectStatus(403, () => api.get(`/duty-calculation/teacher/${idB}/rs-progress`));
      await expectStatus(403, () => api.get(`/duty-calculation/teacher/${idB}/dcs-progress`));
    });
  });

  await test("Teacher keeps the reads their pages need", async () => {
    await as(tokenA, async () => {
      for (const path of ["/exam-groups", "/exams", "/departments", "/infrastructure/buildings", "/duty-calculation/my-progress"]) {
        const res = await api.get(path);
        assertStatus(res, 200);
      }
    });
  });

  await test("Teacher only ever lists their own duties", async () => {
    const idA = String(teacherA._id || teacherA.id);
    const idB = String(teacherB._id || teacherB.id);
    await as(tokenA, async () => {
      for (const params of [{}, { teacher: idB }]) {
        const duties = (await api.get("/duties", { params })).data.data;
        assert(duties.some((d) => String(d._id) === String(dutyA)), "own duty missing");
        assert(duties.every((d) => String(d.teacher?._id || d.teacher) === idA), `leaked another teacher's duty (params ${JSON.stringify(params)})`);
      }
    });
  });

  await test("Teacher can't open another teacher's duty; the holder can", async () => {
    await as(tokenB, () => expectStatus(404, () => api.get(`/duties/${dutyA}`)));
    await as(tokenA, async () => assertStatus(await api.get(`/duties/${dutyA}`), 200));
  });

  await test("CS keeps full access", async () => {
    assertStatus(await api.get("/users"), 200);
    assertStatus(await api.get(`/duties/${dutyA}`), 200);
    const all = (await api.get("/duties")).data.data;
    assert(new Set(all.map((d) => String(d.teacher?._id || d.teacher))).size >= 1, "CS should list duties");
  });

  return summary("AUTHORIZATION");
}

module.exports = run;
if (require.main === module) run();
