const Duty = require("./duty.model");
const ExamRoom = require("../exam/examRoom.model");

const POPULATE_FIELDS = [
  { path: "exam", select: "name date department semester type" },
  { path: "teacher", select: "name email department" },
  { path: "assignedBy", select: "name email" },
  {
    path: "examSchedule",
    select: "date startTime endTime examGroup",
    populate: { path: "examGroup", select: "examType semester" },
  },
  {
    path: "examRoom",
    select: "room departments",
    populate: {
      path: "room",
      select: "roomNumber floor capacity building",
      populate: { path: "building", select: "name" },
    },
  },
];

const create = (data, session) => {
  return Duty.create([data], { session }).then((docs) => docs[0]);
};

const findAll = (filter = {}) => {
  return Duty.find(filter).populate(POPULATE_FIELDS).sort({ date: 1, startTime: 1 });
};

const findById = (id) => {
  return Duty.findById(id).populate(POPULATE_FIELDS);
};

const updateById = (id, data) => {
  return Duty.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate(POPULATE_FIELDS);
};

// Cancel several duties in one write — used by group unassign, which must be
// all-or-nothing, hence the optional session.
const cancelMany = (ids, cancelReason, session) =>
  Duty.updateMany(
    { _id: { $in: ids } },
    { status: "cancelled", cancelledAt: new Date(), cancelReason: cancelReason || null },
    session ? { session } : {}
  );

// Conflict check: teacher already has duty at the same date/time
const findTeacherConflict = (teacherId, date, startTime, endTime, excludeId) => {
  const filter = {
    teacher: teacherId,
    date,
    status: "assigned",
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
    ],
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Duty.findOne(filter);
};

/**
 * Conflict check: is this room's role slot already occupied at this time?
 *
 * Each room has up to three independent role slots — DCS, RS, and Invigilator.
 * One role being filled does NOT block another (a room with a DCS supervisor
 * still needs an invigilator). When `role` is supplied, the conflict scan is
 * scoped to that role's existing duties. When omitted (legacy callers), the
 * old role-agnostic behaviour is preserved.
 *
 * Returns the first conflicting Duty (populated with the teacher's role +
 * name) so the caller can build a precise error message, or `null` if the
 * slot is free for the given role.
 */
const findRoomConflict = (room, date, startTime, endTime, role, excludeId, roomRef) => {
  const filter = {
    date,
    status: "assigned",
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
    ],
  };
  if (roomRef) {
    filter.roomRef = roomRef;
  } else {
    filter.room = room;
  }
  if (excludeId) filter._id = { $ne: excludeId };
  if (role) filter.role = role;

  return Duty.findOne(filter).populate("teacher", "name roles");
};

const findExamRoomsWithDetails = (examRoomIds) => {
  return ExamRoom.find({ _id: { $in: examRoomIds } }).populate({
    path: "room",
    select: "roomNumber floor capacity building",
    populate: { path: "building", select: "name" },
  });
};

const findInvigilatorDutiesForRooms = (examRoomIds) => {
  return Duty.find({
    examRoom: { $in: examRoomIds },
    role: "invigilator",
    status: "assigned",
  }).populate("teacher", "name email phone department");
};

/** Distinct teacher ids holding a live duty on any of these schedules. */
const distinctTeachersForSchedules = (scheduleIds) => {
  return Duty.distinct("teacher", {
    examSchedule: { $in: scheduleIds },
    status: "assigned",
  });
};

module.exports = {
  cancelMany,
  create,
  distinctTeachersForSchedules,
  findAll,
  findById,
  updateById,
  findTeacherConflict,
  findRoomConflict,
  findExamRoomsWithDetails,
  findInvigilatorDutiesForRooms,
};
