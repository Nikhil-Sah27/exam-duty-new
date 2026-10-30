/**
 * Seed a self-contained demo college — "Proctavo Demo College" (code DEMO) —
 * so a Google Play reviewer can sign in to the mobile app and see realistic
 * data without seeing any real college's teachers.
 *
 * Run (from backend/):
 *   DEMO_PASSWORD='…' node scripts/seed-demo-college.js
 *
 * Everything below lands in the DEMO college only (the tenancy plugin fences
 * it), through the same services the API uses:
 *   - the college (CIE + SEE switched on) and its CS, cs@demo.proctavo.com;
 *   - reviewer@demo.proctavo.com, an Assistant Professor (invigilator): the
 *     Play reviewer's login. Plus 11 colleagues whose designations give DCS,
 *     RS and invigilator roles;
 *   - CSE + ECE semester 5 (courses, student counts) and one building with 8
 *     rooms;
 *   - a SEE exam, both departments sitting together, 3 sittings from ~5 days
 *     out, created by the same finalize service the Create Exams page calls;
 *   - duties through the self-claim / CS-assign services. The reviewer
 *     self-claims one invigilator room per sitting, so those start confirmed.
 *     A few colleagues hold rooms, RS groups and DCS groups, so some rooms
 *     read "Occupied".
 *
 * Idempotent: a re-run reuses the college, accounts, departments and rooms,
 * creates no exam while DEMO still has one that hasn't ended, and skips duties
 * already held. Once the demo exam is over, a re-run publishes a fresh one
 * dated from today, so the reviewer has upcoming duties again. Nothing is ever
 * deleted. Every account gets DEMO_PASSWORD (the app's rule: 6+ characters).
 * An existing demo account whose password differs is reset to it. An address
 * that belongs to another college is refused, never adopted.
 *
 * Side effects: creating the exam and the duties fires the usual
 * notifications, so email and push outbox rows are queued for the
 * @demo.proctavo.com accounts. This process only writes those rows. The
 * running server's dispatchers deliver them (demo addresses may bounce; mail
 * failures are swallowed by design), and its 6-hourly sweep sends the
 * calendar invites.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

const { runAsCollege, runAsPlatform } = require("../shared/tenancy/context");
const { appTimezone, localToUtc } = require("../shared/utils/datetime");
const { chunkRsGroups } = require("../shared/utils/roomOrder");
const College = require("../modules/college/college.model");
const User = require("../modules/auth/auth.model");
const { ensureCollegeSetup } = require("../modules/college/college.migration");
const collegeService = require("../modules/college/college.service");
const userService = require("../modules/user/user.service");
const departmentService = require("../modules/department/department.service");
const infrastructureService = require("../modules/infrastructure/infrastructure.service");
const seeService = require("../modules/create-exams/see.service");
const examGroupService = require("../modules/exam/examGroup.service");
const examScheduleService = require("../modules/exam/examSchedule.service");
const examRoomService = require("../modules/exam/examRoom.service");
const dutyService = require("../modules/duty/duty.service");
const dcsGroupService = require("../modules/dcs/dcsGroup.service");
const mailDispatcher = require("../modules/mail/mail.dispatcher");
const pushDispatcher = require("../modules/push/push.dispatcher");
const calendarSync = require("../modules/calendar/calendar.sync");

// ── Demo data ───────────────────────────────────────────────────────────────

const COLLEGE = { name: "Proctavo Demo College", code: "DEMO", features: { cie: true, see: true } };
const EMAIL_DOMAIN = "demo.proctavo.com";
const MIN_PASSWORD_LENGTH = 6; // the app's rule (user.service.js MIN_PASSWORD_LENGTH)

const CSE = "Computer Science and Engineering";
const ECE = "Electronics and Communication Engineering";

// The email is `<key>@demo.proctavo.com`.
const CS_ACCOUNT = {
  key: "cs",
  name: "Shalini Bhat",
  designation: "Other",
  roles: ["cs"],
  department: "Exam cell",
  phone: "+91 90000 00100",
};

const REVIEWER = "reviewer";

// Roles come from the designation (shared/utils/roleResolver.js): HOD/Dean → DCS,
// Professor → RS, Associate Professor → RS + invigilator, Assistant Professor →
// invigilator.
const TEACHERS = [
  { key: REVIEWER, name: "Ananya Rao", designation: "Assistant Professor", department: CSE, phone: "+91 90000 00101" },
  { key: "ramesh.kulkarni", name: "Ramesh Kulkarni", designation: "HOD/Dean", department: CSE, phone: "+91 90000 00102" },
  { key: "lakshmi.narayanan", name: "Lakshmi Narayanan", designation: "HOD/Dean", department: ECE, phone: "+91 90000 00103" },
  { key: "suresh.hegde", name: "Suresh Hegde", designation: "Professor", department: CSE, phone: "+91 90000 00104" },
  { key: "kavitha.reddy", name: "Kavitha Reddy", designation: "Professor", department: ECE, phone: "+91 90000 00105" },
  { key: "arjun.mehta", name: "Arjun Mehta", designation: "Associate Professor", department: CSE, phone: "+91 90000 00106" },
  { key: "priya.iyer", name: "Priya Iyer", designation: "Associate Professor", department: ECE, phone: "+91 90000 00107" },
  { key: "vikram.shetty", name: "Vikram Shetty", designation: "Assistant Professor", department: CSE, phone: "+91 90000 00108" },
  { key: "sneha.patil", name: "Sneha Patil", designation: "Assistant Professor", department: ECE, phone: "+91 90000 00109" },
  { key: "rahul.deshpande", name: "Rahul Deshpande", designation: "Assistant Professor", department: CSE, phone: "+91 90000 00110" },
  { key: "meghana.joshi", name: "Meghana Joshi", designation: "Assistant Professor", department: ECE, phone: "+91 90000 00111" },
  { key: "karthik.subramanian", name: "Karthik Subramanian", designation: "Assistant Professor", department: ECE, phone: "+91 90000 00112" },
];

const SEMESTER = "5";

// Course i of every department sits in sitting i, all departments together (a
// shared SEE sitting: one schedule, so RS chunks and DCS sizing span both).
// 180 + 150 students → ceil(330 / 300) = 2 DCS groups; 7 rooms → RS groups of 5 + 2.
const DEPARTMENTS = [
  {
    name: CSE,
    code: "CSE",
    students: 180,
    rooms: ["101", "102", "103", "104"],
    courses: [
      { code: "CS501", name: "Database Management Systems", credits: 4 },
      { code: "CS502", name: "Computer Networks", credits: 4 },
      { code: "CS503", name: "Operating Systems", credits: 3 },
    ],
  },
  {
    name: ECE,
    code: "ECE",
    students: 150,
    rooms: ["201", "202", "203"],
    courses: [
      { code: "EC501", name: "Digital Signal Processing", credits: 4 },
      { code: "EC502", name: "VLSI Design", credits: 4 },
      { code: "EC503", name: "Control Systems", credits: 3 },
    ],
  },
];

const BUILDING = {
  name: "Main Academic Block",
  rooms: [
    { roomNumber: "101", floor: 1, capacity: 48 },
    { roomNumber: "102", floor: 1, capacity: 48 },
    { roomNumber: "103", floor: 1, capacity: 48 },
    { roomNumber: "104", floor: 1, capacity: 48 },
    { roomNumber: "201", floor: 2, capacity: 54 },
    { roomNumber: "202", floor: 2, capacity: 54 },
    { roomNumber: "203", floor: 2, capacity: 54 },
    { roomNumber: "204", floor: 2, capacity: 60 },
  ],
};

// First sitting this many days from today, then every `gapDays` (never on a Sunday).
const SITTINGS = { firstInDays: 5, gapDays: 3, startTime: "09:30", endTime: "12:30" };

// Who holds what, by sitting (0-based). `room` for invigilators, `rsGroup` /
// `dcsGroup` (0-based) for group roles. Everything is self-claimed except
// `via: "cs"`, which CS assigns and so stays unconfirmed.
const DUTY_PLAN = [
  { sitting: 0, teacher: REVIEWER, role: "invigilator", room: "102" },
  { sitting: 1, teacher: REVIEWER, role: "invigilator", room: "201" },
  { sitting: 2, teacher: REVIEWER, role: "invigilator", room: "103" },
  { sitting: 0, teacher: "vikram.shetty", role: "invigilator", room: "101" },
  { sitting: 0, teacher: "arjun.mehta", role: "invigilator", room: "104" },
  { sitting: 0, teacher: "sneha.patil", role: "invigilator", room: "201" },
  { sitting: 1, teacher: "rahul.deshpande", role: "invigilator", room: "202", via: "cs" },
  { sitting: 2, teacher: "meghana.joshi", role: "invigilator", room: "104" },
  { sitting: 0, teacher: "suresh.hegde", role: "rs", rsGroup: 0 },
  { sitting: 1, teacher: "kavitha.reddy", role: "rs", rsGroup: 1 },
  { sitting: 2, teacher: "priya.iyer", role: "rs", rsGroup: 0 },
  { sitting: 0, teacher: "ramesh.kulkarni", role: "dcs", dcsGroup: 0 },
  { sitting: 1, teacher: "lakshmi.narayanan", role: "dcs", dcsGroup: 1 },
];

// ── Output ──────────────────────────────────────────────────────────────────

const tally = { created: 0, skipped: 0, warnings: 0 };
const created = (what) => {
  tally.created += 1;
  console.log(`  + ${what}`);
};
const skipped = (what) => {
  tally.skipped += 1;
  console.log(`  = ${what}`);
};
const warn = (what) => {
  tally.warnings += 1;
  console.warn(`  ! ${what}`);
};

// ── Pure helpers ────────────────────────────────────────────────────────────

const emailFor = (key) => `${key}@${EMAIL_DOMAIN}`;

const demoPassword = () => {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    throw new Error("DEMO_PASSWORD is required: DEMO_PASSWORD='…' node scripts/seed-demo-college.js");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`DEMO_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters (the app's password rule)`);
  }
  return password;
};

/** Today's calendar date in the institution's timezone, "YYYY-MM-DD". */
const todayIn = (tz) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const isoDay = (date) => new Date(date).toISOString().slice(0, 10);

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
};

const skipSunday = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() === 0 ? addDays(iso, 1) : iso);

const sittingDates = (today, count) => {
  const dates = [];
  let next = addDays(today, SITTINGS.firstInDays);
  for (let i = 0; i < count; i += 1) {
    const date = skipSunday(next);
    dates.push(date);
    next = addDays(date, SITTINGS.gapDays);
  }
  return dates;
};

/** The /create-exams/see/finalize payload: one plan per department, same sittings. */
const seePayload = ({ departments, roomsByNumber, dates }) => ({
  semester: SEMESTER,
  departments: departments.map(({ spec, dept, courses }) => {
    const courseByCode = new Map(courses.map((c) => [c.code, c]));
    const schedules = spec.courses.map((course, i) => ({
      slotKey: `${spec.code}-${i + 1}`,
      courseId: String(courseByCode.get(course.code)._id),
      date: dates[i],
      startTime: SITTINGS.startTime,
      endTime: SITTINGS.endTime,
    }));
    return {
      departmentId: String(dept._id),
      schedules,
      roomAssignments: schedules.flatMap((s) =>
        spec.rooms.map((roomNumber) => ({
          scheduleId: s.slotKey,
          roomId: String(roomsByNumber.get(roomNumber)._id),
          departmentCode: spec.code,
          students: Math.ceil(spec.students / spec.rooms.length),
        }))
      ),
    };
  }),
});

const describeSitting = (s) => `${isoDay(s.date)} ${s.startTime}–${s.endTime}`;

const isTaken = (err) => err && (err.statusCode === 409 || err.code === 11000);

// ── Process setup ───────────────────────────────────────────────────────────

/**
 * This process only writes outbox rows; the running server delivers them. A
 * drain kicked here would claim rows (any college's, it runs platform-wide)
 * and could be cut off mid-send by the disconnect at the end, leaving them
 * stuck in "processing". The calendar debounce would also fire after the
 * disconnect. So delivery and calendar sync stay with the server.
 */
const leaveDeliveryToServer = () => {
  for (const [mod, fn] of [[mailDispatcher, "kick"], [pushDispatcher, "kick"], [calendarSync, "markDirty"]]) {
    if (typeof mod[fn] !== "function") throw new Error(`Expected ${fn}() to exist; update leaveDeliveryToServer`);
    mod[fn] = () => {};
  }
};

/**
 * On an empty database the first college becomes the oldest, which other
 * scripts treat as "Main college". Create Main first, as server boot would, so
 * DEMO never takes its place. A database that has colleges is left alone.
 */
const ensureMainCollegeFirst = async () => {
  if (!(await runAsPlatform(() => College.exists({})))) await ensureCollegeSetup();
};

/** Wait for index builds, e.g. the one-live-duty-per-slot index, before any claim. */
const waitForIndexes = () => Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));

/** Fire-and-forget notifications from the claim paths need a moment to land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 2000));

// ── College and accounts ────────────────────────────────────────────────────

const findCollege = () => runAsPlatform(() => College.findOne({ code: COLLEGE.code }).lean());

const ensureCollege = async (password) => {
  const existing = await findCollege();
  if (existing) {
    skipped(`college "${existing.name}" (${existing.code})`);
    if (existing.status !== "active") warn(`DEMO is ${existing.status}: nobody can sign in until the superadmin reactivates it`);
    const off = Object.entries(COLLEGE.features).filter(([key]) => existing.features?.[key] === false);
    if (off.length) warn(`DEMO has ${off.map(([key]) => key).join(", ")} switched off: those exams stay hidden`);
    return { college: existing, createdCs: false };
  }
  const { key, ...cs } = CS_ACCOUNT;
  await runAsPlatform(() =>
    collegeService.createCollege({ ...COLLEGE, cs: { ...cs, email: emailFor(key), password } })
  );
  created(`college "${COLLEGE.name}" (${COLLEGE.code}), CIE + SEE on`);
  created(`CS ${emailFor(key)}`);
  return { college: await findCollege(), createdCs: true };
};

// Emails are unique platform-wide, so look across colleges (deactivated too).
const findAccount = (email) =>
  runAsPlatform(() =>
    User.findOne({ email, isActive: { $in: [true, false] } }).select("+password name email roles college isActive")
  );

const ensureAccount = async (college, spec, password) => {
  const email = emailFor(spec.key);
  const existing = await findAccount(email);
  if (!existing) {
    const { key, ...profile } = spec;
    const user = await userService.createUser({ ...profile, email, password });
    created(`${user.roles.join("+").padEnd(15)} ${email} (${spec.designation})`);
    return user;
  }
  if (String(existing.college) !== String(college._id)) {
    throw new Error(`${email} belongs to another college; refusing to touch it`);
  }
  if (!existing.isActive) warn(`${email} is deactivated: reactivate it under Teachers to sign in`);
  if (!(await bcrypt.compare(password, existing.password))) {
    await userService.setPassword(existing._id, password);
    console.log(`  ~ ${email}: password reset to DEMO_PASSWORD`);
  }
  skipped(`${existing.roles.join("+").padEnd(15)} ${email}`);
  return existing;
};

// ── Departments and rooms ───────────────────────────────────────────────────

const ensureDepartment = async (spec) => {
  let dept = (await departmentService.getAllDepartments()).find((d) => d.code === spec.code);
  if (dept) skipped(`department ${spec.code}`);
  else {
    dept = await departmentService.createDepartment({ name: spec.name, code: spec.code });
    created(`department ${spec.code}: ${spec.name}`);
  }

  let semester = (await departmentService.getSemesters(dept._id)).find((s) => s.name === SEMESTER);
  if (semester) skipped(`${spec.code} semester ${SEMESTER} (${semester.studentCount} students)`);
  else {
    semester = await departmentService.createSemester({
      name: SEMESTER,
      department: dept._id,
      studentCount: spec.students,
    });
    created(`${spec.code} semester ${SEMESTER}, ${spec.students} students`);
  }

  const existingCodes = new Set((await departmentService.getCourses(semester._id)).map((c) => c.code));
  for (const course of spec.courses) {
    if (existingCodes.has(course.code)) {
      skipped(`course ${course.code}`);
      continue;
    }
    await departmentService.createCourse({
      ...course,
      semester: String(semester._id),
      courseType: "core",
      exams: { ia1: true, ia2: true, ia3: true, see: true },
    });
    created(`course ${course.code} ${course.name}`);
  }

  return { spec, dept, courses: await departmentService.getCourses(semester._id) };
};

const ensureBuilding = async () => {
  let building = (await infrastructureService.listActiveBuildings()).find((b) => b.name === BUILDING.name);
  if (building) skipped(`building "${BUILDING.name}"`);
  else {
    building = await infrastructureService.createBuilding({ name: BUILDING.name });
    created(`building "${BUILDING.name}"`);
  }

  const result = await infrastructureService.createRoomsBulk(building._id, BUILDING.rooms);
  if (result.created.length) created(`rooms ${result.created.map((r) => r.roomNumber).join(", ")}`);
  if (result.skipped.length) skipped(`rooms ${result.skipped.join(", ")}`);

  const rooms = await infrastructureService.getRoomsByBuilding(building._id);
  return new Map(rooms.map((r) => [r.roomNumber, r]));
};

// ── Exam ────────────────────────────────────────────────────────────────────

const isDemoExam = (group) => group.examType === "SEE" && String(group.semester) === SEMESTER;

/** Active exam groups whose last day is today or later. */
const unfinishedExamGroups = async (today) =>
  (await examGroupService.getAllGroups({})).filter((g) => isoDay(g.endDate) >= today);

const ensureDemoExam = async ({ cs, departments, roomsByNumber, today }) => {
  const live = await unfinishedExamGroups(today);
  if (live.length) {
    skipped(`exam: DEMO already has ${live.length} active exam group(s) not yet over`);
    return live.filter(isDemoExam);
  }

  const dates = sittingDates(today, DEPARTMENTS[0].courses.length);
  await seeService.finalizeSEEPlan(seePayload({ departments, roomsByNumber, dates }), cs._id);
  created(
    `SEE · Semester ${SEMESTER} for ${DEPARTMENTS.map((d) => d.code).join(" + ")}: ` +
      `${dates.join(", ")}, ${SITTINGS.startTime}–${SITTINGS.endTime}`
  );
  return (await unfinishedExamGroups(today)).filter(isDemoExam);
};

/** The demo exam's sittings, oldest first. Departments share them, so de-dupe. */
const sittingsOf = async (groups) => {
  const byId = new Map();
  for (const group of groups) {
    for (const schedule of await examScheduleService.getSchedulesByGroup(group._id)) {
      byId.set(String(schedule._id), schedule);
    }
  }
  return [...byId.values()].sort((a, b) => a.date - b.date || a.startTime.localeCompare(b.startTime));
};

// ── Duties ──────────────────────────────────────────────────────────────────

/** The slot a plan step targets on `schedule`, or null when it doesn't exist. */
const resolveSlot = async (schedule, step) => {
  if (step.role === "dcs") {
    const groups = (await dcsGroupService.listGroups({ schedule: schedule._id })).sort(
      (a, b) => a.groupIndex - b.groupIndex
    );
    const group = groups[step.dcsGroup];
    return group && { dcsGroupId: group._id, label: `DCS group ${step.dcsGroup + 1}` };
  }
  const examRooms = await examRoomService.getRoomsBySchedule(schedule._id);
  if (step.role === "rs") {
    const chunk = chunkRsGroups(examRooms)[step.rsGroup];
    return chunk && {
      examRoomIds: chunk.map((er) => er._id),
      label: `RS group, rooms ${chunk.map((er) => er.room.roomNumber).join(", ")}`,
    };
  }
  const examRoom = examRooms.find((er) => er.room?.roomNumber === step.room);
  return examRoom && { examRoomId: examRoom._id, label: `invigilator, room ${step.room}` };
};

const claim = (step, { teacher, schedule, slot, cs }) => {
  const examSchedule = schedule._id;
  if (step.role === "dcs") return dcsGroupService.claimGroup(slot.dcsGroupId, teacher._id);
  if (step.role === "rs") {
    return dutyService.selfAssignDutyGroup({ examSchedule, examRooms: slot.examRoomIds }, teacher._id, "rs");
  }
  if (step.via === "cs") {
    return dutyService.adminAssignDuty(
      { examSchedule, examRoom: slot.examRoomId, teacher: teacher._id, role: "invigilator" },
      cs._id
    );
  }
  return dutyService.selfAssignDuty({ examSchedule, examRoom: slot.examRoomId }, teacher._id, "invigilator");
};

const heldUnit = async (teacherId, scheduleId) =>
  (await dutyService.getMyUpcomingUnits(teacherId)).find((u) => u.examScheduleId === String(scheduleId));

const seedDuties = async ({ sittings, accounts, cs }) => {
  for (const step of DUTY_PLAN) {
    const teacher = accounts.get(step.teacher);
    const schedule = sittings[step.sitting];
    if (!schedule) {
      warn(`${teacher.email}: the demo exam has no sitting ${step.sitting + 1}`);
      continue;
    }
    const when = describeSitting(schedule);
    if (localToUtc(schedule.date, schedule.endTime) <= new Date()) {
      skipped(`${teacher.email}: sitting ${when} is over`);
      continue;
    }
    const held = await heldUnit(teacher._id, schedule._id);
    if (held) {
      skipped(`${teacher.email}: holds ${held.role} on ${when}, ${held.location}`);
      continue;
    }
    const slot = await resolveSlot(schedule, step);
    if (!slot) {
      warn(`${teacher.email}: no such slot on ${when} (${JSON.stringify(step)})`);
      continue;
    }
    try {
      await claim(step, { teacher, schedule, slot, cs });
      created(`${teacher.email}: ${slot.label} on ${when}, ${step.via === "cs" ? "assigned by CS" : "self-claimed"}`);
    } catch (err) {
      if (isTaken(err)) skipped(`${teacher.email}: ${slot.label} on ${when} is taken (${err.message})`);
      else if (step.teacher === REVIEWER) throw err;
      else warn(`${teacher.email}: ${slot.label} on ${when} failed: ${err.message}`);
    }
  }
};

// ── Summary ─────────────────────────────────────────────────────────────────

const printSummary = async ({ college, cs, reviewer }) => {
  const units = await dutyService.getMyUpcomingUnits(reviewer._id);
  console.log(`\nDone: ${tally.created} created, ${tally.skipped} already there, ${tally.warnings} warning(s).`);
  console.log(`  College   ${college.name} (${college.code})`);
  console.log(`  CS        ${cs.email}`);
  console.log(`  Reviewer  ${reviewer.email}`);
  console.log("  Password  the DEMO_PASSWORD you ran this with");
  console.log(`  Reviewer's upcoming duties (${units.length}):`);
  for (const u of units) {
    console.log(`    ${u.date}  ${u.startTime}–${u.endTime}  ${u.role.padEnd(11)} ${u.location}  (${u.examLabel})`);
  }
  if (units.length < 2) warn("the reviewer has fewer than 2 upcoming duties; check the messages above");
};

// ── Main ────────────────────────────────────────────────────────────────────

const seedCollege = async ({ college, createdCs, password }) => {
  console.log("\nAccounts");
  const cs = createdCs ? await findAccount(emailFor(CS_ACCOUNT.key)) : await ensureAccount(college, CS_ACCOUNT, password);
  const accounts = new Map();
  for (const spec of TEACHERS) accounts.set(spec.key, await ensureAccount(college, spec, password));

  console.log("\nDepartments");
  const departments = [];
  for (const spec of DEPARTMENTS) departments.push(await ensureDepartment(spec));

  console.log("\nRooms");
  const roomsByNumber = await ensureBuilding();

  console.log("\nExam");
  const today = todayIn(appTimezone());
  const sittings = await sittingsOf(await ensureDemoExam({ cs, departments, roomsByNumber, today }));

  console.log("\nDuties");
  await seedDuties({ sittings, accounts, cs });
  await settle();

  await printSummary({ college, cs, reviewer: accounts.get(REVIEWER) });
};

const main = async () => {
  const password = demoPassword();
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  leaveDeliveryToServer();

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  await ensureMainCollegeFirst();
  await waitForIndexes();

  console.log("\nCollege");
  const { college, createdCs } = await ensureCollege(password);
  await runAsCollege(college, () => seedCollege({ college, createdCs, password }));

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
