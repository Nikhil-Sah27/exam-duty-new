// Adds at least 2 elective courses (1 professional + 1 open) to every
// (department, semester) pair. Idempotent — safe to run multiple times.
// Uses course codes {DEPT}{SEM}91 (professional) and {DEPT}{SEM}92 (open) to
// stay outside the core-course numbering (01-05 used by cores, 03/04 already
// used by sem-8 electives from seed-departments.js).

require("dotenv").config();
const mongoose = require("mongoose");

const Department = require("../modules/department/department.model");
const Semester = require("../modules/department/semester.model");
const Course = require("../modules/department/course.model");

const PROFESSIONAL_ELECTIVES = {
  CSE: [
    "Programming Foundations",
    "Discrete Structures Applications",
    "Advanced Data Structures",
    "Advanced Operating Systems",
    "NoSQL Databases",
    "Blockchain Technologies",
    "Deep Learning Systems",
    "Generative AI",
  ],
  ISE: [
    "Computational Thinking",
    "Data Wrangling",
    "Advanced Java Programming",
    "Distributed Systems",
    "Data Mining",
    "Reinforcement Learning",
    "Natural Language Processing",
    "MLOps",
  ],
  ECE: [
    "Circuit Fundamentals",
    "Signal Processing Basics",
    "Analog Communication",
    "Digital Communication",
    "VLSI Design",
    "Antenna Theory",
    "Wireless Networks",
    "RF Circuit Design",
  ],
  ME: [
    "Workshop Practices",
    "Material Science",
    "Fluid Mechanics",
    "Thermal Engineering",
    "CAD/CAM Systems",
    "Automotive Engineering",
    "Industrial Robotics",
    "Advanced Robotics",
  ],
  CE: [
    "Surveying Fundamentals",
    "Building Materials",
    "Structural Analysis",
    "Geotechnical Engineering",
    "Transportation Engineering",
    "Environmental Engineering",
    "Bridge Engineering",
    "Pre-stressed Concrete",
  ],
};

const OPEN_ELECTIVES = [
  "Digital Literacy",
  "Environmental Studies",
  "Ethics in Technology",
  "Design Thinking",
  "Entrepreneurship",
  "Financial Literacy",
  "Sustainable Development",
  "Human Computer Interaction",
];

const upsertElective = async ({ dept, sem, code, name, courseType, credits }) => {
  const existing = await Course.findOne({ semester: sem._id, code });
  if (existing) {
    return { code, action: "skipped" };
  }
  await Course.create({
    name,
    code,
    credits,
    semester: sem._id,
    courseType,
  });
  return { code, action: "created" };
};

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const departments = await Department.find({});
  let createdCount = 0;
  let skippedCount = 0;

  for (const dept of departments) {
    const semesters = await Semester.find({ department: dept._id }).sort({ name: 1 });
    for (const sem of semesters) {
      const semNumber = parseInt(sem.name, 10);
      const profName = `Professional Elective – ${PROFESSIONAL_ELECTIVES[dept.code][semNumber - 1]}`;
      const openName = `Open Elective – ${OPEN_ELECTIVES[semNumber - 1]}`;

      const results = await Promise.all([
        upsertElective({
          dept,
          sem,
          code: `${dept.code}${semNumber}91`,
          name: profName,
          courseType: "elective",
          credits: 3,
        }),
        upsertElective({
          dept,
          sem,
          code: `${dept.code}${semNumber}92`,
          name: openName,
          courseType: "elective",
          credits: 3,
        }),
      ]);

      for (const r of results) {
        if (r.action === "created") createdCount++;
        else skippedCount++;
        console.log(`  [${dept.code} sem ${sem.name}] ${r.code} — ${r.action}`);
      }
    }
  }

  console.log(`\nCreated: ${createdCount}, Skipped (already existed): ${skippedCount}`);

  console.log("\nVerification — elective counts per (dept, sem):");
  for (const dept of departments) {
    const semesters = await Semester.find({ department: dept._id }).sort({ name: 1 });
    for (const sem of semesters) {
      const count = await Course.countDocuments({
        semester: sem._id,
        courseType: "elective",
      });
      const flag = count >= 2 ? "OK" : "MISSING";
      console.log(`  ${dept.code.padEnd(4)} sem ${sem.name}: ${count} electives [${flag}]`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
