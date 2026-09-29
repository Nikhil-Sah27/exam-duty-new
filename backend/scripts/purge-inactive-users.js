/**
 * Permanently delete all soft-deleted (deactivated) users.
 *
 * Deactivating a teacher only sets `isActive: false` — the record stays in the
 * database. This one-off maintenance script removes those records for good.
 *
 * Safety: a deactivated teacher that still has non-cancelled duties or a claimed
 * DCS group is SKIPPED (deleting them would orphan a live assignment). Reassign
 * or clean up their exam first, then re-run.
 *
 *   node backend/scripts/purge-inactive-users.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/exam-duty";
  await mongoose.connect(uri);
  const db = mongoose.connection;

  const Users = db.collection("users");
  const Duties = db.collection("duties");
  const Groups = db.collection("dcsgroups");

  const inactive = await Users.find({ isActive: false })
    .project({ _id: 1, name: 1, email: 1 })
    .toArray();

  console.log(`Found ${inactive.length} deactivated user(s).`);

  const deleted = [];
  const skipped = [];
  for (const u of inactive) {
    const liveDuties = await Duties.countDocuments({
      teacher: u._id,
      status: { $ne: "cancelled" },
    });
    const liveGroups = await Groups.countDocuments({
      assignedTeacher: u._id,
      status: "claimed",
    });
    if (liveDuties > 0 || liveGroups > 0) {
      skipped.push({ email: u.email, liveDuties, liveGroups });
      continue;
    }
    // Remove the user and any leftover cancelled duty records.
    await Duties.deleteMany({ teacher: u._id });
    await Users.deleteOne({ _id: u._id });
    deleted.push(u.email);
  }

  console.log(`\nDeleted ${deleted.length}:`);
  deleted.forEach((e) => console.log(`  - ${e}`));
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} (still hold live duties/groups):`);
    skipped.forEach((s) =>
      console.log(`  - ${s.email} (duties: ${s.liveDuties}, groups: ${s.liveGroups})`),
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
