// Populate Semester.studentCount with realistic per-department intake numbers.
// Pattern mirrors typical Indian engineering-college enrolment: CSE highest,
// CE/ME lowest, gentle attrition each year. All values land in [90, 350].

const mongoose = require("mongoose");
require("dotenv").config();

const Department = require("../modules/department/department.model");
const Semester = require("../modules/department/semester.model");

// Index 0 = Sem 1 … index 7 = Sem 8.
const INTAKE_BY_DEPT = {
  CSE: [245, 240, 232, 225, 215, 208, 195, 188],
  ISE: [185, 180, 175, 170, 165, 158, 152, 148],
  ECE: [180, 178, 172, 168, 162, 158, 150, 145],
  ME:  [125, 122, 118, 115, 108, 102, 98,  92],
  CE:  [110, 108, 102, 100, 98,  95,  92,  90],
};

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  const departments = await Department.find({ isActive: true });

  let updated = 0;
  console.log("\nUpdates:");
  for (const dept of departments) {
    const profile = INTAKE_BY_DEPT[dept.code];
    if (!profile) {
      console.log(`  ${dept.code.padEnd(4)} — no profile defined, skipping`);
      continue;
    }
    const semesters = await Semester.find({ department: dept._id }).sort({ name: 1 });
    for (const sem of semesters) {
      const idx = Number(sem.name) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx > 7) continue;
      const count = profile[idx];
      await Semester.findByIdAndUpdate(sem._id, { studentCount: count });
      console.log(`  ${dept.code.padEnd(4)} Sem ${sem.name}  → ${count}`);
      updated += 1;
    }
  }

  // Sanity check: min/max in DB after update.
  const all = await Semester.find({}).select("studentCount");
  const counts = all.map((s) => s.studentCount).filter((n) => n > 0);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const total = counts.reduce((a, b) => a + b, 0);

  console.log(`\nUpdated ${updated} semesters.`);
  console.log(
    `Range:  min=${min}  max=${max}  total students across all sems = ${total}`,
  );

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
