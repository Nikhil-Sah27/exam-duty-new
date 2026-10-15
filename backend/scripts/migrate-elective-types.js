// One-time migration for removing the professional/open elective distinction.
//   - Course.courseType: "professional_elective" | "open_elective" → "elective"
//   - Course.studentCount: removed (no per-elective student count)
//   - ElectiveGroup.type: removed (a group is just a name + subjects)
// Idempotent — safe to run more than once.

require("dotenv").config();
const mongoose = require("mongoose");

const Course = require("../modules/department/course.model");
const ElectiveGroup = require("../modules/department/electiveGroup.model");

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  const courseType = await Course.collection.updateMany(
    { courseType: { $in: ["professional_elective", "open_elective"] } },
    { $set: { courseType: "elective" } }
  );
  console.log(`Courses re-typed to "elective": ${courseType.modifiedCount}`);

  const studentCount = await Course.collection.updateMany(
    { studentCount: { $exists: true } },
    { $unset: { studentCount: "" } }
  );
  console.log(`Course.studentCount removed: ${studentCount.modifiedCount}`);

  const groupType = await ElectiveGroup.collection.updateMany(
    { type: { $exists: true } },
    { $unset: { type: "" } }
  );
  console.log(`ElectiveGroup.type removed: ${groupType.modifiedCount}`);

  await mongoose.disconnect();
  console.log("Done");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
