/**
 * One-time migration: Assistant Professors are no longer allowed the RS role.
 *
 * For every user with designation "Assistant Professor":
 *   1. ensure "invigilator" is present (schema requires >= 1 role)
 *   2. remove "rs" from their roles
 *
 * Step order guarantees no record is ever left with an empty roles array.
 * Runs against the raw collection so soft-deleted (isActive:false) users are
 * migrated too.
 *
 * Run: node scripts/strip-rs-from-assistant-professors.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/exam-duty";
const DESIGNATION = "Assistant Professor";

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const usersCollection = mongoose.connection.db.collection("users");

  const before = await usersCollection.countDocuments({
    designation: DESIGNATION,
    roles: "rs",
  });
  console.log(`Assistant Professors with rs role before: ${before}`);

  // 1. Make sure everyone keeps invigilator (never end up with empty roles).
  await usersCollection.updateMany(
    { designation: DESIGNATION },
    { $addToSet: { roles: "invigilator" } }
  );

  // 2. Remove rs.
  const pulled = await usersCollection.updateMany(
    { designation: DESIGNATION },
    { $pull: { roles: "rs" } }
  );
  console.log(`Records updated (rs pulled): ${pulled.modifiedCount}`);

  const remaining = await usersCollection.countDocuments({
    designation: DESIGNATION,
    roles: "rs",
  });
  if (remaining === 0) {
    console.log("Done — no Assistant Professor has the rs role anymore.");
  } else {
    console.error(`WARNING: ${remaining} Assistant Professors still have rs!`);
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
