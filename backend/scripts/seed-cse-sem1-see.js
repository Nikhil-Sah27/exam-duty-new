// One-shot demo: create the SEE plan for CSE Semester 1 — all 5 foundation
// courses scheduled on a 3-day cadence (gap ≥ 2 days everywhere), 06:30–09:30
// each. Calls the same service the /create-exams/see/plan API endpoint uses,
// so the result is indistinguishable from clicking through the UI.

const mongoose = require("mongoose");
require("dotenv").config();

const Department = require("../modules/department/department.model");
const Semester = require("../modules/department/semester.model");
const Course = require("../modules/department/course.model");
const User = require("../modules/auth/auth.model");
const seeService = require("../modules/create-exams/see.service");

const START_DATE = "2026-05-30"; // first SEE
const STEP_DAYS = 3;             // gap between consecutive exams (≥ 2)
const START_TIME = "06:30";
const END_TIME = "09:30";

const addDays = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  const dept = await Department.findOne({ code: "CSE" });
  if (!dept) throw new Error("CSE department not found — run seed-departments.js first");

  const semester = await Semester.findOne({ department: dept._id, name: "1" });
  if (!semester) throw new Error("CSE Sem 1 not found");

  const courses = await Course.find({ semester: semester._id }).sort({ code: 1 });
  if (courses.length === 0) throw new Error("No courses for CSE Sem 1");
  console.log(`Found ${courses.length} courses for ${dept.code} Sem 1:`);
  courses.forEach((c) => console.log(`  ${c.code.padEnd(8)} ${c.name}`));

  const admin = await User.findOne({ email: "admin@examduty.com" });
  if (!admin) throw new Error("admin@examduty.com not found — run seed-users.js");

  // Build schedules: one course per row, 3 days apart starting 30-May-2026.
  const schedules = courses.map((course, idx) => ({
    courseId: course._id.toString(),
    date: addDays(START_DATE, idx * STEP_DAYS),
    startTime: START_TIME,
    endTime: END_TIME,
  }));

  console.log("\nProposed routine:");
  schedules.forEach((s, i) => {
    const day = new Date(s.date).toLocaleDateString("en-US", { weekday: "short" });
    console.log(
      `  ${i + 1}. ${courses[i].code}  ${day} ${s.date}  ${s.startTime}–${s.endTime}  ${courses[i].name}`,
    );
  });

  const result = await seeService.createSEEPlan(
    {
      departmentId: dept._id.toString(),
      semester: "1",
      schedules,
    },
    admin._id,
  );

  console.log("\nCreated SEE plan:");
  console.log(`  examGroup _id: ${result._id}`);
  console.log(`  examType: ${result.examType}`);
  console.log(`  semester: ${result.semester}`);
  console.log(`  startDate: ${result.startDate.toISOString().slice(0, 10)}`);
  console.log(`  endDate:   ${result.endDate.toISOString().slice(0, 10)}`);
  console.log(`  schedules: ${Object.keys(result.scheduleMapping).length}`);

  await mongoose.disconnect();
  console.log("\nDone — refresh /exams to see it");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
