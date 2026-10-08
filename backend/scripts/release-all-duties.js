/**
 * One-shot maintenance script: cancel every assigned duty regardless of the
 * teacher's role, and reset every DCSGroup that still holds a claim.
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/release-all-duties.js
 *
 * Reads MONGO_URI from .env. Duties are marked cancelled (not deleted) so
 * history and audit trail are preserved.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const connectDB = require("../shared/config/db");
const Duty = require("../modules/duty/duty.model");
const DCSGroup = require("../modules/dcs/dcsGroup.model");

const REASON = "Bulk release via release-all-duties.js";

async function main() {
  await connectDB();
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("\n=== Release-all-duties sweep ===");

  // 1. Snapshot pre-state grouped by teacher role.
  const preSnapshot = await Duty.aggregate([
    { $match: { status: "assigned" } },
    {
      $lookup: {
        from: "users",
        localField: "teacher",
        foreignField: "_id",
        as: "t",
      },
    },
    { $unwind: { path: "$t", preserveNullAndEmptyArrays: true } },
    { $group: { _id: "$t.role", count: { $sum: 1 } } },
  ]);

  if (preSnapshot.length === 0) {
    console.log("No assigned duties to release.");
  } else {
    console.log("Assigned duties by role:");
    preSnapshot.forEach((r) => console.log(`  - ${r._id || "(no user)"}: ${r.count}`));
  }

  // 2. Cancel every assigned duty (all roles).
  const dutyRes = await Duty.updateMany(
    { status: "assigned" },
    {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: REASON,
    }
  );
  console.log(`\nDuties cancelled: ${dutyRes.modifiedCount}`);

  // 3. Reset every DCSGroup whose status is "claimed" or that still points
  //    at a teacher — mirrors the release-all-dcs.js semantics.
  const beforeGroups = await DCSGroup.find({
    $or: [{ status: "claimed" }, { assignedTeacher: { $ne: null } }],
  }).select("_id groupIndex status assignedTeacher");

  if (beforeGroups.length === 0) {
    console.log("No DCS groups needed resetting.");
  } else {
    console.log(`\nDCS groups to reset: ${beforeGroups.length}`);
    beforeGroups.forEach((g) =>
      console.log(
        `  - ${g._id}  groupIndex=${g.groupIndex}  status=${g.status}  ` +
          `assignedTeacher=${g.assignedTeacher || "—"}`
      )
    );
  }

  const groupRes = await DCSGroup.updateMany(
    { $or: [{ status: "claimed" }, { assignedTeacher: { $ne: null } }] },
    { $set: { assignedTeacher: null, status: "open", duties: [] } }
  );
  console.log(`DCS groups reset: ${groupRes.modifiedCount}`);

  // 4. Sanity check.
  const stillAssigned = await Duty.countDocuments({ status: "assigned" });
  const stillClaimed = await DCSGroup.countDocuments({
    $or: [{ status: "claimed" }, { assignedTeacher: { $ne: null } }],
  });
  console.log(
    `\nPost-state — assigned duties: ${stillAssigned}, claimed DCS groups: ${stillClaimed}`
  );

  await mongoose.disconnect();
  console.log("Done.\n");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
