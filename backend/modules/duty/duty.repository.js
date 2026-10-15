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

/**
 * Create one duty per item, in order — the write half of every group claim.
 * Inside a transaction a failure rolls everything back by itself. Without one
 * (standalone Mongo, where `withOptionalTransaction` runs with a null session)
 * the rooms written before the failure are deleted again, so losing a claim
 * race on room 3 of 5 can't leave a teacher holding rooms 1–2.
 */
const createMany = async (items, session) => {
  const created = [];
  try {
    for (const data of items) created.push(await create(data, session));
    return created;
  } catch (err) {
    if (!session && created.length) {
      await Duty.deleteMany({ _id: { $in: created.map((d) => d._id) } });
    }
    throw err;
  }
};

const findAll = (filter = {}) => {
  return Duty.find(filter).populate(POPULATE_FIELDS).sort({ date: 1, startTime: 1 });
};

const findById = (id) => {
  return Duty.findById(id).populate(POPULATE_FIELDS);
};

/** A teacher's live duties dated on/after `since`, populated for unit building. */
const findLiveForTeacherSince = (teacherId, since) =>
  Duty.find({ teacher: teacherId, status: "assigned", date: { $gte: since } })
    .populate(POPULATE_FIELDS)
    .sort({ date: 1, startTime: 1 });

const updateById = (id, data) => {
  return Duty.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate(POPULATE_FIELDS);
};

// Light read for the responsiveness report — no heavy populates.
const findForResponsiveness = (since) =>
  Duty.find({ status: { $in: ["assigned", "completed"] }, date: { $gte: since } })
    .select("teacher role examSchedule date startTime endTime status confirmedAt confirmedVia isSelfAssigned createdAt")
    .populate("examSchedule", "date startTime endTime")
    .lean();

const updateMany = (filter, data, session) =>
  Duty.updateMany(filter, data, session ? { session } : {});

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
// Teachers holding an assigned duty on or after `since` — the calendar sweep's scope.
const distinctTeachersWithDutiesSince = (since) =>
  Duty.distinct("teacher", { status: "assigned", date: { $gte: since } });

const distinctTeachersForSchedules = (scheduleIds) => {
  return Duty.distinct("teacher", {
    examSchedule: { $in: scheduleIds },
    status: "assigned",
  });
};

/** { collegeId: live duties from `since` on } — superadmin overview, platform scope. */
const countUpcomingByCollege = async (since) => {
  const rows = await Duty.aggregate([
    { $match: { status: "assigned", date: { $gte: since } } },
    { $group: { _id: "$college", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
};

module.exports = {
  countUpcomingByCollege,
  findLiveForTeacherSince,
  findForResponsiveness,
  updateMany,
  cancelMany,
  create,
  createMany,
  distinctTeachersForSchedules,
  distinctTeachersWithDutiesSince,
  findAll,
  findById,
  updateById,
  findTeacherConflict,
  findRoomConflict,
  findExamRoomsWithDetails,
  findInvigilatorDutiesForRooms,
};
