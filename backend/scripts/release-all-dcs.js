/**
 * One-shot maintenance script: release every duty currently held by any DCS
 * user. Cancels matching Duty docs and resets any DCSGroup that still points
 * at a DCS as `assignedTeacher`. Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/release-all-dcs.js
 *
 * Operates against the same MongoDB connection the server uses (reads
 * MONGO_URI from .env). Does NOT mutate any non-DCS duties.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const connectDB = require("../shared/config/db");
const User = require("../modules/auth/auth.model");
const Duty = require("../modules/duty/duty.model");
const DCSGroup = require("../modules/dcs/dcsGroup.model");

const REASON = "Manual bulk release via release-all-dcs.js";

async function main() {
  await connectDB();
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("\n=== DCS release sweep ===");

  // 1. Find every DCS user (active + inactive both — defensive).
  const dcsUsers = await User.find({ roles: "dcs" })
    .setOptions({ getFilter: () => ({}) }) // bypass the soft-delete pre-find
    .select("_id name email");

  if (dcsUsers.length === 0) {
    console.log("No DCS users found. Nothing to do.");
    await mongoose.disconnect();
    return;
  }
  console.log(`DCS users: ${dcsUsers.length}`);
  dcsUsers.forEach((u) => console.log(`  - ${u.name} (${u._id})`));

  const dcsUserIds = dcsUsers.map((u) => u._id);

  // 2. Cancel every assigned duty owned by any DCS user.
  const dutyRes = await Duty.updateMany(
    { teacher: { $in: dcsUserIds }, status: "assigned" },
    {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: REASON,
    },
  );
  console.log(`\nDuties cancelled: ${dutyRes.modifiedCount}`);

  // 3. Reset every DCSGroup that still references a DCS user as assignedTeacher
  //    OR whose status is "claimed" — covers groups with stale assignedTeacher
  //    refs OR claimed status without a teacher.
  const beforeGroups = await DCSGroup.find({
    $or: [
      { assignedTeacher: { $in: dcsUserIds } },
      { status: "claimed" },
    ],
  }).select("_id groupIndex status assignedTeacher schedule");

  if (beforeGroups.length === 0) {
    console.log("No DCS groups needed resetting.");
  } else {
    console.log(`\nDCS groups to reset: ${beforeGroups.length}`);
    beforeGroups.forEach((g) =>
      console.log(
        `  - ${g._id}  groupIndex=${g.groupIndex}  status=${g.status}  ` +
          `assignedTeacher=${g.assignedTeacher || "—"}`,
      ),
    );
  }

  const groupRes = await DCSGroup.updateMany(
    {
      $or: [
        { assignedTeacher: { $in: dcsUserIds } },
        { status: "claimed" },
      ],
    },
    {
      $set: { assignedTeacher: null, status: "open", duties: [] },
    },
  );
  console.log(`DCS groups reset: ${groupRes.modifiedCount}`);

  // 4. Final sanity check: any stragglers?
  const stillClaimed = await DCSGroup.countDocuments({
    $or: [
      { assignedTeacher: { $in: dcsUserIds } },
      { status: "claimed" },
    ],
  });
  const stillAssigned = await Duty.countDocuments({
    teacher: { $in: dcsUserIds },
    status: "assigned",
  });
  console.log(
    `\nPost-state — claimed DCS groups: ${stillClaimed}, assigned DCS duties: ${stillAssigned}`,
  );

  await mongoose.disconnect();
  console.log("Done.\n");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
