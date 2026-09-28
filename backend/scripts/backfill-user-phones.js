/**
 * Backfill: give every user a phone number where it's currently null/empty.
 *
 * The cohort seed created accounts with `phone: null` (raw insert bypassed the
 * schema's required-phone rule). Contact numbers are now surfaced to DCS (to
 * reach invigilators) and to CS (teacher directory), so every account needs one.
 *
 * Real accounts created through the UI already collect a phone; this only fills
 * the seeded gaps. Deterministic (ordered by _id) so re-runs are stable.
 *
 * Run: node scripts/backfill-user-phones.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/exam-duty";

// Placeholder Indian-format mobile: +91 9800000000 + sequence.
const genPhone = (i) => `+91 ${9800000000 + i}`;

async function backfill() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const users = mongoose.connection.db.collection("users");

  const missing = await users
    .find({ $or: [{ phone: null }, { phone: "" }, { phone: { $exists: false } }] })
    .sort({ _id: 1 })
    .toArray();

  console.log(`Users missing a phone: ${missing.length}`);

  let updated = 0;
  for (let i = 0; i < missing.length; i++) {
    await users.updateOne(
      { _id: missing[i]._id },
      { $set: { phone: genPhone(i), updatedAt: new Date() } }
    );
    updated += 1;
  }

  console.log(`Phones set: ${updated}`);
  const remaining = await users.countDocuments({
    $or: [{ phone: null }, { phone: "" }, { phone: { $exists: false } }],
  });
  console.log(
    remaining === 0
      ? "Done — every user now has a phone."
      : `WARNING: ${remaining} users still have no phone.`
  );

  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
