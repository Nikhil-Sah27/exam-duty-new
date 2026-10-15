// Seed engineering-college academic structure:
//   5 departments × 8 semesters × ~5 courses each.
// Idempotent-friendly: assumes Department / Semester / Course collections are
// empty (run after a wipe). Run with `node backend/scripts/seed-departments.js`.

const mongoose = require("mongoose");
require("dotenv").config();

const Department = require("../modules/department/department.model");
const Semester = require("../modules/department/semester.model");
const Course = require("../modules/department/course.model");

const DEPARTMENTS = [
  { name: "Computer Science and Engineering", code: "CSE" },
  { name: "Information Science and Engineering", code: "ISE" },
  { name: "Electronics and Communication Engineering", code: "ECE" },
  { name: "Mechanical Engineering", code: "ME" },
  { name: "Civil Engineering", code: "CE" },
];

// Sem 1 + Sem 2 share the same first-year foundation across every department.
const FOUNDATION_SEM1 = [
  { name: "Engineering Mathematics I", credits: 4 },
  { name: "Engineering Physics", credits: 4 },
  { name: "Programming in C", credits: 3 },
  { name: "Engineering Graphics", credits: 3 },
  { name: "Communicative English", credits: 2 },
];
const FOUNDATION_SEM2 = [
  { name: "Engineering Mathematics II", credits: 4 },
  { name: "Engineering Chemistry", credits: 4 },
  { name: "Basic Electrical Engineering", credits: 3 },
  { name: "Engineering Mechanics", credits: 3 },
  { name: "Indian Constitution and Professional Ethics", credits: 2 },
];

// Per-department, per-semester course lists for sems 3–8.
const COURSES = {
  CSE: {
    3: [
      { name: "Discrete Mathematical Structures", credits: 4 },
      { name: "Data Structures and Applications", credits: 4 },
      { name: "Computer Organization and Architecture", credits: 3 },
      { name: "Object-Oriented Programming with Java", credits: 4 },
      { name: "Analog and Digital Electronics", credits: 3 },
    ],
    4: [
      { name: "Design and Analysis of Algorithms", credits: 4 },
      { name: "Operating Systems", credits: 4 },
      { name: "Microcontrollers and Embedded Systems", credits: 3 },
      { name: "Software Engineering", credits: 3 },
      { name: "Theory of Computation", credits: 3 },
    ],
    5: [
      { name: "Database Management Systems", credits: 4 },
      { name: "Computer Networks", credits: 4 },
      { name: "Automata Theory and Compiler Design", credits: 3 },
      { name: "Web Technology", credits: 3 },
      { name: "Research Methodology", credits: 2 },
    ],
    6: [
      { name: "Cryptography and Network Security", credits: 4 },
      { name: "Cloud Computing", credits: 3 },
      { name: "Machine Learning", credits: 4 },
      { name: "Compiler Design", credits: 3 },
      { name: "Mobile Application Development", credits: 3 },
    ],
    7: [
      { name: "Big Data Analytics", credits: 4 },
      { name: "Artificial Intelligence", credits: 4 },
      { name: "Internet of Things", credits: 3 },
      { name: "Cyber Security", credits: 3 },
      { name: "Project Phase 1", credits: 2 },
    ],
    8: [
      { name: "Project Work", credits: 8 },
      { name: "Internship", credits: 4 },
      { name: "Professional Elective – Deep Learning", credits: 3 },
      { name: "Open Elective – Human Computer Interaction", credits: 3 },
    ],
  },
  ISE: {
    3: [
      { name: "Discrete Mathematics", credits: 4 },
      { name: "Data Structures with Java", credits: 4 },
      { name: "Logic Design and Computer Organization", credits: 3 },
      { name: "Object-Oriented Programming with Java", credits: 4 },
      { name: "Database Concepts", credits: 3 },
    ],
    4: [
      { name: "Design and Analysis of Algorithms", credits: 4 },
      { name: "Operating Systems", credits: 4 },
      { name: "Software Engineering", credits: 3 },
      { name: "Microprocessors and Microcontrollers", credits: 3 },
      { name: "Web Programming", credits: 3 },
    ],
    5: [
      { name: "Database Management Systems", credits: 4 },
      { name: "Computer Networks", credits: 4 },
      { name: "Theory of Computation", credits: 3 },
      { name: "Software Testing", credits: 3 },
      { name: "Research Methodology", credits: 2 },
    ],
    6: [
      { name: "Information Security", credits: 4 },
      { name: "Cloud Computing", credits: 3 },
      { name: "Machine Learning", credits: 4 },
      { name: "Compiler Design", credits: 3 },
      { name: "Storage Area Networks", credits: 3 },
    ],
    7: [
      { name: "Data Mining and Warehousing", credits: 4 },
      { name: "Artificial Intelligence", credits: 4 },
      { name: "Internet of Things", credits: 3 },
      { name: "Blockchain Technology", credits: 3 },
      { name: "Project Phase 1", credits: 2 },
    ],
    8: [
      { name: "Project Work", credits: 8 },
      { name: "Internship", credits: 4 },
      { name: "Professional Elective – NLP", credits: 3 },
      { name: "Open Elective – Operations Research", credits: 3 },
    ],
  },
  ECE: {
    3: [
      { name: "Network Analysis", credits: 4 },
      { name: "Electronic Devices and Circuits", credits: 4 },
      { name: "Digital System Design", credits: 3 },
      { name: "Engineering Electromagnetics", credits: 3 },
      { name: "Engineering Statistics and Linear Algebra", credits: 3 },
    ],
    4: [
      { name: "Analog Electronic Circuits", credits: 4 },
      { name: "Signals and Systems", credits: 4 },
      { name: "Microcontrollers", credits: 3 },
      { name: "Communication Theory", credits: 3 },
      { name: "Engineering Mathematics IV", credits: 3 },
    ],
    5: [
      { name: "Digital Signal Processing", credits: 4 },
      { name: "Information Theory and Coding", credits: 3 },
      { name: "Antennas and Propagation", credits: 3 },
      { name: "Embedded Systems", credits: 4 },
      { name: "Power Electronics", credits: 3 },
    ],
    6: [
      { name: "VLSI Design", credits: 4 },
      { name: "Computer Communication Networks", credits: 3 },
      { name: "Microwave Engineering", credits: 3 },
      { name: "Optical Communication", credits: 3 },
      { name: "Wireless Communication", credits: 3 },
    ],
    7: [
      { name: "Satellite Communication", credits: 4 },
      { name: "Radar Engineering", credits: 3 },
      { name: "Artificial Neural Networks", credits: 3 },
      { name: "Cellular Mobile Communication", credits: 3 },
      { name: "Project Phase 1", credits: 2 },
    ],
    8: [
      { name: "Project Work", credits: 8 },
      { name: "Internship", credits: 4 },
      { name: "Professional Elective – RF Circuit Design", credits: 3 },
      { name: "Open Elective – Sensor Technology", credits: 3 },
    ],
  },
  ME: {
    3: [
      { name: "Mechanics of Materials", credits: 4 },
      { name: "Material Science and Engineering", credits: 3 },
      { name: "Basic Thermodynamics", credits: 4 },
      { name: "Manufacturing Process", credits: 3 },
      { name: "Engineering Mathematics III", credits: 3 },
    ],
    4: [
      { name: "Applied Thermodynamics", credits: 4 },
      { name: "Fluid Mechanics", credits: 4 },
      { name: "Theory of Machines", credits: 3 },
      { name: "Machining Science", credits: 3 },
      { name: "Metal Casting and Welding", credits: 3 },
    ],
    5: [
      { name: "Design of Machine Elements I", credits: 4 },
      { name: "Dynamics of Machinery", credits: 3 },
      { name: "Turbomachines", credits: 3 },
      { name: "Computer Aided Design and Manufacturing", credits: 3 },
      { name: "Heat Transfer", credits: 4 },
    ],
    6: [
      { name: "Finite Element Methods", credits: 4 },
      { name: "Control Engineering", credits: 3 },
      { name: "Hydraulic Machines", credits: 3 },
      { name: "Automobile Engineering", credits: 3 },
      { name: "Industrial Engineering and Management", credits: 3 },
    ],
    7: [
      { name: "Refrigeration and Air Conditioning", credits: 4 },
      { name: "Mechatronics", credits: 3 },
      { name: "Operations Research", credits: 3 },
      { name: "Energy Engineering", credits: 3 },
      { name: "Project Phase 1", credits: 2 },
    ],
    8: [
      { name: "Project Work", credits: 8 },
      { name: "Internship", credits: 4 },
      { name: "Professional Elective – Robotics", credits: 3 },
      { name: "Open Elective – Renewable Energy Systems", credits: 3 },
    ],
  },
  CE: {
    3: [
      { name: "Strength of Materials", credits: 4 },
      { name: "Engineering Geology", credits: 3 },
      { name: "Building Materials and Construction", credits: 3 },
      { name: "Fluid Mechanics", credits: 4 },
      { name: "Surveying", credits: 3 },
    ],
    4: [
      { name: "Analysis of Structures", credits: 4 },
      { name: "Concrete Technology", credits: 3 },
      { name: "Highway Engineering", credits: 3 },
      { name: "Hydraulics and Hydraulic Machines", credits: 4 },
      { name: "Construction Management and Entrepreneurship", credits: 3 },
    ],
    5: [
      { name: "Design of RCC Structures", credits: 4 },
      { name: "Geotechnical Engineering I", credits: 4 },
      { name: "Transportation Engineering", credits: 3 },
      { name: "Water Supply Engineering", credits: 3 },
      { name: "Hydrology and Irrigation Engineering", credits: 3 },
    ],
    6: [
      { name: "Design of Steel Structures", credits: 4 },
      { name: "Geotechnical Engineering II", credits: 4 },
      { name: "Environmental Engineering", credits: 3 },
      { name: "Estimation and Costing", credits: 3 },
      { name: "Urban Planning and Architecture", credits: 3 },
    ],
    7: [
      { name: "Earthquake Resistant Structures", credits: 4 },
      { name: "Pavement Design", credits: 3 },
      { name: "Bridge Engineering", credits: 3 },
      { name: "Construction Equipment and Techniques", credits: 3 },
      { name: "Project Phase 1", credits: 2 },
    ],
    8: [
      { name: "Project Work", credits: 8 },
      { name: "Internship", credits: 4 },
      { name: "Professional Elective – Pre-stressed Concrete", credits: 3 },
      { name: "Open Elective – Disaster Management", credits: 3 },
    ],
  },
};

const courseCode = (deptCode, sem, idx) =>
  `${deptCode}${sem}${(idx + 1).toString().padStart(2, "0")}`;

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  // 1. Departments
  const departments = await Department.insertMany(DEPARTMENTS);
  console.log(`Inserted ${departments.length} departments`);

  // 2. Semesters (1–8 per department)
  const semesterDocs = [];
  for (const dept of departments) {
    for (let i = 1; i <= 8; i++) {
      semesterDocs.push({ name: String(i), department: dept._id });
    }
  }
  const semesters = await Semester.insertMany(semesterDocs);
  console.log(`Inserted ${semesters.length} semesters`);

  // 3. Courses
  const semesterIndex = new Map();
  for (const s of semesters) {
    semesterIndex.set(`${s.department.toString()}:${s.name}`, s);
  }

  const courseDocs = [];
  for (const dept of departments) {
    const sem1 = semesterIndex.get(`${dept._id}:1`);
    const sem2 = semesterIndex.get(`${dept._id}:2`);

    FOUNDATION_SEM1.forEach((c, idx) => {
      courseDocs.push({
        name: c.name,
        code: courseCode(dept.code, 1, idx),
        credits: c.credits,
        semester: sem1._id,
        courseType: "core",
      });
    });
    FOUNDATION_SEM2.forEach((c, idx) => {
      courseDocs.push({
        name: c.name,
        code: courseCode(dept.code, 2, idx),
        credits: c.credits,
        semester: sem2._id,
        courseType: "core",
      });
    });

    for (let sem = 3; sem <= 8; sem++) {
      const semDoc = semesterIndex.get(`${dept._id}:${sem}`);
      const subjects = COURSES[dept.code][sem];
      subjects.forEach((c, idx) => {
        // Sem 8: name-based elective tagging (core vs elective; no sub-type)
        const isElective =
          c.name.startsWith("Professional Elective") ||
          c.name.startsWith("Open Elective");
        const courseType = isElective ? "elective" : "core";
        courseDocs.push({
          name: c.name,
          code: courseCode(dept.code, sem, idx),
          credits: c.credits,
          semester: semDoc._id,
          courseType,
        });
      });
    }
  }
  const courses = await Course.insertMany(courseDocs);
  console.log(`Inserted ${courses.length} courses`);

  // Summary
  console.log("\nSummary:");
  for (const dept of departments) {
    const semCount = semesters.filter(
      (s) => s.department.toString() === dept._id.toString(),
    ).length;
    const semIds = semesters
      .filter((s) => s.department.toString() === dept._id.toString())
      .map((s) => s._id.toString());
    const courseCount = courses.filter((c) =>
      semIds.includes(c.semester.toString()),
    ).length;
    console.log(
      `  ${dept.code.padEnd(4)} ${dept.name.padEnd(45)} sems=${semCount} courses=${courseCount}`,
    );
  }

  await mongoose.disconnect();
  console.log("\nDone");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
