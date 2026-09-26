// For every semester, ensure a single "Electives" ElectiveGroup exists and
// attach any ungrouped elective course to it. Idempotent.
//
// Elective groups no longer carry a professional/open type — a group is just a
// name with its subjects.

require("dotenv").config();
const mongoose = require("mongoose");

const Department = require("../modules/department/department.model");
const Semester = require("../modules/department/semester.model");
const Course = require("../modules/department/course.model");
const ElectiveGroup = require("../modules/department/electiveGroup.model");

const GROUP_NAME = "Electives";

const ensureGroup = async (semesterId) => {
  let group = await ElectiveGroup.findOne({ semester: semesterId, name: GROUP_NAME });
  if (!group) {
    group = await ElectiveGroup.create({ name: GROUP_NAME, semester: semesterId });
    return { group, created: true };
  }
  return { group, created: false };
};

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const departments = await Department.find({});
  let groupsCreated = 0;
  let coursesAttached = 0;

  for (const dept of departments) {
    const semesters = await Semester.find({ department: dept._id }).sort({ name: 1 });
    for (const sem of semesters) {
      const { group, created } = await ensureGroup(sem._id);
      if (created) groupsCreated++;

      // Attach every ungrouped elective course to the single group.
      const res = await Course.updateMany(
        { semester: sem._id, courseType: "elective", electiveGroup: null },
        { $set: { electiveGroup: group._id } }
      );
      coursesAttached += res.modifiedCount;

      console.log(
        `  [${dept.code} sem ${sem.name}] group ${created ? "created" : "exists"} (attached ${res.modifiedCount})`
      );
    }
  }

  console.log(`\nGroups created: ${groupsCreated}, Courses attached: ${coursesAttached}`);

  console.log("\nVerification:");
  for (const dept of departments) {
    const semesters = await Semester.find({ department: dept._id }).sort({ name: 1 });
    for (const sem of semesters) {
      const groups = await ElectiveGroup.find({ semester: sem._id });
      const withGroupCounts = await Promise.all(
        groups.map(async (g) => ({
          name: g.name,
          count: await Course.countDocuments({ semester: sem._id, electiveGroup: g._id }),
        }))
      );
      const desc = withGroupCounts.map((g) => `${g.name}=${g.count}`).join(", ");
      console.log(`  ${dept.code.padEnd(4)} sem ${sem.name}: ${desc}`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
