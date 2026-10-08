/**
 * Is the one-live-duty-per-slot guarantee actually live on this database?
 * (REALTIME_PLAN.md §2.3)
 *
 * The Duty model declares a partial unique index on { examRoom, role } for
 * assigned duties. Mongoose builds it at server boot — but if the database
 * already holds two live duties on the same slot (a race from before the
 * index existed), the build fails with only a log line and concurrent claims
 * stay unprotected. This script tells you which case you are in.
 *
 * Usage:
 *   node scripts/check-duplicate-duties.js                # read-only report
 *   node scripts/check-duplicate-duties.js --build-index  # also build the index (only when clean)
 *
 * Reads MONGO_URI from .env. Exits 1 while duplicates exist or the index is
 * missing. It never changes a duty: resolve duplicates through the app (CS →
 * Manage Duties → Unassign), which notifies the teacher who is taken off.
 */
require("dotenv").config();
const mongoose = require("mongoose");

// Report-only by default: don't let connecting trigger the index build itself.
mongoose.set("autoIndex", false);

const connectDB = require("../shared/config/db");
const Duty = require("../modules/duty/duty.model");
require("../modules/auth/auth.model");

const INDEX_NAME = "one_live_duty_per_slot";

async function main() {
  const buildIndex = process.argv.includes("--build-index");
  await connectDB();
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("\n=== One live duty per slot ===");

  const duplicates = await Duty.aggregate([
    { $match: { status: "assigned", examRoom: { $type: "objectId" } } },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: { examRoom: "$examRoom", role: "$role" },
        duties: {
          $push: {
            id: "$_id",
            teacher: "$teacher",
            room: "$room",
            date: "$date",
            startTime: "$startTime",
            createdAt: "$createdAt",
          },
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (duplicates.length === 0) {
    console.log("Duplicates: none — every slot has at most one live duty.");
  } else {
    const teacherIds = duplicates.flatMap((d) => d.duties.map((x) => x.teacher));
    const users = await mongoose
      .model("User")
      // An explicit isActive filter bypasses the soft-delete hook.
      .find({ _id: { $in: teacherIds }, isActive: { $in: [true, false] } })
      .select("name email");
    const nameOf = new Map(users.map((u) => [String(u._id), `${u.name} <${u.email}>`]));

    console.log(`Duplicates: ${duplicates.length} slot(s) held by more than one teacher.\n`);
    for (const slot of duplicates) {
      const first = slot.duties[0];
      const day = first.date ? new Date(first.date).toISOString().slice(0, 10) : "?";
      console.log(`  ${slot._id.role.toUpperCase()} · room ${first.room || "?"} · ${day} ${first.startTime || ""}`);
      for (const d of slot.duties) {
        const who = nameOf.get(String(d.teacher)) || String(d.teacher);
        console.log(`    duty ${d.id}  ${who}  (claimed ${new Date(d.createdAt).toISOString()})`);
      }
    }
    console.log("\nKeep one teacher per slot via CS → Manage Duties → Unassign, then re-run.");
  }

  const indexes = await Duty.collection.indexes();
  let hasIndex = indexes.some((ix) => ix.name === INDEX_NAME);

  if (!hasIndex && buildIndex) {
    if (duplicates.length > 0) {
      console.log("\nIndex: NOT built — it can't be while duplicates exist.");
    } else {
      await Duty.createIndexes();
      hasIndex = (await Duty.collection.indexes()).some((ix) => ix.name === INDEX_NAME);
      console.log(`\nIndex: ${hasIndex ? "built just now" : "build attempted but still missing"}.`);
    }
  } else {
    console.log(
      `\nIndex: ${hasIndex ? "present — concurrent claims are settled by Mongo" : "MISSING — concurrent claims are NOT protected"}.`
    );
    if (!hasIndex && duplicates.length === 0) {
      console.log("  Restart the backend or re-run with --build-index to create it.");
    }
  }

  await mongoose.disconnect();
  process.exit(duplicates.length === 0 && hasIndex ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
