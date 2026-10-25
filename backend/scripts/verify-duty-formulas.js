/**
 * Read-only sanity check of the duty-target formulas (invigilator / RS / DCS).
 * Mutates nothing — just recomputes every layer from current DB state and
 * prints the numbers so the three specs can be eyeballed end to end.
 *
 *   node scripts/verify-duty-formulas.js            # Main college
 *   COLLEGE=<code> node scripts/verify-duty-formulas.js
 *
 * Formulas printed:
 *   Invigilator semester = ceil((courses x students x examTypes) / avgRoomCap)
 *   DCS         real DCS groups for semesters whose SEE exists; for the rest,
 *               semester = courses x examTypes x ceil(students / 300)
 *   Total RS             = round(total invigilator duties / 5)
 *   Per-teacher split: base designation = x, secondary = 0.7x (30% less)
 *     invigilator -> Assistant Prof (x) / Associate Prof (0.7x)
 *     RS          -> Professor (x)      / Associate Prof (0.7x)
 *     DCS         -> HOD/Dean (flat, single designation)
 */
require("dotenv").config();

const mongoose = require("mongoose");
const svc = require("../modules/duty-calculation/dutyCalculation.service");

const money = (n) => (Math.round(n * 100) / 100).toString();

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log(`\nCollege: ${college?.name || "(unknown)"}\n`);

  // ---- Institution walk (shared by invigilator + DCS) ----
  const institution = await svc.calculateInstitutionDuty();
  console.log("=".repeat(64));
  console.log("INVIGILATOR — per-semester / per-department / institution");
  console.log("=".repeat(64));
  console.log(`avg classroom capacity: ${money(institution.avgClassroomCapacity)}`);
  for (const dept of institution.departments) {
    console.log(`\n  ${dept.code} — ${dept.name}: ${dept.total} duties`);
    for (const s of dept.semesters) {
      const b = s.breakdown;
      console.log(
        `    Sem ${s.semesterName}: courses=${b.courses} students=${b.students} ` +
          `examTypes=${b.examTypes} -> ${s.duties}  ` +
          `[${b.courses}x${b.examTypes}xceil(${b.students}/${money(b.avgClassroomCapacity)})]`
      );
    }
  }
  console.log(`\n  INSTITUTION INVIGILATOR TOTAL: ${institution.total}`);

  // ---- Invigilator per-teacher split ----
  const perInv = await svc.calculateDutyPerInvigilator({ institution });
  console.log(
    `\n  Eligible: ${perInv.assistantCount} Assistant + ${perInv.associateCount} Associate ` +
      `= ${perInv.eligibleTeachers} teachers`
  );
  console.log(
    `  Split -> Assistant (x) = ${perInv.assistantBase}, ` +
      `Associate (0.7x) = ${perInv.associateBase}` +
      (perInv.assistantBase
        ? `  (ratio ${money(perInv.associateBase / perInv.assistantBase)})`
        : "")
  );

  // ---- RS ----
  const perRs = await svc.calculateRsDutyPerTeacher({ institution });
  console.log("\n" + "=".repeat(64));
  console.log("RS — total = invigilator total / 5, Professor(x)/Associate(0.7x)");
  console.log("=".repeat(64));
  console.log(
    `  Total RS = round(${institution.total} / 5) = ${perRs.totalDuties}`
  );
  console.log(
    `  Eligible: ${perRs.professorCount} Professor + ${perRs.associateCount} Associate ` +
      `= ${perRs.eligibleTeachers} teachers`
  );
  console.log(
    `  Split -> Professor (x) = ${perRs.professorBase}, ` +
      `Associate (0.7x) = ${perRs.associateBase}` +
      (perRs.professorBase
        ? `  (ratio ${money(perRs.associateBase / perRs.professorBase)})`
        : "")
  );

  // ---- DCS ----
  const dcsInst = await svc.calculateDcsInstitutionDuty({ institution });
  const perDcs = await svc.calculateDcsDutyPerTeacher({ dcsInstitution: dcsInst });
  console.log("\n" + "=".repeat(64));
  console.log("DCS — real DCS groups for created SEE exams + estimate for the rest");
  console.log("      estimate per semester = courses x examTypes x ceil(students/300)");
  console.log("=".repeat(64));
  for (const dept of institution.departments) {
    const parts = [];
    for (const s of dept.semesters) {
      const b = s.breakdown;
      if (b.courses > 0 && b.students > 0 && b.examTypes > 0) {
        parts.push(b.courses * b.examTypes * Math.ceil(b.students / 300));
      }
    }
    if (parts.length) {
      console.log(
        `  ${dept.code}: ${parts.join(" + ")} = ${parts.reduce((a, c) => a + c, 0)}`
      );
    }
  }
  console.log("  (per-department estimates above; semesters with a created SEE use the real count)");
  console.log(
    `\n  INSTITUTION DCS TOTAL: ${dcsInst.scheduled} real + ${dcsInst.estimated} estimated = ${dcsInst.total}`
  );
  console.log(
    `  Eligible HOD/Dean: ${perDcs.eligibleTeachers} -> ` +
      `per-DCS = round(${dcsInst.total} / ${perDcs.eligibleTeachers}) = ${perDcs.target}`
  );

  console.log("");
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
