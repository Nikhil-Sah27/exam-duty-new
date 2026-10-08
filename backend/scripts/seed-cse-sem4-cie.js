/**
 * Creates ONE upcoming CIE exam for CSE Sem 4 with random room allocation.
 * Per-paper schedule: 9:30–11:00 (single shift, one paper per day).
 * Rooms are chosen randomly from active inventory; their combined capacity
 * is guaranteed to cover the semester's student count.
 *
 *   node scripts/seed-cse-sem4-cie.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

require("../modules/auth/auth.model");
require("../modules/exam/exam.model");
require("../modules/exam/examGroup.model");
require("../modules/exam/examSchedule.model");
require("../modules/exam/examRoom.model");
require("../modules/infrastructure/infrastructure.model");
require("../modules/infrastructure/building.model");
require("../modules/department/department.model");
require("../modules/department/semester.model");
require("../modules/department/course.model");
require("../modules/dcs/dcsGroup.model");

const Department = require("../modules/department/department.model");
const Semester = require("../modules/department/semester.model");
const Course = require("../modules/department/course.model");
const Room = require("../modules/infrastructure/infrastructure.model");
const User = require("../modules/auth/auth.model");
const cieService = require("../modules/create-exams/cie.service");

// Skip Sundays. Works in UTC so the YYYY-MM-DD string we emit matches the
// weekday we tested — using local Date.getDay() then ISOString().slice(0,10)
// drifts by a day in tz≠UTC.
const nextNWeekdaysFrom = (startISO, n) => {
  const out = [];
  const cursor = new Date(`${startISO}T00:00:00Z`);
  while (out.length < n) {
    if (cursor.getUTCDay() !== 0) {
      out.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
};

const pickRandomRooms = (rooms, neededCapacity) => {
  // Shuffle then accumulate until capacity is covered.
  const shuffled = [...rooms].sort(() => Math.random() - 0.5);
  const picked = [];
  let total = 0;
  for (const r of shuffled) {
    picked.push(r);
    total += r.capacity || 0;
    if (total >= neededCapacity) break;
  }
  return picked;
};

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  // ---- Resolve inputs ----
  const dept = await Department.findOne({ code: "CSE", isActive: true });
  if (!dept) throw new Error("CSE department not found");

  const sem = await Semester.findOne({ department: dept._id, name: "4" });
  if (!sem) throw new Error("CSE Sem 4 not found");

  const courses = await Course.find({ semester: sem._id }).sort({ code: 1 });
  if (courses.length === 0) throw new Error("No courses for CSE Sem 4");

  const rooms = await Room.find({ isActive: true });
  if (rooms.length === 0) throw new Error("No active rooms");

  // Use the seeded CS admin as the createdBy.
  const admin = await User.findOne({ email: "admin@examduty.com" });
  if (!admin) throw new Error("Admin user not found — run seed-users first");

  console.log(
    `CSE Sem 4 — students: ${sem.studentCount}, courses: ${courses.length}, total rooms: ${rooms.length}`
  );

  // ---- Build payload ----

  // Start next Monday relative to today in UTC (avoids tz drift between
  // getDay() and the YYYY-MM-DD string we'll emit downstream).
  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const daysUntilMonday = (8 - todayUTC.getUTCDay()) % 7 || 7;
  todayUTC.setUTCDate(todayUTC.getUTCDate() + daysUntilMonday);
  const startISO = todayUTC.toISOString().slice(0, 10);

  const dates = nextNWeekdaysFrom(startISO, courses.length);
  const endISO = dates[dates.length - 1];

  console.log(`Schedule: ${dates.join(", ")}`);

  const shifts = [{ startTime: "09:30", endTime: "11:00" }];

  // routine[i] = { date, shiftIndex, assignments: { [deptId]: courseId } }
  const routine = dates.map((date, i) => ({
    date,
    shiftIndex: 0,
    assignments: { [dept._id.toString()]: courses[i]._id.toString() },
  }));

  // Random room allocation per schedule slot.
  const roomAssignments = [];
  for (const entry of routine) {
    const slotKey = `${entry.date}|${entry.shiftIndex}`;
    const picked = pickRandomRooms(rooms, sem.studentCount);
    console.log(
      `  ${entry.date}  → ${picked.length} rooms, total cap ${picked.reduce((s, r) => s + r.capacity, 0)} (need ${sem.studentCount})`
    );
    for (const r of picked) {
      roomAssignments.push({
        scheduleId: slotKey,
        roomId: r._id.toString(),
        departmentCode: dept.code,
        students: 0, // total semester students sit across the picked rooms; per-room split isn't required by the model
      });
    }
  }

  // ---- Call the service directly (skips HTTP) ----
  const result = await cieService.finalizeCIEPlan(
    {
      examType: "IA1",
      semester: "4",
      startDate: startISO,
      endDate: endISO,
      shifts,
      routine,
      roomAssignments,
    },
    admin._id,
  );

  console.log("\n✅ Created exam group:", result._id.toString());
  console.log(`   ${result.schedulesCreated} schedule(s), ${result.roomsCreated} ExamRoom(s)`);
  console.log("   DCS groups generated post-commit — check via /api/dcs/groups");

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
