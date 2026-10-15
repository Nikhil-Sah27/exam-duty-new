// Backfill Duty.roomRef from Duty.examRoom.room._id so existing (assigned)
// duties benefit from building-aware conflict checks. Idempotent.

require("dotenv").config();
const mongoose = require("mongoose");

const Duty = require("../modules/duty/duty.model");
const ExamRoom = require("../modules/exam/examRoom.model");
const Room = require("../modules/infrastructure/infrastructure.model");
const Building = require("../modules/infrastructure/building.model");
// eslint-disable-next-line no-unused-vars
const _refs = { ExamRoom, Room, Building };

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  const candidates = await Duty.find({
    roomRef: null,
    examRoom: { $ne: null },
  }).populate({ path: "examRoom", select: "room", populate: { path: "room", select: "_id roomNumber" } });

  console.log(`Duties needing backfill: ${candidates.length}`);

  let updated = 0;
  let skipped = 0;
  for (const d of candidates) {
    const roomRef = d.examRoom?.room?._id;
    if (!roomRef) {
      skipped++;
      continue;
    }
    await Duty.updateOne({ _id: d._id }, { $set: { roomRef } });
    updated++;
  }

  const remaining = await Duty.countDocuments({ roomRef: null, examRoom: { $ne: null } });
  console.log(`Updated: ${updated}, Skipped (missing room populate): ${skipped}`);
  console.log(`Remaining with null roomRef and non-null examRoom: ${remaining}`);

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
