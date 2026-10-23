/**
 * Read-only dump of every teacher's computed duty row (role, designation,
 * target, assigned, completed, reached) — exactly what the CS cohort analytics
 * endpoint returns. Lets us confirm target/assigned reflect each teacher's role
 * AND designation (70/30 splits, group vs room counts).
 *
 *   node scripts/verify-teacher-targets.js
 *   COLLEGE=<code> node scripts/verify-teacher-targets.js
 */
require("dotenv").config();

const mongoose = require("mongoose");
const svc = require("../modules/duty-calculation/dutyCalculation.service");

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
const padL = (s, n) => String(s ?? "").padStart(n);

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log(`\nCollege: ${college?.name || "(unknown)"}\n`);

  // No role filter -> each teacher is measured against every duty role they
  // actually hold (one row per role), the same as the cohort analytics page.
  const { teachers } = await svc.calculateAllTeachersProgress();

  // Sort for readability: role, then designation, then name.
  const ROLE_ORDER = { invigilator: 0, rs: 1, dcs: 2 };
  teachers.sort(
    (a, b) =>
      (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) ||
      String(a.designation).localeCompare(String(b.designation)) ||
      String(a.name).localeCompare(String(b.name))
  );

  console.log(
    pad("NAME", 22) + pad("DESIGNATION", 20) + pad("ROLE", 12) +
      padL("TARGET", 7) + padL("ASSIGN", 7) + padL("DONE", 6) + "  REACHED"
  );
  console.log("-".repeat(82));

  // Per (role, designation) tallies so the splits are easy to eyeball.
  const buckets = new Map();
  for (const t of teachers) {
    console.log(
      pad(t.name, 22) + pad(t.designation, 20) + pad(t.role, 12) +
        padL(t.target, 7) + padL(t.assigned, 7) + padL(t.completed, 6) +
        (t.reached ? "   YES" : "")
    );
    const key = `${t.role} / ${t.designation}`;
    const b = buckets.get(key) || { n: 0, target: null, assignedSum: 0 };
    b.n += 1;
    b.target = t.target; // same within a (role,designation) bucket by design
    b.assignedSum += t.assigned;
    buckets.set(key, b);
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY — target per (role, designation)");
  console.log("=".repeat(60));
  for (const [key, b] of [...buckets.entries()].sort()) {
    console.log(
      `  ${pad(key, 34)} count=${padL(b.n, 3)}  target=${padL(b.target, 4)}  ` +
        `totalAssigned=${padL(b.assignedSum, 4)}`
    );
  }
  console.log("");

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
