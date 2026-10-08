/**
 * Backfill DCSGroup rows for every existing active ExamGroup. Run once after
 * deploying the DCS module so already-created exams gain DCS slots without
 * needing to be re-created. Idempotent: skips ExamGroups that already have
 * any DCSGroup row (preserves any claims that may exist).
 *
 *   node scripts/backfill-dcs-groups.js
 *   node scripts/backfill-dcs-groups.js --force   # delete + regenerate
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Register every schema the dcsGroup.service populate chain depends on. Bare
// scripts don't trigger Express boot, so without these requires you get a
// "Schema hasn't been registered for model 'Room'" mid-run.
require("../modules/auth/auth.model");
require("../modules/exam/exam.model");
require("../modules/exam/examSchedule.model");
require("../modules/exam/examRoom.model");
require("../modules/infrastructure/infrastructure.model"); // Room
require("../modules/infrastructure/building.model");
require("../modules/department/department.model");
require("../modules/department/semester.model");

const ExamGroup = require("../modules/exam/examGroup.model");
const DCSGroup = require("../modules/dcs/dcsGroup.model");
const dcsService = require("../modules/dcs/dcsGroup.service");

const FORCE = process.argv.includes("--force");

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB", FORCE ? "(force mode)" : "");

  const groups = await ExamGroup.find({ isActive: true });
  console.log(`Found ${groups.length} active ExamGroup(s)`);

  let generated = 0;
  let skipped = 0;
  for (const g of groups) {
    const existing = await DCSGroup.countDocuments({ examGroup: g._id });

    if (existing > 0 && !FORCE) {
      console.log(`  ${g.examType} Sem ${g.semester}  — ${existing} DCS group(s), skipping`);
      skipped += 1;
      continue;
    }

    if (existing > 0 && FORCE) {
      await DCSGroup.deleteMany({ examGroup: g._id });
      console.log(`  ${g.examType} Sem ${g.semester}  — wiped ${existing} existing DCS group(s)`);
    }

    const created = await dcsService.generateDCSGroupsForExamGroup(g._id);
    console.log(
      `  ${g.examType} Sem ${g.semester}  → ${created.length} DCS group(s)`,
    );
    generated += created.length;
  }

  console.log(
    `\nDone. Generated ${generated} DCS group(s), skipped ${skipped} ExamGroup(s).`,
  );
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
