// Assigns classrooms to the 5 SEE schedules created by seed-cse-sem1-see.js.
// Uses the same cie.service.assignRooms() the API endpoint hits, so the
// result is indistinguishable from clicking through the Room Assign step.
//
// One Academic Block room per schedule (60-student CSE Sem 1 section fits
// in a single 60–72 capacity hall).

const mongoose = require("mongoose");
require("dotenv").config();

const Department = require("../modules/department/department.model");
const Building = require("../modules/infrastructure/building.model");
const Room = require("../modules/infrastructure/infrastructure.model");
const ExamGroup = require("../modules/exam/examGroup.model");
const ExamSchedule = require("../modules/exam/examSchedule.model");
const ExamRoom = require("../modules/exam/examRoom.model");
const cieService = require("../modules/create-exams/cie.service");

// One room per schedule — varied for realism. roomNumber matches what
// seed-rooms.js inserted into Academic Block.
const ROOM_PLAN = ["101", "102", "103", "104", "201"];

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  const dept = await Department.findOne({ code: "CSE" });
  if (!dept) throw new Error("CSE department not found");

  // Pick the most recent active SEE group for CSE Sem 1.
  const examGroup = await ExamGroup.findOne({
    examType: "SEE",
    semester: 1,
    isActive: true,
  }).sort({ createdAt: -1 });
  if (!examGroup) throw new Error("No SEE Sem 1 exam group — run seed-cse-sem1-see.js first");

  const schedules = await ExamSchedule.find({ examGroup: examGroup._id }).sort({
    date: 1,
    startTime: 1,
  });
  if (schedules.length === 0) throw new Error("No schedules under that exam group");
  if (schedules.length !== ROOM_PLAN.length) {
    console.warn(
      `Note: ${schedules.length} schedules but ROOM_PLAN has ${ROOM_PLAN.length} entries — assigning ${Math.min(schedules.length, ROOM_PLAN.length)}.`,
    );
  }

  const academic = await Building.findOne({ name: "Academic Block" });
  if (!academic) throw new Error("Academic Block not found — run seed-rooms.js");

  // Bail out cleanly if rooms are already assigned (re-run safety).
  const existing = await ExamRoom.find({
    schedule: { $in: schedules.map((s) => s._id) },
  });
  if (existing.length > 0) {
    console.log(
      `Already have ${existing.length} room assignments for this exam group — exiting without changes.`,
    );
    await mongoose.disconnect();
    return;
  }

  const assignments = [];
  for (let i = 0; i < Math.min(schedules.length, ROOM_PLAN.length); i++) {
    const schedule = schedules[i];
    const roomNumber = ROOM_PLAN[i];
    const room = await Room.findOne({
      building: academic._id,
      roomNumber,
      isActive: true,
    });
    if (!room) {
      throw new Error(`Academic Block room ${roomNumber} not found`);
    }
    assignments.push({
      scheduleId: schedule._id.toString(),
      roomId: room._id.toString(),
      departmentCode: dept.code,
      isShared: false,
      students: 0,
    });
  }

  console.log("\nAssignments:");
  for (let i = 0; i < assignments.length; i++) {
    const s = schedules[i];
    const room = await Room.findById(assignments[i].roomId);
    const day = new Date(s.date).toLocaleDateString("en-US", { weekday: "short" });
    console.log(
      `  ${i + 1}. ${day} ${s.date.toISOString().slice(0, 10)} ${s.startTime}-${s.endTime}  ` +
        `→ Academic Block ${room.roomNumber} (floor ${room.floor}, cap ${room.capacity})`,
    );
  }

  const result = await cieService.assignRooms({ assignments });
  console.log(`\nCreated ${result.length} ExamRoom entries`);

  await mongoose.disconnect();
  console.log("Done — refresh the exam group page to see assigned rooms");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
